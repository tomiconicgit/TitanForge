// src/js/export.js — Main-thread GLB export (no Worker). Rig + textures preserved, mobile-safe.
(function () {
  'use strict';

  let modal, listContainer, statusText, progressBar, progressFill, cancelBtn;
  const assets = new Map();
  let isExporting = false;
  let cancelRequested = false;

  // Lazy-load SkeletonUtils when needed (keeps boot fast)
  let SkeletonUtils = null;
  async function ensureSkeletonUtils() {
    if (SkeletonUtils) return SkeletonUtils;
    const mod = await import('three/addons/utils/SkeletonUtils.js');
    SkeletonUtils = mod; // { clone }
    return SkeletonUtils;
  }

  function injectUI() {
    const style = document.createElement('style');
    style.textContent = `
      .tf-export-modal-content{width:min(420px,90vw);padding:25px;background:rgba(28,32,38,.95);
        border-radius:12px;border:1px solid rgba(255,255,255,.1);display:flex;flex-direction:column;gap:16px;color:#e6eef6}
      .title{font-size:18px;font-weight:600;text-align:center;padding-bottom:12px;border-bottom:1px solid rgba(255,255,255,.1)}
      #tf-export-list{display:flex;flex-direction:column;gap:10px;max-height:50vh;overflow:auto}
      #tf-export-list button{width:100%;padding:12px;font-size:15px;font-weight:500;border:none;border-radius:8px;background:rgba(255,255,255,.1);color:#e6eef6;cursor:pointer;text-align:left;transition:background .2s,opacity .2s}
      #tf-export-list button:hover{background:rgba(255,255,255,.15)}
      #tf-export-list button:disabled{opacity:.5;cursor:not-allowed}
      .tf-export-progress-bar{width:100%;height:10px;background:rgba(255,255,255,.1);border-radius:5px;overflow:hidden}
      .tf-export-progress-fill{width:0%;height:100%;background:linear-gradient(90deg,#6a11cb 0%,#2575fc 100%);transition:width .2s}
      .tf-export-actions{display:flex;gap:10px}
      .tf-export-cancel{flex:1;padding:10px;border:none;border-radius:8px;background:#c62828;color:#fff;font-weight:600;cursor:pointer;display:none}
      #tf-export-status{font-size:13px;color:#a0a7b0;text-align:center;min-height:16px}
      .no-assets{text-align:center;color:#a0a7b0;padding:20px 0}
    `;
    document.head.appendChild(style);

    modal = document.createElement('div');
    modal.id = 'tf-export-modal';
    modal.className = 'tf-modal-overlay';
    modal.innerHTML = `
      <div class="tf-export-modal-content">
        <div class="title">Export Model as GLB</div>
        <div id="tf-export-list"></div>
        <div class="tf-export-progress-bar" style="display:none;"><div class="tf-export-progress-fill"></div></div>
        <div class="tf-export-actions"><button class="tf-export-cancel">Cancel</button></div>
        <div id="tf-export-status">Select an item to download.</div>
      </div>`;
    document.body.appendChild(modal);

    listContainer = modal.querySelector('#tf-export-list');
    statusText = modal.querySelector('#tf-export-status');
    progressBar = modal.querySelector('.tf-export-progress-bar');
    progressFill = modal.querySelector('.tf-export-progress-fill');
    cancelBtn = modal.querySelector('.tf-export-cancel');
  }

  function showModal(visible) {
    if (visible) {
      populateList();
      statusText.textContent = 'Select an item to download.';
      progressBar.style.display = 'none';
      cancelBtn.style.display = 'none';
    }
    modal.classList.toggle('show', visible);
  }

  function populateList() {
    listContainer.innerHTML = '';
    if (assets.size === 0) {
      listContainer.innerHTML = `<div class="no-assets">No models or assets are loaded.</div>`;
      return;
    }
    for (const [id, asset] of assets.entries()) {
      const b = document.createElement('button');
      b.textContent = asset.name;
      b.dataset.assetId = id;
      b.disabled = isExporting;
      listContainer.appendChild(b);
    }
  }

  // ---------- Helpers ----------
  const idle = (ms = 16) => new Promise(r => (self.requestIdleCallback || setTimeout)(r, ms));
  const isIOS = () => /iPad|iPhone|iPod/.test(navigator.userAgent) || 
                      (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);

  function updateProgress(p, label) {
    progressFill.style.width = `${p}%`;
    statusText.textContent = `${label} (${Math.round(p)}%)`;
  }

  function disposeClone(root) {
    root.traverse(obj => {
      if (obj.isMesh || obj.isSkinnedMesh) {
        if (obj.geometry) obj.geometry.dispose();
        // materials use the original textures; don't dispose textures here
        if (Array.isArray(obj.material)) obj.material.forEach(m => m.dispose?.());
        else obj.material?.dispose?.();
      }
    });
  }

  function prepareMaterialForExport(mat, THREE) {
    // Ensure MeshStandardMaterial + sane texture flags
    if (!mat || mat.type !== 'MeshStandardMaterial') {
      const m = new THREE.MeshStandardMaterial();
      // Copy basic color/rough/metal if present
      if (mat?.color) m.color.copy(mat.color);
      if (typeof mat?.roughness === 'number') m.roughness = mat.roughness;
      if (typeof mat?.metalness === 'number') m.metalness = mat.metalness;
      mat = m;
    }
    // FlipY must be false for glTF; color space sRGB only for baseColor/emissive
    const maps = ['map','normalMap','roughnessMap','metalnessMap','aoMap','emissiveMap'];
    for (const k of maps) {
      const t = mat[k];
      if (!t) continue;
      t.flipY = false;
      if (k === 'map' || k === 'emissiveMap') {
        t.colorSpace = THREE.SRGBColorSpace;
      } else {
        t.colorSpace = THREE.NoColorSpace;
      }
    }
    mat.needsUpdate = true;
    return mat;
  }

  async function buildExportRoot(asset) {
    const { THREE, GLTFExporter } = window.Phonebook;
    await ensureSkeletonUtils();

    const src = asset.object;
    src.updateWorldMatrix(true, true);

    // Deep clone (preserves skeleton links)
    const clone = SkeletonUtils.clone(src);

    // Bake root world matrix without modifying bones/skin:
    // put the clone under a neutral group, and give the clone the world matrix.
    const root = new THREE.Group();
    root.name = `ExportRoot_${asset.name}`;
    root.add(clone);

    // Apply the original's world transform to the clone as its local transform
    clone.matrix.copy(src.matrixWorld);
    clone.matrixAutoUpdate = false;
    clone.updateMatrixWorld(true);

    // Prune hidden nodes & sanitize materials in small batches
    let processed = 0;
    const toProcess = [];
    root.traverse(o => toProcess.push(o));

    for (let i = 0; i < toProcess.length; i++) {
      if (cancelRequested) throw new Error('cancelled');
      const o = toProcess[i];

      // Drop non-visible meshes
      if ((o.isMesh || o.isSkinnedMesh) && !o.visible) {
        o.parent?.remove(o);
        continue;
      }

      if (o.isMesh || o.isSkinnedMesh) {
        // Tighten geometry draw range if set
        if (o.geometry && typeof o.geometry.drawRange?.count === 'number' && o.geometry.drawRange.count >= 0) {
          // nothing to do; GLTFExporter honors truncateDrawRange
        }
        // Normalize materials and texture flags
        if (Array.isArray(o.material)) {
          o.material = o.material.map(m => prepareMaterialForExport(m, THREE));
        } else {
          o.material = prepareMaterialForExport(o.material, THREE);
        }
      }

      processed++;
      if ((processed % 20) === 0) await idle(12); // yield periodically
    }

    return { root, GLTFExporter, THREE };
  }

  async function exportAsset(assetId) {
    if (isExporting) return;
    const asset = assets.get(assetId);
    if (!asset?.object) {
      statusText.textContent = 'Error: Asset not found.';
      return;
    }

    // UI state
    isExporting = true;
    cancelRequested = false;
    listContainer.querySelectorAll('button').forEach(b => b.disabled = true);
    progressBar.style.display = 'block';
    cancelBtn.style.display = 'block';
    progressFill.style.background = '';
    updateProgress(4, 'Preparing export');

    cancelBtn.onclick = () => {
      if (isExporting) {
        cancelRequested = true; // can cancel during prep; once export starts we’ll ignore
        progressFill.style.background = '#ff3b30';
        updateProgress(100, 'Cancelled');
        isExporting = false;
        cancelBtn.style.display = 'none';
        listContainer.querySelectorAll('button').forEach(b => b.disabled = false);
      }
    };

    let tmpRoot = null;
    try {
      // 1) Build a minimal, self-contained subtree (with bones) on the main thread
      updateProgress(12, 'Cloning rig & meshes');
      const { root, GLTFExporter, THREE } = await buildExportRoot(asset);
      tmpRoot = root;

      if (cancelRequested) throw new Error('cancelled');

      // 2) Small settle to let UI paint
      await idle(24);
      updateProgress(28, 'Optimizing & sanitizing');

      // 3) Export options to keep memory sane on mobile
      const opts = {
        binary: true,
        onlyVisible: true,
        truncateDrawRange: true,
        embedImages: true,
        // iOS is memory-tight; cap textures lower
        maxTextureSize: isIOS() ? 2048 : 4096
      };

      if (cancelRequested) throw new Error('cancelled');

      // 4) Kick exporter (this part is CPU-heavy and not cancellable)
      updateProgress(62, 'Packaging GLB');
      const exporter = new GLTFExporter();

      // Promisify parse
      const glb = await new Promise((resolve, reject) => {
        try {
          exporter.parse(
            tmpRoot,
            (glbBuffer) => resolve(glbBuffer),
            (err) => reject(err instanceof Error ? err : new Error(String(err))),
            opts
          );
        } catch (e) {
          reject(e);
        }
      });

      if (!glb) throw new Error('Export produced empty file');

      updateProgress(92, 'Creating file');

      const blob = new Blob([glb], { type: 'model/gltf-binary' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      const base = assets.get(assetId).name.replace(/\.glb$/i, '');
      a.download = `exported_${base}.glb`;
      a.href = url;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      updateProgress(100, 'Download complete!');
      setTimeout(() => showModal(false), 1200);
    } catch (err) {
      if (String(err.message || err) === 'cancelled') {
        // UI already updated in cancel handler
      } else {
        console.error('Export error:', err);
        updateProgress(100, 'Export failed');
        progressFill.style.background = '#ff3b30';
      }
    } finally {
      // Free the temporary clone ASAP
      if (tmpRoot) {
        try { disposeClone(tmpRoot); } catch {}
        tmpRoot = null;
      }
      isExporting = false;
      cancelBtn.style.display = 'none';
      listContainer.querySelectorAll('button').forEach(b => b.disabled = false);
    }
  }

  function bootstrap() {
    if (window.Export) return;
    injectUI();

    App.on('asset:loaded', (e) => assets.set(e.detail.id, e.detail));
    App.on('asset:cleaned', (e) => assets.delete(e.detail.id));

    modal.addEventListener('click', (e) => { if (e.target === modal) showModal(false); });
    listContainer.addEventListener('click', (e) => {
      const b = e.target.closest('button');
      if (b?.dataset.assetId) exportAsset(b.dataset.assetId);
    });

    window.Export = { show: () => showModal(true) };
    window.Debug?.log('Export Module (main-thread, rig+textures) ready.');
  }

  if (window.App?.glVersion) bootstrap();
  else window.App?.on('app:booted', bootstrap);
})();