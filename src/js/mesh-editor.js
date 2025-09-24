// src/js/mesh-editor.js — Slider-based mesh eraser
(function () {
  'use strict';

  if (window.MeshEditor) return;

  // This 'scope' object will hold all module-level variables,
  // populated safely inside the bootstrap function to avoid race conditions.
  const scope = {
    THREE: null,
    state: {
      activeAsset: null,
      targetMesh: null,
      isOpen: false,
      previewBox: null,     // The live box controlled by sliders
      boxes: [],            // The array of committed THREE.Box3 for erasure
      selectionGroup: null, // Holds visuals for both preview and committed boxes
    },
    panel: null,
    // Add other UI elements to scope as needed
  };

  // --- UI Injection ---
  function injectUI() {
    const style = document.createElement('style');
    style.textContent = `
      #tf-mesh-editor-panel {
        position: fixed;
        bottom: 383px;
        left: 16px;
        z-index: 26;
        width: 280px;
        background: rgba(28, 32, 38, 0.9);
        backdrop-filter: blur(10px); -webkit-backdrop-filter: blur(10px);
        border: 1px solid rgba(255, 255, 255, 0.1);
        border-radius: 8px;
        box-shadow: 0 8px 25px rgba(0, 0, 0, 0.4);
        display: none;
        flex-direction: column;
        gap: 12px;
        padding: 12px;
        color: #e6eef6;
      }
      #tf-mesh-editor-panel.show { display: flex; }
      .tf-me-header { display: flex; justify-content: space-between; align-items: center; font-weight: 600; }
      .tf-me-pill { font-size: 12px; padding: 4px 8px; border-radius: 999px; background: rgba(255,255,255,.08); color: #a0a7b0; }
      .tf-me-sliders { display: flex; flex-direction: column; gap: 8px; }
      .tf-me-slider-group { display: grid; grid-template-columns: 20px 1fr 50px; align-items: center; gap: 8px; }
      .tf-me-slider-group label { font-size: 13px; color: #a0a7b0; }
      .tf-me-slider-group input[type=range] { width: 100%; margin: 0; }
      .tf-me-slider-group input[type=number] { width: 100%; padding: 2px; font-size: 12px; background: #111; border: 1px solid #444; color: #fff; border-radius: 3px; text-align: center; }
      .tf-me-actions { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-top: 8px; }
      .tf-me-actions button { padding: 9px 10px; border: none; border-radius: 6px; color: #fff; cursor: pointer; background: rgba(255,255,255,.1); font-weight: 600; font-size: 14px; }
      .tf-me-actions .primary { background: #2575fc; }
      .tf-me-actions .danger { background: #c62828; }
      .tf-me-actions button:disabled { opacity:.5; cursor:not-allowed; }
    `;
    document.head.appendChild(style);

    scope.panel = document.createElement('div');
    scope.panel.id = 'tf-mesh-editor-panel';
    scope.panel.innerHTML = `
      <div class="tf-me-header">
        <span>Mesh Editor</span>
        <div id="tf-me-counter" class="tf-me-pill">0 boxes</div>
      </div>
      <div class="tf-me-sliders">
        <div class="tf-me-slider-group" data-control="posX"><label>X</label><input type="range" min="-5" max="5" step="0.05" value="0"><input type="number" step="0.05" value="0"></div>
        <div class="tf-me-slider-group" data-control="posY"><label>Y</label><input type="range" min="-5" max="5" step="0.05" value="0"><input type="number" step="0.05" value="0"></div>
        <div class="tf-me-slider-group" data-control="posZ"><label>Z</label><input type="range" min="-5" max="5" step="0.05" value="0"><input type="number" step="0.05" value="0"></div>
        <div class="tf-me-slider-group" data-control="sizeW"><label>W</label><input type="range" min="0.1" max="10" step="0.05" value="1"><input type="number" step="0.05" value="1"></div>
        <div class="tf-me-slider-group" data-control="sizeH"><label>H</label><input type="range" min="0.1" max="10" step="0.05" value="1"><input type="number" step="0.05" value="1"></div>
        <div class="tf-me-slider-group" data-control="sizeD"><label>D</label><input type="range" min="0.1" max="10" step="0.05" value="1"><input type="number" step="0.05" value="1"></div>
      </div>
      <div class="tf-me-actions">
        <button id="tf-me-add" class="primary">Add Box</button>
        <button id="tf-me-clear">Clear All</button>
      </div>
       <div class="tf-me-actions">
         <button id="tf-me-erase" class="danger" disabled>Erase Selection</button>
         <button id="tf-me-close">Close</button>
      </div>
    `;
    document.getElementById('app')?.appendChild(scope.panel);
  }

  // --- Core Module Logic ---

  function openForMesh(mesh) {
    if (!scope.THREE) return;
    if (!mesh || !(mesh.isMesh || mesh.isSkinnedMesh)) {
      alert('Select a valid mesh to edit.');
      return;
    }

    const state = scope.state;
    state.targetMesh = mesh;

    // Create the selection group if it doesn't exist
    if (!state.selectionGroup) {
      state.selectionGroup = new scope.THREE.Group();
      state.selectionGroup.name = 'MeshEditorSelections';
      window.Viewer.scene.add(state.selectionGroup);
    }
    
    // Create the preview box
    if (!state.previewBox) {
        state.previewBox = makeBoxVisual(1, 1, 1, true); // isLive = true for preview color
        state.selectionGroup.add(state.previewBox);
    }

    // Position the initial preview box based on the target mesh
    const box = new scope.THREE.Box3().setFromObject(state.targetMesh);
    const center = box.getCenter(new scope.THREE.Vector3());
    const size = box.getSize(new scope.THREE.Vector3());

    state.previewBox.position.copy(center);
    state.previewBox.scale.set(
        Math.max(0.1, size.x * 0.5),
        Math.max(0.1, size.y * 0.5),
        Math.max(0.1, size.z * 0.5)
    );
    state.previewBox.visible = true;

    syncSlidersToPreviewBox();
    clearBoxes(false); // false = don't reset the preview box
    scope.panel.classList.add('show');
    state.isOpen = true;
  }

  function closeEditor() {
    const state = scope.state;
    if (state.previewBox) state.previewBox.visible = false;
    scope.panel.classList.remove('show');
    state.isOpen = false;
    state.targetMesh = null;
    clearBoxes(true); // true = reset everything
  }

  // --- UI & State Sync ---

  function syncSlidersToPreviewBox() {
    if (!scope.state.previewBox) return;
    const { position, scale } = scope.state.previewBox;
    updateSlider('posX', position.x);
    updateSlider('posY', position.y);
    updateSlider('posZ', position.z);
    updateSlider('sizeW', scale.x);
    updateSlider('sizeH', scale.y);
    updateSlider('sizeD', scale.d);
  }

  function updateSlider(controlName, value) {
      const group = scope.panel.querySelector(`[data-control="${controlName}"]`);
      if (group) {
          group.querySelector('input[type=range]').value = value;
          group.querySelector('input[type=number]').value = Number(value).toFixed(2);
      }
  }

  function handleSliderInput(e) {
    const group = e.target.closest('.tf-me-slider-group');
    if (!group || !scope.state.previewBox) return;

    const control = group.dataset.control;
    let value = parseFloat(e.target.value);
    if (isNaN(value)) return;
    
    // Sync the other input in the group
    if (e.target.type === 'range') {
        group.querySelector('input[type=number]').value = Number(value).toFixed(2);
    } else {
        group.querySelector('input[type=range]').value = value;
    }
    
    // Apply the change to the preview box
    switch (control) {
        case 'posX': scope.state.previewBox.position.x = value; break;
        case 'posY': scope.state.previewBox.position.y = value; break;
        case 'posZ': scope.state.previewBox.position.z = value; break;
        case 'sizeW': scope.state.previewBox.scale.x = Math.max(0.01, value); break;
        case 'sizeH': scope.state.previewBox.scale.y = Math.max(0.01, value); break;
        case 'sizeD': scope.state.previewBox.scale.z = Math.max(0.01, value); break;
    }
  }

  // --- Box Management ---

  function onAddBox() {
    const { previewBox, boxes } = scope.state;
    if (!previewBox) return;

    const box = new scope.THREE.Box3();
    box.setFromCenterAndSize(previewBox.position, previewBox.scale);
    
    mergeBoxIntoList(box, boxes);
    refreshBoxesVisual();
    
    scope.panel.querySelector('#tf-me-erase').disabled = boxes.length === 0;
  }

  function clearBoxes(resetPreview = true) {
    scope.state.boxes.length = 0;
    refreshBoxesVisual(); // This clears the committed visuals
    if (resetPreview && scope.state.previewBox) {
        scope.state.previewBox.visible = false;
    }
  }

  function refreshBoxesVisual() {
    const { selectionGroup, boxes, previewBox } = scope.state;
    if (!selectionGroup) return;

    // Clear all children except the previewBox
    for (let i = selectionGroup.children.length - 1; i >= 0; i--) {
        const child = selectionGroup.children[i];
        if (child !== previewBox) {
            disposeObject(child);
            selectionGroup.remove(child);
        }
    }

    // Re-create visuals for committed boxes
    boxes.forEach(box => {
      const size = box.getSize(new scope.THREE.Vector3());
      const center = box.getCenter(new scope.THREE.Vector3());
      const visual = makeBoxVisual(size.x, size.y, size.z, false); // isLive = false
      visual.position.copy(center);
      selectionGroup.add(visual);
    });
    
    scope.panel.querySelector('#tf-me-counter').textContent = `${boxes.length} ${boxes.length === 1 ? 'box' : 'boxes'}`;
    scope.panel.querySelector('#tf-me-erase').disabled = boxes.length === 0;
  }
  
  function makeBoxVisual(w, h, d, isLive) {
    const color = isLive ? 0x25a2fc : 0xff3333; // Blue for preview, Red for committed
    const geo = new scope.THREE.BoxGeometry(1, 1, 1);
    const mat = new scope.THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.3, depthWrite: false });
    const mesh = new scope.THREE.Mesh(geo, mat);
    const edges = new scope.THREE.EdgesGeometry(geo);
    const line = new scope.THREE.LineSegments(edges, new scope.THREE.LineBasicMaterial({ color: 0xffffff, depthWrite: false }));
    mesh.add(line);
    mesh.scale.set(w, h, d);
    return mesh;
  }

  // (The rest of the functions like onErase, eraseGeometryInsideBoxes, mergeBoxIntoList, etc., remain the same as they deal with the underlying data, not the UI interaction)

  const idle = (ms = 12) => new Promise(r => (self.requestIdleCallback || setTimeout)(r, ms));
  
  function disposeObject(obj) {
    if (!obj) return;
    obj.traverse(o => {
      if (o.geometry) o.geometry.dispose?.();
      if (o.material) { (Array.isArray(o.material) ? o.material : [o.material]).forEach(m => m.dispose?.()); }
    });
  }

  function mergeBoxIntoList(box, list) {
    let merged = box.clone();
    let changed = true;
    while (changed) {
      changed = false;
      for (let i = list.length - 1; i >= 0; i--) {
        if (merged.intersectsBox(list[i])) {
          merged.union(list[i]);
          list.splice(i, 1);
          changed = true;
        }
      }
    }
    list.push(merged);
  }
  
  async function onErase() {
    const {targetMesh, boxes, activeAsset} = scope.state;
    if (!targetMesh || boxes.length === 0) return;
    const progEl = document.getElementById('tf-me-progress');
    const showProgress = (show, pct, label) => {
        progEl.classList.toggle('show', !!show);
        if (show && typeof pct === 'number') { progEl.querySelector('.tf-me-fill').style.width = `${pct}%`; }
        if (label) { progEl.querySelector('.tf-me-status').textContent = label; }
    };

    try {
      showProgress(true, 0, 'Preparing…');
      await eraseGeometryInsideBoxes(targetMesh, boxes, showProgress);
      if (activeAsset?.id) { window.App.emit('asset:updated', { id: activeAsset.id }); }
      showProgress(true, 100, 'Done');
      setTimeout(() => showProgress(false), 350);
    } catch (e) {
      console.error('[MeshEditor] Erase failed:', e);
      showProgress(true, 100, 'Error');
      setTimeout(() => showProgress(false), 650);
    } finally {
      closeEditor();
    }
  }

  async function eraseGeometryInsideBoxes(mesh, worldBoxes, progress) {
    const geoSrc = mesh.geometry;
    if (!geoSrc || !geoSrc.attributes?.position) throw new Error('Geometry missing');
    let geo = geoSrc.index ? geoSrc.toNonIndexed() : geoSrc.clone();
    const triCount = geo.attributes.position.count / 3;
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
      if (!worldBoxes.some(box => box.containsPoint(centroid))) {
        for (const key of attrKeys) {
          const a = attrs[key];
          const size = a.itemSize;
          for (let k = 0; k < size; k++) accum[key].push(a.array[iA * size + k]);
          for (let k = 0; k < size; k++) accum[key].push(a.array[iB * size + k]);
          for (let k = 0; k < size; k++) accum[key].push(a.array[iC * size + k]);
        }
      }
      if (t > 0 && (t % chunk) === 0) {
        progress?.((t / triCount) * 100, `Processing face ${t.toLocaleString()}`);
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

  // ----- Public API -----
  window.MeshEditor = {
    open: openForMesh,
    close: closeEditor
  };

  // ----- Bootstrap -----
  function bootstrap() {
    if (!window.Phonebook || !window.Phonebook.THREE) {
      console.error("MeshEditor could not initialize: THREE.js not found.");
      return;
    }
    scope.THREE = window.Phonebook.THREE;
    injectUI();

    // Event Listeners
    scope.panel.addEventListener('input', handleSliderInput);
    scope.panel.querySelector('#tf-me-add').addEventListener('click', onAddBox);
    scope.panel.querySelector('#tf-me-clear').addEventListener('click', () => clearBoxes(true));
    scope.panel.querySelector('#tf-me-erase').addEventListener('click', onErase);
    scope.panel.querySelector('#tf-me-close').addEventListener('click', closeEditor);

    window.App?.on('asset:activated', (e) => {
      scope.state.activeAsset = e.detail || null;
      if (scope.state.isOpen) closeEditor(); // Close editor if active asset changes
    });
    window.Debug?.log('Mesh Editor ready (Slider UI).');
  }

  if (window.App?.glVersion) {
    bootstrap();
  } else {
    window.App?.on('app:booted', bootstrap);
  }
})();
