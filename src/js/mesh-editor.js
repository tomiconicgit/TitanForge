// src/js/mesh-editor.js — Touch-first mesh eraser (hold+drag boxes → erase)
// Works with meshes.js via window.MeshEditor.open(mesh)
// - Floating panel appears above the bottom area
// - "Lock Orbit" toggle: when ON, OrbitControls are disabled so you can draw
// - Hold anywhere on the viewer canvas and drag to size a translucent red box
// - Release to drop the box; overlapping boxes auto-merge (AABB union)
// - Press ERASE to remove only triangles whose centroids land in any box
// - Keeps materials/textures; only geometry is rebuilt for the targeted mesh
// Caveat: For SkinnedMesh, selection uses undeformed vertex positions (CPU-side)

(function () {
  'use strict';

  if (window.MeshEditor) return; // guard

  // ----- Module state -----
  const state = {
    activeAsset: null,    // from App.on('asset:activated')
    targetMesh: null,     // the mesh being edited (from meshes.js)
    isOpen: false,
    isLockOrbit: false,
    isDrawing: false,
    boxes: [],            // Array<THREE.Box3> in WORLD space (merged)
    selectionGroup: null, // THREE.Group holding red box visuals
    tmpDraw: {            // live "rubber band" box while dragging
      active: false,
      startPoint: new THREE.Vector3(),
      startScreen: { x: 0, y: 0 },
      startY: 0, // anchor Y for horizontal plane
      liveMesh: null       // THREE.Mesh for preview
    },
    longPressTimer: 0,
    raycaster: null
  };

  const { THREE } = window.Phonebook || {};
  if (!THREE) {
    console.error('[MeshEditor] THREE not found (Phonebook missing).');
    return;
  }

  // ----- UI -----
  let panel, lockCheckbox, eraseBtn, clearBtn, closeBtn, counterEl, hintEl;

  function injectUI() {
    const style = document.createElement('style');
    style.textContent = `
      #tf-mesh-editor-panel{
        position:fixed; bottom:383px; left:16px; z-index:26;
        min-width:220px; max-width:260px;
        background:rgba(28,32,38,0.9);
        backdrop-filter:blur(10px); -webkit-backdrop-filter:blur(10px);
        border:1px solid rgba(255,255,255,.1);
        border-radius:8px; box-shadow:0 8px 25px rgba(0,0,0,.4);
        padding:12px; display:none; flex-direction:column; gap:10px;
      }
      #tf-mesh-editor-panel.show{ display:flex; }
      .tf-row{ display:flex; align-items:center; justify-content:space-between; gap:10px; }
      .tf-label{ color:#e6eef6; font-size:14px; }
      .tf-pill{
        color:#a0a7b0; font-size:12px; padding:4px 8px; border-radius:999px;
        background:rgba(255,255,255,.08);
      }
      .tf-switch{ position:relative; width:30px; height:16px; flex-shrink:0; }
      .tf-switch input{ display:none; }
      .tf-slider{
        position:absolute; inset:0; background:rgba(255,255,255,.2);
        border-radius:16px; transition:.2s;
      }
      .tf-slider:before{
        content:""; position:absolute; width:12px; height:12px; left:2px; bottom:2px;
        background:#fff; border-radius:50%; transition:.2s;
      }
      input:checked + .tf-slider{ background:#00c853; }
      input:checked + .tf-slider:before{ transform:translateX(14px); }
      .tf-buttons{ display:flex; gap:8px; }
      .tf-btn{
        flex:1; padding:9px 10px; border:none; border-radius:6px; color:#fff; cursor:pointer;
        background:rgba(255,255,255,.1); font-weight:600; font-size:14px;
      }
      #tf-me-erase{ background:#c62828; }
      #tf-me-erase:disabled{ opacity:.5; cursor:not-allowed; }
      #tf-me-hint{ color:#a0a7b0; font-size:12px; line-height:1.35; }
      #tf-me-counter{ font-size:12px; color:#a0a7b0; }
      /* Progress overlay */
      #tf-me-progress{
        position:fixed; inset:0; z-index:1001; display:none; align-items:center; justify-content:center;
        background:rgba(0,0,0,.6); backdrop-filter:blur(4px);
      }
      #tf-me-progress.show{ display:flex; }
      .tf-me-progress-card{
        width:min(340px,90vw); padding:24px; border-radius:12px;
        background:rgba(28,32,38,.95); border:1px solid rgba(255,255,255,.12);
        color:#e6eef6; display:flex; flex-direction:column; gap:12px;
      }
      .tf-me-bar{ width:100%; height:10px; background:rgba(255,255,255,.12); border-radius:6px; overflow:hidden; }
      .tf-me-fill{ width:0%; height:100%; background:linear-gradient(90deg,#6a11cb,#2575fc); transition:width .15s; }
      .tf-me-status{ font-size:13px; color:#a0a7b0; height:16px; }
    `;
    document.head.appendChild(style);

    panel = document.createElement('div');
    panel.id = 'tf-mesh-editor-panel';
    panel.innerHTML = `
      <div class="tf-row">
        <div class="tf-label">Mesh Editor</div>
        <div id="tf-me-counter" class="tf-pill">0 boxes</div>
      </div>
      <div id="tf-me-hint">Lock orbit, then <b>hold</b> on the model and <b>drag</b> to draw a red box. Release to drop. Boxes merge if they overlap.</div>
      <div class="tf-row">
        <span class="tf-label">Lock Orbit</span>
        <label class="tf-switch">
          <input type="checkbox" id="tf-me-lock">
          <span class="tf-slider"></span>
        </label>
      </div>
      <div class="tf-buttons">
        <button id="tf-me-clear" class="tf-btn">Clear</button>
        <button id="tf-me-erase" class="tf-btn" disabled>Erase</button>
        <button id="tf-me-close" class="tf-btn">Close</button>
      </div>
    `;
    document.getElementById('app')?.appendChild(panel);

    const prog = document.createElement('div');
    prog.id = 'tf-me-progress';
    prog.innerHTML = `
      <div class="tf-me-progress-card">
        <div style="font-weight:700;">Erasing geometry…</div>
        <div class="tf-me-bar"><div class="tf-me-fill"></div></div>
        <div class="tf-me-status">Starting…</div>
      </div>
    `;
    document.body.appendChild(prog);

    // refs
    lockCheckbox = panel.querySelector('#tf-me-lock');
    eraseBtn = panel.querySelector('#tf-me-erase');
    clearBtn = panel.querySelector('#tf-me-clear');
    closeBtn = panel.querySelector('#tf-me-close');
    counterEl = panel.querySelector('#tf-me-counter');
    hintEl = panel.querySelector('#tf-me-hint');

    // events
    lockCheckbox.addEventListener('change', onLockChange);
    clearBtn.addEventListener('click', clearBoxes);
    eraseBtn.addEventListener('click', onErase);
    closeBtn.addEventListener('click', () => api.close());
  }

  // ----- Open/Close -----
  function openForMesh(mesh) {
    if (!mesh || !(mesh.isMesh || mesh.isSkinnedMesh)) {
      alert('Select a mesh to edit.');
      return;
    }
    state.targetMesh = mesh;
    if (!state.selectionGroup) {
      state.selectionGroup = new THREE.Group();
      state.selectionGroup.name = 'MeshEditorSelections';
      window.Viewer.scene.add(state.selectionGroup);
    }
    state.boxes.length = 0;
    refreshBoxesVisual();
    setCounter(0);
    eraseBtn.disabled = true;
    hintEl.style.display = 'block';
    panel.classList.add('show');
    state.isOpen = true;
    wirePointer();
    window.Debug?.log('[MeshEditor] Opened for mesh: ' + (mesh.name || mesh.uuid));
  }

  function closeEditor() {
    unWirePointer();
    if (state.selectionGroup) {
      window.Viewer.scene.remove(state.selectionGroup);
      disposeGroup(state.selectionGroup);
      state.selectionGroup = null;
    }
    state.boxes.length = 0;
    state.targetMesh = null;
    state.isOpen = false;
    lockCheckbox.checked = false;
    setLock(false);
    panel.classList.remove('show');
    window.Debug?.log('[MeshEditor] Closed.');
  }

  // ----- Orbit lock -----
  function onLockChange(e) { setLock(e.target.checked); }
  function setLock(locked) {
    state.isLockOrbit = !!locked;
    const controls = window.Viewer?.controls;
    if (controls) controls.enabled = !locked;
  }

  // ----- Pointer drawing (hold + drag) -----
  let elCanvas = null;

  function wirePointer() {
    elCanvas = window.Viewer?.renderer?.domElement || null;
    if (!elCanvas) return;

    state.raycaster = state.raycaster || new THREE.Raycaster();

    // use passive: false so we can preventDefault on touch
    elCanvas.addEventListener('pointerdown', onPointerDown, { passive: false });
    window.addEventListener('pointermove', onPointerMove, { passive: false });
    window.addEventListener('pointerup', onPointerUp, { passive: false });
  }
  function unWirePointer() {
    if (!elCanvas) return;
    elCanvas.removeEventListener('pointerdown', onPointerDown);
    window.removeEventListener('pointermove', onPointerMove);
    window.removeEventListener('pointerup', onPointerUp);
    elCanvas = null;
  }

  function onPointerDown(e) {
    if (!state.isOpen || !state.isLockOrbit) return; // only draw when locked
    if (!state.targetMesh) return;

    // Long-press to avoid conflicts with basic taps
    if (state.longPressTimer) clearTimeout(state.longPressTimer);
    const start = { x: e.clientX, y: e.clientY };
    state.longPressTimer = setTimeout(() => {
      beginDraw(e, start);
    }, 120); // ~120ms feels right on iPhone
  }

  function beginDraw(e, start) {
    const { camera } = window.Viewer;
    const { width, height } = elCanvas.getBoundingClientRect();
    const ndc = new THREE.Vector2(
      ((e.clientX - elCanvas.getBoundingClientRect().left) / width) * 2 - 1,
      -((e.clientY - elCanvas.getBoundingClientRect().top) / height) * 2 + 1
    );
    state.raycaster.setFromCamera(ndc, camera);

    // Prefer hitting the target mesh; otherwise intersect a horizontal plane at y=0
    let anchorPoint = new THREE.Vector3();
    const hits = state.raycaster.intersectObject(state.targetMesh, true);
    if (hits && hits.length) {
      anchorPoint.copy(hits[0].point);
    } else {
      const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
      const pt = new THREE.Vector3();
      if (!state.raycaster.ray.intersectPlane(plane, pt)) return;
      anchorPoint.copy(pt);
    }

    state.tmpDraw.active = true;
    state.tmpDraw.startPoint.copy(anchorPoint);
    state.tmpDraw.startScreen = { x: start.x, y: start.y };
    state.tmpDraw.startY = anchorPoint.y;

    // Create live box preview mesh
    if (state.tmpDraw.liveMesh) {
      state.selectionGroup.remove(state.tmpDraw.liveMesh);
      disposeObject(state.tmpDraw.liveMesh);
      state.tmpDraw.liveMesh = null;
    }
    state.tmpDraw.liveMesh = makeBoxVisual(0.001, 0.001, 0.001, true);
    state.selectionGroup.add(state.tmpDraw.liveMesh);

    e.preventDefault();
  }

  function onPointerMove(e) {
    if (!state.tmpDraw.active || !state.isLockOrbit || !state.targetMesh) return;

    const { camera } = window.Viewer;
    const rect = elCanvas.getBoundingClientRect();
    const ndc = new THREE.Vector2(
      ((e.clientX - rect.left) / rect.width) * 2 - 1,
      -((e.clientY - rect.top) / rect.height) * 2 + 1
    );
    state.raycaster.setFromCamera(ndc, camera);

    // Intersect with horizontal plane at the anchor Y to get X/Z extents
    const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -state.tmpDraw.startY);
    const pXZ = new THREE.Vector3();
    if (!state.raycaster.ray.intersectPlane(plane, pXZ)) return;

    const p0 = state.tmpDraw.startPoint;
    // Width & depth from projected pointer on XZ plane
    const width = Math.max(0.001, Math.abs(pXZ.x - p0.x));
    const depth = Math.max(0.001, Math.abs(pXZ.z - p0.z));

    // Height from vertical screen delta (convert pixels → world units at anchor distance)
    const dy = e.clientY - state.tmpDraw.startScreen.y;
    const dist = camera.position.distanceTo(p0);
    const worldPerPixel = (2 * Math.tan((camera.fov * Math.PI / 180) / 2) * dist) / rect.height;
    const height = Math.max(0.001, Math.abs(dy) * worldPerPixel);

    // Determine min/max per axis using drag directions
    const minX = Math.min(p0.x, p0.x + (pXZ.x - p0.x));
    const maxX = Math.max(p0.x, p0.x + (pXZ.x - p0.x));
    const minZ = Math.min(p0.z, p0.z + (pXZ.z - p0.z));
    const maxZ = Math.max(p0.z, p0.z + (pXZ.z - p0.z));
    const minY = dy > 0 ? p0.y - height : p0.y;
    const maxY = dy > 0 ? p0.y : p0.y + height;

    // Update live mesh geometry & position
    const w = Math.max(0.001, maxX - minX);
    const h = Math.max(0.001, maxY - minY);
    const d = Math.max(0.001, maxZ - minZ);
    const cx = (minX + maxX) * 0.5;
    const cy = (minY + maxY) * 0.5;
    const cz = (minZ + maxZ) * 0.5;

    resizeBoxMesh(state.tmpDraw.liveMesh, w, h, d);
    state.tmpDraw.liveMesh.position.set(cx, cy, cz);

    e.preventDefault();
  }

  function onPointerUp(e) {
    if (state.longPressTimer) { clearTimeout(state.longPressTimer); state.longPressTimer = 0; }
    if (!state.tmpDraw.active) return;
    finalizeLiveBox();
  }

  function finalizeLiveBox() {
    const m = state.tmpDraw.liveMesh;
    if (!m) { state.tmpDraw.active = false; return; }
    const { x: cx, y: cy, z: cz } = m.position;
    const w = m.scale.x; const h = m.scale.y; const d = m.scale.z; // we store sizes in scale

    // Build a Box3 from the visual mesh extents
    const half = new THREE.Vector3(w / 2, h / 2, d / 2);
    const min = new THREE.Vector3(cx, cy, cz).sub(half);
    const max = new THREE.Vector3(cx, cy, cz).add(half);
    const newBox = new THREE.Box3(min, max);

    // Merge with existing
    mergeBoxIntoList(newBox, state.boxes);

    // Commit visuals: rebuild from box list; remove live mesh
    refreshBoxesVisual();

    state.tmpDraw.active = false;
    if (state.tmpDraw.liveMesh) {
      state.selectionGroup.remove(state.tmpDraw.liveMesh);
      disposeObject(state.tmpDraw.liveMesh);
      state.tmpDraw.liveMesh = null;
    }

    setCounter(state.boxes.length);
    eraseBtn.disabled = state.boxes.length === 0;
    hintEl.style.display = state.boxes.length ? 'none' : 'block';
  }

  // ----- Box management -----
  function mergeBoxIntoList(box, list) {
    // Merge overlapping boxes by union; keep iterating until stable
    let merged = box.clone();
    let changed = true;
    while (changed) {
      changed = false;
      for (let i = list.length - 1; i >= 0; i--) {
        const b = list[i];
        if (merged.intersectsBox(b) || merged.containsBox(b) || b.containsBox(merged)) {
          merged.union(b);
          list.splice(i, 1);
          changed = true;
        }
      }
    }
    list.push(merged);
  }

  function refreshBoxesVisual() {
    if (!state.selectionGroup) return;
    // Clear
    while (state.selectionGroup.children.length) {
      const c = state.selectionGroup.children.pop();
      disposeObject(c);
    }
    // Re-create visuals for persistent boxes
    for (const b of state.boxes) {
      const size = new THREE.Vector3();
      b.getSize(size);
      const center = new THREE.Vector3();
      b.getCenter(center);
      const box = makeBoxVisual(size.x, size.y, size.z, false);
      box.position.copy(center);
      state.selectionGroup.add(box);
    }
  }

  function makeBoxVisual(w, h, d, isLive) {
    // Store sizes in scale to allow cheap "resize"
    const geo = new THREE.BoxGeometry(1, 1, 1);
    const mat = new THREE.MeshBasicMaterial({
      color: isLive ? 0xff6666 : 0xff3333,
      transparent: true,
      opacity: isLive ? 0.25 : 0.25,
      depthWrite: false
    });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.renderOrder = 9999;

    // Edges outline
    const edges = new THREE.EdgesGeometry(geo);
    const line = new THREE.LineSegments(edges, new THREE.LineBasicMaterial({ color: 0xff7b7b, depthWrite: false }));
    mesh.add(line);

    mesh.scale.set(w, h, d);
    return mesh;
  }
  function resizeBoxMesh(mesh, w, h, d) {
    mesh.scale.set(Math.max(0.001, w), Math.max(0.001, h), Math.max(0.001, d));
    // child[0] is edges, uses same geometry; scaling affects both
  }

  function clearBoxes() {
    state.boxes.length = 0;
    refreshBoxesVisual();
    setCounter(0);
    eraseBtn.disabled = true;
    hintEl.style.display = 'block';
  }

  function setCounter(n) {
    counterEl.textContent = `${n} ${n === 1 ? 'box' : 'boxes'}`;
  }

  // ----- Erase core -----
  function showProgress(show, pct, label) {
    const wrap = document.getElementById('tf-me-progress');
    wrap.classList.toggle('show', !!show);
    if (show && typeof pct === 'number') {
      wrap.querySelector('.tf-me-fill').style.width = `${Math.max(0, Math.min(100, pct))}%`;
    }
    if (label) wrap.querySelector('.tf-me-status').textContent = label;
  }

  async function onErase() {
    if (!state.targetMesh || state.boxes.length === 0) return;
    try {
      showProgress(true, 0, 'Preparing…');
      await eraseGeometryInsideBoxes(state.targetMesh, state.boxes, (p, s) => showProgress(true, p, s));
      // Notify rest of app
      if (state.activeAsset?.id) {
        window.App.emit('asset:updated', { id: state.activeAsset.id });
      }
      showProgress(true, 100, 'Done');
      setTimeout(() => showProgress(false), 350);
    } catch (e) {
      console.error('[MeshEditor] Erase failed:', e);
      showProgress(true, 100, 'Error');
      setTimeout(() => showProgress(false), 650);
    } finally {
      // Close editor after erase, per spec
      api.close();
    }
  }

  async function eraseGeometryInsideBoxes(mesh, worldBoxes, progress) {
    const geoSrc = mesh.geometry;
    if (!geoSrc || !geoSrc.attributes?.position) throw new Error('Geometry missing');

    // Work with non-indexed for simpler face slicing
    let geo = geoSrc.index ? geoSrc.toNonIndexed() : geoSrc.clone();

    const pos = geo.attributes.position.array;
    const vertCount = geo.attributes.position.count;
    const triCount = vertCount / 3;

    // Prepare attribute copying
    const attrs = {};
    for (const key in geo.attributes) {
      attrs[key] = geo.attributes[key];
    }
    const attrKeys = Object.keys(attrs); // includes 'position', 'normal', 'uv', 'skinIndex', ...

    const accum = {};
    for (const k of attrKeys) accum[k] = [];

    // Precompute matrixWorld for transforming centroids to world
    mesh.updateMatrixWorld(true);
    const m = mesh.matrixWorld;

    // For each triangle, keep if centroid NOT inside any selection box
    const vA = new THREE.Vector3(), vB = new THREE.Vector3(), vC = new THREE.Vector3(), centroid = new THREE.Vector3();

    const chunk = 15000; // faces per chunk (mobile-safe)
    for (let t = 0; t < triCount; t++) {
      // positions are vec3 per vertex
      const iA = t * 3 + 0;
      const iB = t * 3 + 1;
      const iC = t * 3 + 2;

      vA.fromBufferAttribute(attrs.position, iA).applyMatrix4(m);
      vB.fromBufferAttribute(attrs.position, iB).applyMatrix4(m);
      vC.fromBufferAttribute(attrs.position, iC).applyMatrix4(m);
      centroid.set(
        (vA.x + vB.x + vC.x) / 3,
        (vA.y + vB.y + vC.y) / 3,
        (vA.z + vB.z + vC.z) / 3
      );

      let inside = false;
      for (let b = 0; b < worldBoxes.length; b++) {
        if (worldBoxes[b].containsPoint(centroid)) { inside = true; break; }
      }

      if (!inside) {
        // Push all vertex attributes for this face
        for (const key of attrKeys) {
          const a = attrs[key];
          const size = a.itemSize;
          // vA
          for (let k = 0; k < size; k++) accum[key].push(a.array[iA * size + k]);
          // vB
          for (let k = 0; k < size; k++) accum[key].push(a.array[iB * size + k]);
          // vC
          for (let k = 0; k < size; k++) accum[key].push(a.array[iC * size + k]);
        }
      }

      if ((t % chunk) === 0) {
        const pct = (t / triCount) * 100;
        progress?.(pct, `Processing ${t.toLocaleString()} / ${Math.floor(triCount).toLocaleString()} faces`);
        await idle(8);
      }
    }

    // Build new geometry (non-indexed)
    const newGeo = new THREE.BufferGeometry();
    for (const key of attrKeys) {
      const src = attrs[key];
      const ctor = src.array.constructor; // Float32Array, Uint16Array, etc.
      const arr = new ctor(accum[key]);
      newGeo.setAttribute(key, new THREE.BufferAttribute(arr, src.itemSize, src.normalized));
    }
    // Morph targets become invalid after deletion; drop them for safety
    newGeo.morphAttributes = {};
    newGeo.computeBoundingBox();
    newGeo.computeBoundingSphere();
    if (newGeo.attributes.normal) {
      newGeo.computeVertexNormals(); // cheap-ish; helps after holes
    }

    // Swap geometry on mesh
    geoSrc.dispose();
    mesh.geometry = newGeo;
    progress?.(99, 'Finalizing…');
    await idle(8);
  }

  // ----- Utils -----
  const idle = (ms = 12) => new Promise(r => (self.requestIdleCallback || setTimeout)(r, ms));

  function disposeObject(obj) {
    if (!obj) return;
    obj.traverse(o => {
      if (o.geometry) o.geometry.dispose?.();
      if (o.material) {
        if (Array.isArray(o.material)) o.material.forEach(m => m.dispose?.());
        else o.material.dispose?.();
      }
    });
  }
  function disposeGroup(g) {
    while (g.children.length) disposeObject(g.children.pop());
  }

  // ----- App wiring -----
  function handleAssetActivated(e) {
    state.activeAsset = e.detail || null;
  }

  // ----- Public API -----
  const api = {
    open: openForMesh,
    close: closeEditor
  };
  window.MeshEditor = api;

  // ----- Bootstrap -----
  function bootstrap() {
    injectUI();
    window.App?.on('asset:activated', handleAssetActivated);
    window.Debug?.log('Mesh Editor ready (touch box erase).');
  }

  if (window.App?.glVersion) bootstrap();
  else window.App?.on('app:booted', bootstrap);

})();