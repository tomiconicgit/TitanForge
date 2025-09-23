// src/js/export.js — Streamed, zero-copy exporter (no giant .toJSON)
(function () {
  'use strict';

  // --- Module State ---
  let modal, listContainer, statusText, progressBar, progressFill, cancelBtn;
  const assets = new Map();

  // --- UI Injection ---
  function injectUI() {
    const style = document.createElement('style');
    style.textContent = `
      .tf-export-modal-content {
        width: min(420px, 90vw);
        padding: 25px;
        background: rgba(28,32,38,0.95);
        border-radius: 12px;
        border: 1px solid rgba(255,255,255,0.1);
        display: flex; flex-direction: column; gap: 16px; color: #e6eef6;
      }
      .tf-export-modal-content .title {
        font-size: 18px; font-weight: 600; text-align: center;
        padding-bottom: 12px; border-bottom: 1px solid rgba(255,255,255,0.1);
      }
      #tf-export-list { display:flex; flex-direction:column; gap:10px; max-height:50vh; overflow:auto; }
      #tf-export-list button {
        width:100%; padding:12px; font-size:15px; font-weight:500; border:none; border-radius:8px;
        background: rgba(255,255,255,0.1); color:#e6eef6; cursor:pointer; text-align:left;
        transition: background 0.2s ease, opacity 0.2s ease;
      }
      #tf-export-list button:hover { background: rgba(255,255,255,0.15); }
      #tf-export-list button:disabled { opacity:.5; cursor:not-allowed; }
      .tf-export-progress-bar { width:100%; height:10px; background: rgba(255,255,255,0.1); border-radius:5px; overflow:hidden; }
      .tf-export-progress-fill { width:0%; height:100%; background: linear-gradient(90deg,#6a11cb 0%,#2575fc 100%); transition: width .2s ease-out; }
      .tf-export-actions { display:flex; gap:10px; }
      .tf-export-cancel { flex:1; padding:10px; border:none; border-radius:8px; background: #c62828; color:#fff; font-weight:600; cursor:pointer; display:none; }
      #tf-export-status { font-size:13px; color:#a0a7b0; text-align:center; min-height:16px; }
      .no-assets { text-align:center; color:#a0a7b0; padding:20px 0; }
    `;
    document.head.appendChild(style);

    modal = document.createElement('div');
    modal.id = 'tf-export-modal';
    modal.className = 'tf-modal-overlay';
    modal.innerHTML = `
      <div class="tf-export-modal-content">
        <div class="title">Export Model as GLB</div>
        <div id="tf-export-list"></div>
        <div class="tf-export-progress-bar" style="display:none;">
          <div class="tf-export-progress-fill"></div>
        </div>
        <div class="tf-export-actions">
          <button class="tf-export-cancel">Cancel</button>
        </div>
        <div id="tf-export-status">Select an item to download.</div>
      </div>
    `;
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
      const button = document.createElement('button');
      button.textContent = asset.name;
      button.dataset.assetId = id;
      listContainer.appendChild(button);
    }
  }

  // ---- Helpers to build portable / transferable mesh payloads ----
  function attrDesc(attr) {
    if (!attr) return null;
    const array = attr.array;
    return {
      arrayType: array.constructor.name, // e.g., Float32Array
      itemSize: attr.itemSize,
      normalized: !!attr.normalized,
      buffer: array.buffer
    };
  }

  function materialDesc(mat) {
    if (!mat) return null;
    // Keep only safe scalars; textures are skipped to avoid big transfers.
    return {
      name: mat.name || '',
      color: (mat.color && mat.color.getHex()) || 0xffffff,
      metalness: (typeof mat.metalness === 'number') ? mat.metalness : 0.0,
      roughness: (typeof mat.roughness === 'number') ? mat.roughness : 0.9,
      transparent: !!mat.transparent,
      opacity: (typeof mat.opacity === 'number') ? mat.opacity : 1.0,
      doubleSided: mat.side === window.Phonebook.THREE.DoubleSide
    };
  }

  function geometryDesc(geom) {
    const g = {
      attributes: {
        position: attrDesc(geom.getAttribute('position')),
        normal:   attrDesc(geom.getAttribute('normal')),
        uv:       attrDesc(geom.getAttribute('uv')),
        color:    attrDesc(geom.getAttribute('color')),
        tangent:  attrDesc(geom.getAttribute('tangent')),
        skinIndex: attrDesc(geom.getAttribute('skinIndex')),
        skinWeight: attrDesc(geom.getAttribute('skinWeight')),
      },
      index: geom.index ? {
        arrayType: geom.index.array.constructor.name,
        buffer: geom.index.array.buffer
      } : null,
      groups: Array.isArray(geom.groups) && geom.groups.length ? geom.groups.map(g => ({
        start: g.start, count: g.count, materialIndex: g.materialIndex || 0
      })) : [],
    };
    if (geom.boundingBox) {
      g.boundingBox = { min: geom.boundingBox.min.toArray(), max: geom.boundingBox.max.toArray() };
    }
    return g;
  }

  function skeletonDesc(skinnedMesh) {
    const s = skinnedMesh.skeleton;
    const bones = s.bones.map((bone, i) => ({
      name: bone.name || `Bone_${i}`,
      // local matrix relative to its parent (so hierarchy restores properly)
      localMatrix: bone.matrix.toArray(),
      parentIndex: s.bones.indexOf(bone.parent) // -1 if no parent in the list
    }));
    return {
      bones,
      bindMatrix: skinnedMesh.bindMatrix?.toArray?.() || null,
      boneInverses: (s.boneInverses || []).map(m => m.toArray())
    };
  }

  function* meshStream(root) {
    const { THREE } = window.Phonebook;
    root.updateWorldMatrix(true, true);
    const tmp = [];
    root.traverse(obj => { if (obj.isMesh || obj.isSkinnedMesh) tmp.push(obj); });

    for (const obj of tmp) {
      const isSkin = !!obj.isSkinnedMesh;
      const geom = obj.geometry;
      if (!geom || !geom.getAttribute('position')) continue;

      const payload = {
        type: isSkin ? 'SkinnedMesh' : 'Mesh',
        name: obj.name || '',
        matrixWorld: obj.matrixWorld.toArray(),
        geometry: geometryDesc(geom),
        material: Array.isArray(obj.material) ? obj.material.map(materialDesc) : materialDesc(obj.material)
      };
      if (isSkin) payload.skeleton = skeletonDesc(obj);

      // Transfer list — include all attribute/index ArrayBuffers
      const transfers = [];
      const A = payload.geometry.attributes;
      for (const k in A) if (A[k]?.buffer) transfers.push(A[k].buffer);
      if (payload.geometry.index?.buffer) transfers.push(payload.geometry.index.buffer);

      yield { payload, transfers };
    }
  }

  const nextIdle = (timeout = 16) =>
    new Promise(res => (self.requestIdleCallback || setTimeout)(res, timeout));

  function updateProgress(p, text) {
    progressFill.style.width = `${p}%`;
    statusText.textContent = `${text} (${Math.round(p)}%)`;
  }

  // --- Streamed export pipeline ---
  function exportAsset(assetId) {
    const asset = assets.get(assetId);
    if (!asset || !asset.object) {
      statusText.textContent = 'Error: Asset not found.';
      return;
    }

    // UI setup
    listContainer.querySelectorAll('button').forEach(b => b.disabled = true);
    progressBar.style.display = 'block';
    progressFill.style.background = '';
    cancelBtn.style.display = 'block';
    updateProgress(6, 'Preparing export');

    const worker = new Worker('./src/js/export-worker.js', { type: 'module' });
    let cancelled = false;

    const cleanup = (hard = false) => {
      cancelBtn.style.display = 'none';
      if (hard) {
        try { worker.terminate(); } catch {}
      }
    };

    cancelBtn.onclick = () => {
      cancelled = true;
      try { worker.postMessage({ type: 'abort' }); } catch {}
      cleanup(true);
      updateProgress(100, 'Export cancelled');
      progressFill.style.background = '#ff3b30';
      listContainer.querySelectorAll('button').forEach(b => b.disabled = false);
    };

    worker.onerror = (err) => {
      console.error('Worker error:', err);
      cleanup(true);
      updateProgress(100, 'Critical worker error');
      progressFill.style.background = '#ff3b30';
      listContainer.querySelectorAll('button').forEach(b => b.disabled = false);
    };

    worker.onmessage = (evt) => {
      const msg = evt.data || {};
      if (msg.type === 'ready') {
        // Start streaming meshes
        (async () => {
          const stream = meshStream(asset.object);
          const all = Array.from(meshStream(asset.object)); // Count without re-traverse
          const total = all.length;
          let sent = 0;

          for (const { payload, transfers } of all) {
            if (cancelled) return;
            updateProgress(10 + (sent / Math.max(1, total)) * 65, `Sending mesh ${sent + 1}/${total}`);
            worker.postMessage({ type: 'mesh', payload }, transfers);
            sent++;
            // Yield to keep UI responsive
            await nextIdle();
          }

          if (cancelled) return;
          updateProgress(80, 'Finalising GLB');
          worker.postMessage({ type: 'export' });
        })();
      } else if (msg.type === 'mesh:ok') {
        updateProgress(10 + (msg.received / Math.max(1, msg.total)) * 65, `Received ${msg.received}/${msg.total}`);
      } else if (msg.type === 'done' && msg.glb) {
        if (cancelled) return;
        updateProgress(95, 'Creating file');
        const blob = new Blob([msg.glb], { type: 'model/gltf-binary' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        const baseName = asset.name.endsWith('.glb') ? asset.name.slice(0, -4) : asset.name;
        link.download = `exported_${baseName}.glb`;
        link.href = url;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);

        updateProgress(100, 'Download complete!');
        cleanup(true);
        setTimeout(() => showModal(false), 1200);
      } else if (msg.type === 'error') {
        console.error('Export worker:', msg.message);
        cleanup(true);
        updateProgress(100, 'Export failed');
        progressFill.style.background = '#ff3b30';
        listContainer.querySelectorAll('button').forEach(b => b.disabled = false);
      } else if (msg.type === 'aborted') {
        // No-op; UI already updated on cancel.
      }
    };

    // Begin: count meshes first (without holding references)
    const count = (() => {
      let c = 0;
      asset.object.traverse(o => { if (o.isMesh || o.isSkinnedMesh) c++; });
      return c;
    })();

    // Warm up: ensure world matrices up to date & bounds computed
    asset.object.updateWorldMatrix(true, true);

    // Start worker session
    worker.postMessage({ type: 'begin', count });
    updateProgress(8, `Preparing ${count} mesh${count === 1 ? '' : 'es'}`);
  }

  // --- Event Handling & Bootstrap ---
  function bootstrap() {
    if (window.Export) return;
    injectUI();

    App.on('asset:loaded', (event) => assets.set(event.detail.id, event.detail));
    App.on('asset:cleaned', (event) => assets.delete(event.detail.id));

    modal.addEventListener('click', (e) => { if (e.target === modal) showModal(false); });
    listContainer.addEventListener('click', (e) => {
      const button = e.target.closest('button');
      if (button && button.dataset.assetId) exportAsset(button.dataset.assetId);
    });

    window.Export = { show: () => showModal(true) };
    window.Debug?.log('Export Module (streaming worker) ready.');
  }

  if (window.App?.glVersion) bootstrap();
  else window.App?.on('app:booted', bootstrap);
})();