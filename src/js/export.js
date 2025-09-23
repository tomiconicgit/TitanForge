// src/js/export.js — Streams meshes + rig + active textures into GLB (mobile-safe)
(function () {
  'use strict';

  let modal, listContainer, statusText, progressBar, progressFill, cancelBtn;
  const assets = new Map();

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
      listContainer.appendChild(b);
    }
  }

  // ---------- Streaming payload builders ----------
  const nextIdle = (ms = 16) => new Promise(r => (self.requestIdleCallback || setTimeout)(r, ms));
  const cloneBuf = (buf) => (buf?.slice ? buf.slice(0) : buf); // keep live geometry intact

  function attrDesc(attr) {
    if (!attr) return null;
    return {
      arrayType: attr.array.constructor.name,
      itemSize: attr.itemSize,
      normalized: !!attr.normalized,
      buffer: cloneBuf(attr.array.buffer)
    };
  }

  function geometryDesc(g) {
    const d = {
      attributes: {
        position: attrDesc(g.getAttribute('position')),
        normal:   attrDesc(g.getAttribute('normal')),
        uv:       attrDesc(g.getAttribute('uv')),
        color:    attrDesc(g.getAttribute('color')),
        tangent:  attrDesc(g.getAttribute('tangent')),
        skinIndex: attrDesc(g.getAttribute('skinIndex')),
        skinWeight: attrDesc(g.getAttribute('skinWeight')),
      },
      index: g.index ? {
        arrayType: g.index.array.constructor.name,
        buffer: cloneBuf(g.index.array.buffer)
      } : null,
      groups: Array.isArray(g.groups) && g.groups.length ? g.groups.map(x => ({ start:x.start, count:x.count, materialIndex:x.materialIndex||0 })) : []
    };
    if (g.boundingBox) d.boundingBox = { min: g.boundingBox.min.toArray(), max: g.boundingBox.max.toArray() };
    return d;
  }

  function skeletonDesc(sm) {
    const s = sm.skeleton;
    return {
      bones: s.bones.map(b => ({
        name: b.name || '',
        localMatrix: b.matrix.toArray(),
        parentIndex: s.bones.indexOf(b.parent)
      })),
      bindMatrix: sm.bindMatrix?.toArray?.() || null,
      boneInverses: (s.boneInverses||[]).map(m => m.toArray())
    };
  }

  // Texture streaming
  const texIdCache = new Map(); // Texture -> id
  let texSeq = 1;

  async function mapDesc(tex, role) {
    if (!tex || !tex.image) return null;

    let id = texIdCache.get(tex);
    let attachment = null;

    if (!id) {
      id = `tx_${texSeq++}`;
      texIdCache.set(tex, id);

      // Convert source to ImageBitmap (fast + transferable)
      let bitmap;
      try {
        bitmap = await createImageBitmap(tex.image);
      } catch {
        // Fallback: draw to canvas then to ImageBitmap
        const w = tex.image.width || 1, h = tex.image.height || 1;
        const c = document.createElement('canvas');
        c.width = w; c.height = h;
        const ctx = c.getContext('2d');
        ctx.drawImage(tex.image, 0, 0, w, h);
        if ('transferControlToOffscreen' in c) {
          const off = c.transferControlToOffscreen();
          bitmap = await createImageBitmap(off); // Safari may still accept
        } else {
          bitmap = await createImageBitmap(c);
        }
      }
      attachment = { id, bitmap };
    }

    return {
      desc: {
        id,
        role,
        srgb: (role === 'map' || role === 'emissiveMap'),
        flipY: !!tex.flipY,
        offset: tex.offset ? [tex.offset.x, tex.offset.y] : undefined,
        repeat: tex.repeat ? [tex.repeat.x, tex.repeat.y] : undefined,
        rotation: typeof tex.rotation === 'number' ? tex.rotation : undefined,
        center: tex.center ? [tex.center.x, tex.center.y] : undefined
      },
      attachment
    };
  }

  async function materialDesc(mat) {
    const d = {
      name: mat.name || '',
      color: (mat.color && mat.color.getHex()) || 0xffffff,
      metalness: (typeof mat.metalness === 'number') ? mat.metalness : 0.0,
      roughness: (typeof mat.roughness === 'number') ? mat.roughness : 0.9,
      transparent: !!mat.transparent,
      opacity: (typeof mat.opacity === 'number') ? mat.opacity : 1.0,
      doubleSided: mat.side === window.Phonebook.THREE.DoubleSide,
      emissive: (mat.emissive && mat.emissive.getHex()) || 0x000000,
      emissiveIntensity: (typeof mat.emissiveIntensity === 'number') ? mat.emissiveIntensity : 1.0,
      maps: {}
    };

    const attachments = [];
    const roles = ['map','normalMap','roughnessMap','metalnessMap','aoMap','emissiveMap'];

    for (const role of roles) {
      const pair = await mapDesc(mat[role], role);
      if (pair) {
        d.maps[role] = pair.desc;
        if (pair.attachment) attachments.push(pair.attachment);
      }
    }

    return { matDesc: d, attachments };
  }

  async function materialArrayDesc(material) {
    if (Array.isArray(material)) {
      const mats = [];
      const att = [];
      for (const m of material) {
        const { matDesc, attachments } = await materialDesc(m);
        mats.push(matDesc);
        att.push(...attachments);
      }
      return { mat: mats, attachments: att };
    } else {
      const { matDesc, attachments } = await materialDesc(material);
      return { mat: matDesc, attachments };
    }
  }

  function updateProgress(p, label) {
    progressFill.style.width = `${p}%`;
    statusText.textContent = `${label} (${Math.round(p)}%)`;
  }

  function exportAsset(assetId) {
    const asset = assets.get(assetId);
    if (!asset?.object) {
      statusText.textContent = 'Error: Asset not found.';
      return;
    }

    listContainer.querySelectorAll('button').forEach(b => b.disabled = true);
    progressBar.style.display = 'block';
    cancelBtn.style.display = 'block';
    progressFill.style.background = '';
    updateProgress(6, 'Preparing export');

    const worker = new Worker('./src/js/export-worker.js', { type: 'module' });
    let cancelled = false;

    const cleanup = () => { cancelBtn.style.display = 'none'; try { worker.terminate(); } catch {} };

    cancelBtn.onclick = () => {
      cancelled = true;
      try { worker.postMessage({ type: 'abort' }); } catch {}
      cleanup();
      updateProgress(100, 'Export cancelled');
      progressFill.style.background = '#ff3b30';
      listContainer.querySelectorAll('button').forEach(b => b.disabled = false);
    };

    worker.onerror = (err) => {
      console.error('Worker error:', err);
      cleanup();
      updateProgress(100, 'Worker error');
      progressFill.style.background = '#ff3b30';
      listContainer.querySelectorAll('button').forEach(b => b.disabled = false);
    };

    worker.onmessage = (ev) => {
      const m = ev.data || {};
      if (m.type === 'ready') {
        // Stream meshes after ready
        (async () => {
          // Count first
          let total = 0;
          asset.object.traverse(o => { if (o.isMesh || o.isSkinnedMesh) total++; });
          let sent = 0;

          // Stream in traversal order
          const toSend = [];
          asset.object.updateWorldMatrix(true, true);
          asset.object.traverse(o => { if (o.isMesh || o.isSkinnedMesh) toSend.push(o); });

          for (const obj of toSend) {
            if (cancelled) return;

            const geom = obj.geometry;
            if (!geom || !geom.getAttribute('position')) { sent++; continue; }

            const { THREE } = window.Phonebook;

            const payload = {
              type: obj.isSkinnedMesh ? 'SkinnedMesh' : 'Mesh',
              name: obj.name || '',
              matrixWorld: obj.matrixWorld.toArray(),
              geometry: geometryDesc(geom),
              material: null,
              skeleton: null
            };

            // Materials (+ attachments for textures)
            const { mat, attachments } = await materialArrayDesc(obj.material || new THREE.MeshStandardMaterial());
            payload.material = mat;

            if (obj.isSkinnedMesh) payload.skeleton = skeletonDesc(obj);

            // Build transfer list
            const transfers = [];
            // geometry buffers
            const A = payload.geometry.attributes;
            for (const k in A) if (A[k]?.buffer) transfers.push(A[k].buffer);
            if (payload.geometry.index?.buffer) transfers.push(payload.geometry.index.buffer);
            // texture bitmaps
            for (const a of attachments) transfers.push(a.bitmap);

            worker.postMessage({ type: 'mesh', payload, attachments }, transfers);

            sent++;
            updateProgress(10 + (sent / Math.max(1, total)) * 65, `Sending mesh ${sent}/${total}`);
            await nextIdle(); // yield to keep UI smooth
          }

          if (cancelled) return;
          updateProgress(80, 'Finalising GLB');
          worker.postMessage({ type: 'export' });
        })();
      } else if (m.type === 'mesh:ok') {
        updateProgress(10 + (m.received / Math.max(1, m.total)) * 65, `Received ${m.received}/${m.total}`);
      } else if (m.type === 'done' && m.glb) {
        if (cancelled) return;
        updateProgress(95, 'Creating file');
        const blob = new Blob([m.glb], { type: 'model/gltf-binary' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        const base = assets.get(assetId).name.replace(/\.glb$/i, '');
        a.download = `exported_${base}.glb`;
        a.href = url;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);

        cleanup();
        updateProgress(100, 'Download complete!');
        setTimeout(() => showModal(false), 1200);
      } else if (m.type === 'error') {
        console.error('Export error:', m.message);
        cleanup();
        updateProgress(100, 'Export failed');
        progressFill.style.background = '#ff3b30';
        listContainer.querySelectorAll('button').forEach(b => b.disabled = false);
      }
    };

    // Begin session
    const meshCount = (() => { let c = 0; asset.object.traverse(o => { if (o.isMesh || o.isSkinnedMesh) c++; }); return c; })();
    worker.postMessage({ type: 'begin', count: meshCount });
    updateProgress(8, `Preparing ${meshCount} mesh${meshCount === 1 ? '' : 'es'}`);
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
    window.Debug?.log('Export Module (textures + rig streaming) ready.');
  }

  if (window.App?.glVersion) bootstrap();
  else window.App?.on('app:booted', bootstrap);
})();