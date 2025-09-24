// src/js/mesh-editor.js — Touch-first mesh eraser (hold+drag boxes → erase)
(function () {
  'use strict';

  if (window.MeshEditor) return;

  // This 'scope' object will hold all module-level variables.
  // We populate it safely inside the bootstrap function to avoid race conditions.
  const scope = {
    THREE: null,
    state: {
      activeAsset: null,
      targetMesh: null,
      isOpen: false,
      isLockOrbit: false,
      isDrawing: false,
      boxes: [],
      selectionGroup: null,
      tmpDraw: {
        active: false,
        startPoint: null, // Will be initialized as a Vector3
        startScreen: { x: 0, y: 0 },
        startY: 0,
        liveMesh: null
      },
      longPressTimer: 0,
      raycaster: null
    },
    panel: null,
    lockCheckbox: null,
    eraseBtn: null,
    clearBtn: null,
    closeBtn: null,
    counterEl: null,
    hintEl: null,
    elCanvas: null,
  };

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
      .tf-pill{ color:#a0a7b0; font-size:12px; padding:4px 8px; border-radius:999px; background:rgba(255,255,255,.08); }
      .tf-switch{ position:relative; width:30px; height:16px; flex-shrink:0; }
      .tf-switch input{ display:none; }
      .tf-slider{ position:absolute; inset:0; background:rgba(255,255,255,.2); border-radius:16px; transition:.2s; }
      .tf-slider:before{ content:""; position:absolute; width:12px; height:12px; left:2px; bottom:2px; background:#fff; border-radius:50%; transition:.2s; }
      input:checked + .tf-slider{ background:#00c853; }
      input:checked + .tf-slider:before{ transform:translateX(14px); }
      .tf-buttons{ display:flex; gap:8px; }
      .tf-btn{ flex:1; padding:9px 10px; border:none; border-radius:6px; color:#fff; cursor:pointer; background:rgba(255,255,255,.1); font-weight:600; font-size:14px; }
      #tf-me-erase{ background:#c62828; }
      #tf-me-erase:disabled{ opacity:.5; cursor:not-allowed; }
      #tf-me-hint{ color:#a0a7b0; font-size:12px; line-height:1.35; }
      #tf-me-counter{ font-size:12px; color:#a0a7b0; }
      #tf-me-progress{ position:fixed; inset:0; z-index:1001; display:none; align-items:center; justify-content:center; background:rgba(0,0,0,.6); backdrop-filter:blur(4px); }
      #tf-me-progress.show{ display:flex; }
      .tf-me-progress-card{ width:min(340px,90vw); padding:24px; border-radius:12px; background:rgba(28,32,38,.95); border:1px solid rgba(255,255,255,.12); color:#e6eef6; display:flex; flex-direction:column; gap:12px; }
      .tf-me-bar{ width:100%; height:10px; background:rgba(255,255,255,.12); border-radius:6px; overflow:hidden; }
      .tf-me-fill{ width:0%; height:100%; background:linear-gradient(90deg,#6a11cb,#2575fc); transition:width .15s; }
      .tf-me-status{ font-size:13px; color:#a0a7b0; height:16px; }
    `;
    document.head.appendChild(style);

    scope.panel = document.createElement('div');
    scope.panel.id = 'tf-mesh-editor-panel';
    scope.panel.innerHTML = `
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
    document.getElementById('app')?.appendChild(scope.panel);

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

    scope.lockCheckbox = scope.panel.querySelector('#tf-me-lock');
    scope.eraseBtn = scope.panel.querySelector('#tf-me-erase');
    scope.clearBtn = scope.panel.querySelector('#tf-me-clear');
    scope.closeBtn = scope.panel.querySelector('#tf-me-close');
    scope.counterEl = scope.panel.querySelector('#tf-me-counter');
    scope.hintEl = scope.panel.querySelector('#tf-me-hint');

    scope.lockCheckbox.addEventListener('change', onLockChange);
    scope.clearBtn.addEventListener('click', clearBoxes);
    scope.eraseBtn.addEventListener('click', onErase);
    scope.closeBtn.addEventListener('click', () => window.MeshEditor.close());
  }

  function openForMesh(mesh) {
    if (!scope.THREE) return;
    if (!mesh || !(mesh.isMesh || mesh.isSkinnedMesh)) {
      alert('Select a mesh to edit.');
      return;
    }
    const state = scope.state;
    state.targetMesh = mesh;
    if (!state.selectionGroup) {
      state.selectionGroup = new scope.THREE.Group();
      state.selectionGroup.name = 'MeshEditorSelections';
      window.Viewer.scene.add(state.selectionGroup);
    }
    state.boxes.length = 0;
    refreshBoxesVisual();
    setCounter(0);
    scope.eraseBtn.disabled = true;
    scope.hintEl.style.display = 'block';
    scope.panel.classList.add('show');
    state.isOpen = true;
    wirePointer();
    window.Debug?.log('[MeshEditor] Opened for mesh: ' + (mesh.name || mesh.uuid));
  }

  function closeEditor() {
    const state = scope.state;
    unWirePointer();
    if (state.selectionGroup) {
      window.Viewer.scene.remove(state.selectionGroup);
      disposeGroup(state.selectionGroup);
      state.selectionGroup = null;
    }
    state.boxes.length = 0;
    state.targetMesh = null;
    state.isOpen = false;
    scope.lockCheckbox.checked = false;
    setLock(false);
    scope.panel.classList.remove('show');
    window.Debug?.log('[MeshEditor] Closed.');
  }

  function onLockChange(e) { setLock(e.target.checked); }

  function setLock(locked) {
    scope.state.isLockOrbit = !!locked;
    const controls = window.Viewer?.controls;
    if (controls) controls.enabled = !locked;
  }

  function wirePointer() {
    scope.elCanvas = window.Viewer?.renderer?.domElement || null;
    if (!scope.elCanvas) return;
    const state = scope.state;
    state.raycaster = state.raycaster || new scope.THREE.Raycaster();
    scope.elCanvas.addEventListener('pointerdown', onPointerDown, { passive: false });
    window.addEventListener('pointermove', onPointerMove, { passive: false });
    window.addEventListener('pointerup', onPointerUp, { passive: false });
  }

  function unWirePointer() {
    if (!scope.elCanvas) return;
    scope.elCanvas.removeEventListener('pointerdown', onPointerDown);
    window.removeEventListener('pointermove', onPointerMove);
    window.removeEventListener('pointerup', onPointerUp);
    scope.elCanvas = null;
  }

  function onPointerDown(e) {
    const state = scope.state;
    if (!state.isOpen || !state.isLockOrbit || !state.targetMesh) return;
    if (state.longPressTimer) clearTimeout(state.longPressTimer);
    const start = { x: e.clientX, y: e.clientY };
    state.longPressTimer = setTimeout(() => {
      beginDraw(e, start);
    }, 120);
  }

  function beginDraw(e, start) {
    const state = scope.state;
    const { camera } = window.Viewer;
    const { width, height } = scope.elCanvas.getBoundingClientRect();
    const ndc = new scope.THREE.Vector2(
      ((e.clientX - scope.elCanvas.getBoundingClientRect().left) / width) * 2 - 1,
      -((e.clientY - scope.elCanvas.getBoundingClientRect().top) / height) * 2 + 1
    );
    state.raycaster.setFromCamera(ndc, camera);
    let anchorPoint = new scope.THREE.Vector3();
    const hits = state.raycaster.intersectObject(state.targetMesh, true);
    if (hits && hits.length) {
      anchorPoint.copy(hits[0].point);
    } else {
      const plane = new scope.THREE.Plane(new scope.THREE.Vector3(0, 1, 0), 0);
      const pt = new scope.THREE.Vector3();
      if (!state.raycaster.ray.intersectPlane(plane, pt)) return;
      anchorPoint.copy(pt);
    }
    state.tmpDraw.active = true;
    state.tmpDraw.startPoint.copy(anchorPoint);
    state.tmpDraw.startScreen = { x: start.x, y: start.y };
    state.tmpDraw.startY = anchorPoint.y;
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
    const state = scope.state;
    if (!state.tmpDraw.active || !state.isLockOrbit || !state.targetMesh) return;
    const { camera } = window.Viewer;
    const rect = scope.elCanvas.getBoundingClientRect();
    const ndc = new scope.THREE.Vector2(
      ((e.clientX - rect.left) / rect.width) * 2 - 1,
      -((e.clientY - rect.top) / rect.height) * 2 + 1
    );
    state.raycaster.setFromCamera(ndc, camera);
    const plane = new scope.THREE.Plane(new scope.THREE.Vector3(0, 1, 0), -state.tmpDraw.startY);
    const pXZ = new scope.THREE.Vector3();
    if (!state.raycaster.ray.intersectPlane(plane, pXZ)) return;
    const p0 = state.tmpDraw.startPoint;
    const dy = e.clientY - state.tmpDraw.startScreen.y;
    const dist = camera.position.distanceTo(p0);
    const worldPerPixel = (2 * Math.tan((camera.fov * Math.PI / 180) / 2) * dist) / rect.height;
    const minX = Math.min(p0.x, p0.x + (pXZ.x - p0.x));
    const maxX = Math.max(p0.x, p0.x + (pXZ.x - p0.x));
    const minZ = Math.min(p0.z, p0.z + (pXZ.z - p0.z));
    const maxZ = Math.max(p0.z, p0.z + (pXZ.z - p0.z));
    const minY = dy > 0 ? p0.y - (Math.abs(dy) * worldPerPixel) : p0.y;
    const maxY = dy > 0 ? p0.y : p0.y + (Math.abs(dy) * worldPerPixel);
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
    const state = scope.state;
    if (state.longPressTimer) { clearTimeout(state.longPressTimer); state.longPressTimer = 0; }
    if (!state.tmpDraw.active) return;
    finalizeLiveBox();
  }

  function finalizeLiveBox() {
    const state = scope.state;
    const m = state.tmpDraw.liveMesh;
    if (!m) { state.tmpDraw.active = false; return; }
    const { x: cx, y: cy, z: cz } = m.position;
    const w = m.scale.x; const h = m.scale.y; const d = m.scale.z;
    const half = new scope.THREE.Vector3(w / 2, h / 2, d / 2);
    const min = new scope.THREE.Vector3(cx, cy, cz).sub(half);
    const max = new scope.THREE.Vector3(cx, cy, cz).add(half);
    const newBox = new scope.THREE.Box3(min, max);
    mergeBoxIntoList(newBox, state.boxes);
    refreshBoxesVisual();
    state.tmpDraw.active = false;
    if (state.tmpDraw.liveMesh) {
      state.selectionGroup.remove(state.tmpDraw.liveMesh);
      disposeObject(state.tmpDraw.liveMesh);
      state.tmpDraw.liveMesh = null;
    }
    setCounter(state.boxes.length);
    scope.eraseBtn.disabled = state.boxes.length === 0;
    scope.hintEl.style.display = state.boxes.length ? 'none' : 'block';
  }

  function mergeBoxIntoList(box, list) {
    let merged = box.clone();
    let changed = true;
    while (changed) {
      changed = false;
      for (let i = list.length - 1; i >= 0; i--) {
        const b = list[i];
        if (merged.intersectsBox(b)) {
          merged.union(b);
          list.splice(i, 1);
          changed = true;
        }
      }
    }
    list.push(merged);
  }

  function refreshBoxesVisual() {
    const state = scope.state;
    if (!state.selectionGroup) return;
    while (state.selectionGroup.children.length) {
      const c = state.selectionGroup.children.pop();
      disposeObject(c);
    }
    for (const b of state.boxes) {
      const size = new scope.THREE.Vector3();
      b.getSize(size);
      const center = new scope.THREE.Vector3();
      b.getCenter(center);
      const box = makeBoxVisual(size.x, size.y, size.z, false);
      box.position.copy(center);
      state.selectionGroup.add(box);
    }
  }

  function makeBoxVisual(w, h, d, isLive) {
    const geo = new scope.THREE.BoxGeometry(1, 1, 1);
    const mat = new scope.THREE.MeshBasicMaterial({ color: isLive ? 0xff6666 : 0xff3333, transparent: true, opacity: 0.25, depthWrite: false });
    const mesh = new scope.THREE.Mesh(geo, mat);
    mesh.renderOrder = 9999;
    const edges = new scope.THREE.EdgesGeometry(geo);
    const line = new scope.THREE.LineSegments(edges, new scope.THREE.LineBasicMaterial({ color: 0xff7b7b, depthWrite: false }));
    mesh.add(line);
    mesh.scale.set(w, h, d);
    return mesh;
  }

  function resizeBoxMesh(mesh, w, h, d) {
    mesh.scale.set(Math.max(0.001, w), Math.max(0.001, h), Math.max(0.001, d));
  }

  function clearBoxes() {
    scope.state.boxes.length = 0;
    refreshBoxesVisual();
    setCounter(0);
    scope.eraseBtn.disabled = true;
    scope.hintEl.style.display = 'block';
  }

  function setCounter(n) {
    scope.counterEl.textContent = `${n} ${n === 1 ? 'box' : 'boxes'}`;
  }

  function showProgress(show, pct, label) {
    const wrap = document.getElementById('tf-me-progress');
    wrap.classList.toggle('show', !!show);
    if (show && typeof pct === 'number') {
      wrap.querySelector('.tf-me-fill').style.width = `${Math.max(0, Math.min(100, pct))}%`;
    }
    if (label) wrap.querySelector('.tf-me-status').textContent = label;
  }

  async function onErase() {
    const state = scope.state;
    if (!state.targetMesh || state.boxes.length === 0) return;
    try {
      showProgress(true, 0, 'Preparing…');
      await eraseGeometryInsideBoxes(state.targetMesh, state.boxes, (p, s) => showProgress(true, p, s));
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
      window.MeshEditor.close();
    }
  }

  async function eraseGeometryInsideBoxes(mesh, worldBoxes, progress) {
    const geoSrc = mesh.geometry;
    if (!geoSrc || !geoSrc.attributes?.position) throw new Error('Geometry missing');
    let geo = geoSrc.index ? geoSrc.toNonIndexed() : geoSrc.clone();
    const vertCount = geo.attributes.position.count;
    const triCount = vertCount / 3;
    const attrs = geo.attributes;
    const attrKeys = Object.keys(attrs);
    const accum = {};
    for (const k of attrKeys) accum[k] = [];
    mesh.updateMatrixWorld(true);
    const m = mesh.matrixWorld;
    const vA = new scope.THREE.Vector3(), vB = new scope.THREE.Vector3(), vC = new scope.THREE.Vector3(), centroid = new scope.THREE.Vector3();
    const chunk = 15000;
    for (let t = 0; t < triCount; t++) {
      const iA = t * 3, iB = t * 3 + 1, iC = t * 3 + 2;
      vA.fromBufferAttribute(attrs.position, iA).applyMatrix4(m);
      vB.fromBufferAttribute(attrs.position, iB).applyMatrix4(m);
      vC.fromBufferAttribute(attrs.position, iC).applyMatrix4(m);
      centroid.set((vA.x + vB.x + vC.x) / 3, (vA.y + vB.y + vC.y) / 3, (vA.z + vB.z + vC.z) / 3);
      let inside = worldBoxes.some(box => box.containsPoint(centroid));
      if (!inside) {
        for (const key of attrKeys) {
          const a = attrs[key];
          const size = a.itemSize;
          for (let k = 0; k < size; k++) accum[key].push(a.array[iA * size + k]);
          for (let k = 0; k < size; k++) accum[key].push(a.array[iB * size + k]);
          for (let k = 0; k < size; k++) accum[key].push(a.array[iC * size + k]);
        }
      }
      if ((t % chunk) === 0) {
        progress?.((t / triCount) * 100, `Processing ${t.toLocaleString()} / ${Math.floor(triCount).toLocaleString()} faces`);
        await idle(8);
      }
    }
    const newGeo = new scope.THREE.BufferGeometry();
    for (const key of attrKeys) {
      const src = attrs[key];
      newGeo.setAttribute(key, new scope.THREE.BufferAttribute(new src.array.constructor(accum[key]), src.itemSize, src.normalized));
    }
    newGeo.morphAttributes = {};
    if (newGeo.attributes.normal) newGeo.computeVertexNormals();
    geoSrc.dispose();
    mesh.geometry = newGeo;
    progress?.(99, 'Finalizing…');
    await idle(8);
  }

  const idle = (ms = 12) => new Promise(r => (self.requestIdleCallback || setTimeout)(r, ms));

  function disposeObject(obj) {
    if (!obj) return;
    obj.traverse(o => {
      if (o.geometry) o.geometry.dispose?.();
      if (o.material) {
        (Array.isArray(o.material) ? o.material : [o.material]).forEach(m => m.dispose?.());
      }
    });
  }

  function disposeGroup(g) {
    while (g.children.length) disposeObject(g.children.pop());
  }

  // ----- Public API -----
  window.MeshEditor = {
    open: openForMesh,
    close: closeEditor
  };

  // ----- Bootstrap -----
  function bootstrap() {
    if (!window.Phonebook || !window.Phonebook.THREE) {
      console.error("MeshEditor could not initialize: THREE.js not found in Phonebook.");
      return;
    }
    // Safely populate the scope with dependencies now that the app is ready.
    scope.THREE = window.Phonebook.THREE;
    scope.state.tmpDraw.startPoint = new scope.THREE.Vector3();

    injectUI();
    window.App?.on('asset:activated', (e) => {
      scope.state.activeAsset = e.detail || null;
    });
    window.Debug?.log('Mesh Editor ready (robust).');
  }

  if (window.App?.glVersion) {
    bootstrap();
  } else {
    window.App?.on('app:booted', bootstrap);
  }
})();
