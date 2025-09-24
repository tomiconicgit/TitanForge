// src/js/mesh-editor.js - In-viewer mesh geometry editor

(function() {
    'use strict';

    // --- Module State ---
    let originalMesh = null;
    let originalGeometry = null;  // Backup of the original geometry
    let originalMaterial = null;  // Backup of the original material
    let activeAssetId = null;
    
    let toolbar, lockCameraButton, eraserSizeSlider;
    let isEditing = false;
    let isCameraLocked = false;
    let isErasing = false;
    
    // --- UI Injection ---
    function injectUI() {
        const style = document.createElement('style');
        style.textContent = `
            #tf-mesh-editor-toolbar {
                position: fixed;
                bottom: 80px; left: 16px; right: 16px;
                z-index: 20; padding: 12px;
                background: rgba(28, 38, 50, 0.9);
                backdrop-filter: blur(10px); -webkit-backdrop-filter: blur(10px);
                border: 1px solid rgba(255, 255, 255, 0.1);
                border-radius: 8px;
                display: none; justify-content: space-between; align-items: center; gap: 10px;
            }
            .editor-tool-group { display: flex; gap: 15px; align-items: center; }
            .tf-editor-btn {
                padding: 8px 16px; font-size: 14px; font-weight: 600;
                border-radius: 6px; border: none; cursor: pointer;
            }
            .tf-editor-btn-primary { background: #00c853; color: #fff; }
            .tf-editor-btn-secondary { background: rgba(255,255,255,0.1); color: #fff; }
            #lock-camera-btn.locked { background: #c62828; }

            .slider-control { display: flex; align-items: center; gap: 8px; }
            .slider-control label { color: #a0a7b0; font-size: 14px; }
            #tf-mesh-editor-toolbar input[type=range] {
                width: 120px; -webkit-appearance: none;
                height: 4px; background: rgba(0,0,0,0.3);
                border-radius: 2px; vertical-align: middle;
            }
            #tf-mesh-editor-toolbar input[type=range]::-webkit-slider-thumb {
                -webkit-appearance: none; width: 16px; height: 16px;
                background: #fff; border-radius: 50%;
                cursor: pointer; border: 2px solid #2575fc;
            }
        `;
        document.head.appendChild(style);

        toolbar = document.createElement('div');
        toolbar.id = 'tf-mesh-editor-toolbar';
        toolbar.innerHTML = `
            <button id="editor-cancel-btn" class="tf-editor-btn tf-editor-btn-secondary">Cancel</button>
            <div class="editor-tool-group">
                <button id="lock-camera-btn" class="tf-editor-btn tf-editor-btn-secondary">Lock Camera</button>
                <div class="slider-control">
                    <label for="eraser-size-slider">Size</label>
                    <input type="range" id="eraser-size-slider" min="0.01" max="0.2" step="0.005" value="0.05" title="Eraser Size">
                </div>
            </div>
            <button id="editor-save-btn" class="tf-editor-btn tf-editor-btn-primary">Apply & Save</button>
        `;
        document.getElementById('app').appendChild(toolbar);

        lockCameraButton = toolbar.querySelector('#lock-camera-btn');
        eraserSizeSlider = toolbar.querySelector('#eraser-size-slider');

        toolbar.querySelector('#editor-save-btn').addEventListener('click', () => close(true));
        toolbar.querySelector('#editor-cancel-btn').addEventListener('click', () => close(false));
        lockCameraButton.addEventListener('click', toggleCameraLock);
    }

    // --- Core Editor Logic ---
    function open(mesh, assetId) {
        if (isEditing) return;
        const { THREE } = window.Phonebook;
        isEditing = true;

        originalMesh = mesh;
        activeAssetId = assetId;
        
        // --- MODIFICATION: The "Paint to Erase" Setup ---
        // 1. Backup original geometry and material
        originalGeometry = originalMesh.geometry.clone();
        originalMaterial = Array.isArray(originalMesh.material) 
            ? originalMesh.material.map(m => m.clone()) 
            : originalMesh.material.clone();

        // 2. Create a temporary editing geometry
        const editGeometry = originalGeometry.clone();

        // 3. Add vertex colors to it, defaulting to white (the "keep" color)
        if (!editGeometry.attributes.color) {
            const colors = new Float32Array(editGeometry.attributes.position.count * 3);
            colors.fill(1.0); // Fill with white
            editGeometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
        }

        // 4. Create a temporary editing material that uses vertex colors
        const editMaterial = Array.isArray(originalMaterial) 
            ? originalMaterial.map(m => { m.vertexColors = true; return m; })
            : (originalMaterial.vertexColors = true, originalMaterial);

        // 5. Apply the temporary assets to the mesh for the editing session
        originalMesh.geometry = editGeometry;
        originalMesh.material = editMaterial;
        
        toolbar.style.display = 'flex';
        
        const viewerEl = window.Viewer.renderer.domElement;
        viewerEl.addEventListener('pointerdown', onPointerDown, { passive: false });
        viewerEl.addEventListener('pointermove', onPointerMove, { passive: false });
        viewerEl.addEventListener('pointerup', onPointerUp, { passive: false });
    }

    function close(shouldSaveChanges) {
        if (!isEditing) return;

        if (shouldSaveChanges) {
            // Finalize the deletion based on the red "paint mask"
            const finalGeometry = createFinalGeometry();
            originalMesh.geometry.dispose(); // Dispose of the temp geometry with colors
            originalMesh.geometry = finalGeometry;
            originalMesh.material = originalMaterial; // Restore original material

            App.emit('asset:updated', { id: activeAssetId });
            window.Debug?.log('Mesh edits applied.');
        } else {
            // User cancelled, restore the backups
            originalMesh.geometry.dispose();
            originalMesh.geometry = originalGeometry;
            originalMesh.material = originalMaterial;
            window.Debug?.log('Mesh edits cancelled.');
        }
        
        toolbar.style.display = 'none';
        
        if (isCameraLocked) toggleCameraLock();

        const viewerEl = window.Viewer.renderer.domElement;
        viewerEl.removeEventListener('pointerdown', onPointerDown);
        viewerEl.removeEventListener('pointermove', onPointerMove);
        viewerEl.removeEventListener('pointerup', onPointerUp);
        
        originalMesh = null;
        originalGeometry = null;
        originalMaterial = null;
        activeAssetId = null;
        isEditing = false;
    }

    function toggleCameraLock() {
        isCameraLocked = !isCameraLocked;
        if (window.Viewer && window.Viewer.controls) {
            window.Viewer.controls.enabled = !isCameraLocked;
        }
        lockCameraButton.classList.toggle('locked', isCameraLocked);
        lockCameraButton.textContent = isCameraLocked ? 'Unlock Camera' : 'Lock Camera';
    }

    // --- Brush Erasing Implementation ---
    function onPointerDown(event) {
        if (isCameraLocked && event.isPrimary) {
            event.preventDefault();
            isErasing = true;
            paintEraseMask(event);
        }
    }

    function onPointerMove(event) {
        if (isCameraLocked && isErasing && event.isPrimary) {
            event.preventDefault();
            paintEraseMask(event);
        }
    }

    function onPointerUp(event) {
        if (event.isPrimary) {
            isErasing = false;
        }
    }

    // --- MODIFICATION: This function now "paints" vertices red instead of deleting ---
    function paintEraseMask(event) {
        if (!originalMesh) return;
        const { THREE } = window.Phonebook;

        const pointer = new THREE.Vector2();
        const rect = window.Viewer.renderer.domElement.getBoundingClientRect();
        pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
        pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

        const raycaster = new THREE.Raycaster();
        raycaster.setFromCamera(pointer, window.Viewer.camera);

        const intersects = raycaster.intersectObject(originalMesh);
        if (intersects.length === 0) return;

        const intersectionPoint = intersects[0].point;
        const eraseRadius = parseFloat(eraserSizeSlider.value);
        const geometry = originalMesh.geometry;
        const positions = geometry.attributes.position;
        const colors = geometry.attributes.color;
        const tempVertex = new THREE.Vector3();
        const redColor = new THREE.Color(0xff0000);
        let colorsChanged = false;

        for (let i = 0; i < positions.count; i++) {
            tempVertex.fromBufferAttribute(positions, i).applyMatrix4(originalMesh.matrixWorld);

            if (tempVertex.distanceTo(intersectionPoint) < eraseRadius) {
                // If the vertex color is not already red, change it
                if (colors.getX(i) !== 1 || colors.getY(i) !== 0 || colors.getZ(i) !== 0) {
                     colors.setXYZ(i, redColor.r, redColor.g, redColor.b);
                     colorsChanged = true;
                }
            }
        }
        
        if (colorsChanged) {
            colors.needsUpdate = true;
        }
    }
    
    // This function runs ONCE on save to build the final geometry
    function createFinalGeometry() {
        const { THREE } = window.Phonebook;
        const editGeo = originalMesh.geometry;
        const facesToDelete = new Set();
        
        // Find which faces to delete based on the red vertex color mask
        const colors = editGeo.attributes.color;
        for (let i = 0; i < editGeo.index.count; i += 3) {
            const vA = editGeo.index.getX(i);
            const vB = editGeo.index.getX(i + 1);
            const vC = editGeo.index.getX(i + 2);
            // If all 3 vertices of a face are red, mark it for deletion
            if (colors.getX(vA) === 1 && colors.getX(vB) === 1 && colors.getX(vC) === 1) {
                facesToDelete.add(i / 3);
            }
        }
        
        // If no faces are marked, just return the original geometry
        if (facesToDelete.size === 0) {
            return originalGeometry.clone();
        }

        // --- The robust geometry reconstruction logic from before ---
        const oldIndices = editGeo.index.array;
        const keptVertexIndices = new Set();
        for (let i = 0; i < oldIndices.length; i += 3) {
            if (!facesToDelete.has(i / 3)) {
                keptVertexIndices.add(oldIndices[i]);
                keptVertexIndices.add(oldIndices[i + 1]);
                keptVertexIndices.add(oldIndices[i + 2]);
            }
        }

        const newGeo = new THREE.BufferGeometry();
        const vertexMap = new Map();
        
        for (const attrName in originalGeometry.attributes) {
            if (attrName === 'color') continue; // Don't copy the color attribute to the final geometry
            const oldAttr = originalGeometry.attributes[attrName];
            const newAttrArray = new Float32Array(keptVertexIndices.size * oldAttr.itemSize);
            let newVIndex = 0;
            keptVertexIndices.forEach(oldVIndex => {
                if (!vertexMap.has(oldVIndex)) {
                    vertexMap.set(oldVIndex, newVIndex);
                    for (let j = 0; j < oldAttr.itemSize; j++) {
                        newAttrArray[newVIndex * oldAttr.itemSize + j] = oldAttr.array[oldVIndex * oldAttr.itemSize + j];
                    }
                    newVIndex++;
                }
            });
            newGeo.setAttribute(attrName, new THREE.BufferAttribute(newAttrArray, oldAttr.itemSize));
        }

        const newIndicesArray = [];
        const newGroups = [];
        originalGeometry.groups.forEach(group => {
            const newGroup = { start: newIndicesArray.length, count: 0, materialIndex: group.materialIndex };
            for (let i = group.start; i < group.start + group.count; i += 3) {
                if (!facesToDelete.has(i / 3)) {
                    newIndicesArray.push(vertexMap.get(oldIndices[i]));
                    newIndicesArray.push(vertexMap.get(oldIndices[i + 1]));
                    newIndicesArray.push(vertexMap.get(oldIndices[i + 2]));
                    newGroup.count += 3;
                }
            }
            if (newGroup.count > 0) {
                newGroups.push(newGroup);
            }
        });
        newGeo.groups = newGroups;
        newGeo.setIndex(newIndicesArray);
        
        return newGeo;
    }


    function bootstrap() {
        if (window.MeshEditor) return;
        injectUI();
        window.MeshEditor = { open };
        window.Debug?.log('In-Viewer Mesh Editor module ready.');
    }

    if (window.App?.glVersion) bootstrap();
    else window.App?.on('app:booted', bootstrap);

})();
