// src/js/mesh-editor.js - In-viewer mesh geometry editor

(function() {
    'use strict';

    // --- Module State ---
    let originalMesh = null;
    let originalGeometry = null;
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
                bottom: 80px;
                left: 16px;
                right: 16px;
                z-index: 20;
                padding: 12px;
                background: rgba(28, 38, 50, 0.9);
                backdrop-filter: blur(10px);
                -webkit-backdrop-filter: blur(10px);
                border: 1px solid rgba(255, 255, 255, 0.1);
                border-radius: 8px;
                display: none;
                justify-content: space-between;
                align-items: center;
                gap: 10px;
            }
            .editor-tool-group {
                display: flex;
                gap: 15px;
                align-items: center;
            }
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
        // --- MODIFICATION: Adjusted eraser slider range for finer control ---
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
    async function open(mesh, assetId) {
        if (isEditing) return;
        isEditing = true;

        originalMesh = mesh;
        activeAssetId = assetId;
        originalGeometry = originalMesh.geometry.clone();

        toolbar.style.display = 'flex';
        
        const viewerEl = window.Viewer.renderer.domElement;
        viewerEl.addEventListener('pointerdown', onPointerDown);
        viewerEl.addEventListener('pointermove', onPointerMove);
        viewerEl.addEventListener('pointerup', onPointerUp);
    }

    function close(shouldSaveChanges) {
        if (!isEditing) return;

        if (shouldSaveChanges) {
            if(originalGeometry) originalGeometry.dispose();
            App.emit('asset:updated', { id: activeAssetId });
            window.Debug?.log('Mesh edits applied.');
        } else {
            if (originalMesh && originalGeometry) {
                originalMesh.geometry.dispose();
                originalMesh.geometry = originalGeometry;
                window.Debug?.log('Mesh edits cancelled.');
            }
        }
        
        toolbar.style.display = 'none';
        
        if (isCameraLocked) toggleCameraLock();

        const viewerEl = window.Viewer.renderer.domElement;
        viewerEl.removeEventListener('pointerdown', onPointerDown);
        viewerEl.removeEventListener('pointermove', onPointerMove);
        viewerEl.removeEventListener('pointerup', onPointerUp);
        
        originalMesh = null;
        originalGeometry = null;
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
            isErasing = true;
            // Erase on first touch as well as on drag
            eraseAtPoint(event);
        }
    }

    function onPointerMove(event) {
        if (isCameraLocked && isErasing && event.isPrimary) {
            eraseAtPoint(event);
        }
    }

    function onPointerUp(event) {
        if (event.isPrimary) {
            isErasing = false;
        }
    }

    // --- MODIFICATION: Rewritten brush erase logic for precision ---
    function eraseAtPoint(event) {
        if (!originalMesh) return;
        const { THREE } = window.Phonebook;

        const pointer = new THREE.Vector2();
        const rect = window.Viewer.renderer.domElement.getBoundingClientRect();
        // Calculate pointer position relative to the canvas
        pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
        pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

        const raycaster = new THREE.Raycaster();
        raycaster.setFromCamera(pointer, window.Viewer.camera);

        const intersects = raycaster.intersectObject(originalMesh);

        if (intersects.length > 0) {
            const intersectionPoint = intersects[0].point; // This is in world space
            const eraseRadius = parseFloat(eraserSizeSlider.value);
            
            const geometry = originalMesh.geometry;
            const facesToDelete = new Set();
            const tempVertex = new THREE.Vector3();

            // Instead of checking every vertex, we check every face.
            // This is more accurate for a brush-like effect.
            if (geometry.index) {
                for (let i = 0; i < geometry.index.count; i += 3) {
                    const vA = geometry.index.getX(i);
                    const vB = geometry.index.getX(i + 1);
                    const vC = geometry.index.getX(i + 2);

                    // Check if any of the face's three vertices are within the brush radius
                    tempVertex.fromBufferAttribute(geometry.attributes.position, vA).applyMatrix4(originalMesh.matrixWorld);
                    if (tempVertex.distanceTo(intersectionPoint) < eraseRadius) {
                        facesToDelete.add(i / 3);
                        continue; // No need to check other vertices of this face
                    }

                    tempVertex.fromBufferAttribute(geometry.attributes.position, vB).applyMatrix4(originalMesh.matrixWorld);
                    if (tempVertex.distanceTo(intersectionPoint) < eraseRadius) {
                        facesToDelete.add(i / 3);
                        continue;
                    }

                    tempVertex.fromBufferAttribute(geometry.attributes.position, vC).applyMatrix4(originalMesh.matrixWorld);
                    if (tempVertex.distanceTo(intersectionPoint) < eraseRadius) {
                        facesToDelete.add(i / 3);
                    }
                }
            }

            if (facesToDelete.size > 0) {
                deleteFaces(Array.from(facesToDelete));
            }
        }
    }
    
    // This function correctly rebuilds geometry while preserving materials/textures.
    function deleteFaces(faceIndices) {
        const { THREE } = window.Phonebook;
        const oldGeo = originalMesh.geometry;
        const facesToDelete = new Set(faceIndices);

        if (!oldGeo.index) {
            console.warn("Erase tool only supports indexed geometry.");
            return;
        }

        const oldIndices = oldGeo.index.array;
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
        
        for (const attrName in oldGeo.attributes) {
            const oldAttr = oldGeo.attributes[attrName];
            const newAttrArray = new Float32Array(keptVertexIndices.size * oldAttr.itemSize);
            let newIndex = 0;
            keptVertexIndices.forEach(oldIndex => {
                if (!vertexMap.has(oldIndex)) {
                    vertexMap.set(oldIndex, newIndex);
                    for (let i = 0; i < oldAttr.itemSize; i++) {
                        newAttrArray[newIndex * oldAttr.itemSize + i] = oldAttr.array[oldIndex * oldAttr.itemSize + i];
                    }
                    newIndex++;
                }
            });
            newGeo.setAttribute(attrName, new THREE.BufferAttribute(newAttrArray, oldAttr.itemSize));
        }

        const newIndicesArray = [];
        const newGroups = [];
        oldGeo.groups.forEach(group => {
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
        
        originalMesh.geometry.dispose();
        originalMesh.geometry = newGeo;
        // No console log here to avoid flooding during drag
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
