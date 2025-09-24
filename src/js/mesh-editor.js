// src/js/mesh-editor.js - In-viewer mesh geometry editor

(function() {
    'use strict';

    // --- Module State ---
    let originalMesh = null;        // The mesh being edited
    let originalGeometry = null;    // A backup of the geometry for 'cancel'
    let activeAssetId = null;       // The ID of the parent asset
    
    // --- MODIFICATION: Added references for new UI elements ---
    let toolbar, transformControls, selectionBox, sliderGroup, hSlider, vSlider;
    let isEditing = false;

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
                padding: 10px;
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
            #tf-mesh-editor-toolbar .tool-group { display: flex; gap: 10px; align-items: center; }
            .tf-editor-btn {
                padding: 8px 16px; font-size: 14px; font-weight: 600;
                border-radius: 6px; border: none; cursor: pointer;
            }
            .tf-editor-btn-primary { background: #00c853; color: #fff; }
            .tf-editor-btn-secondary { background: rgba(255,255,255,0.1); color: #fff; }

            .tf-toggle-row { display: flex; align-items: center; gap: 8px; }
            .tf-toggle-row label { color: #e6eef6; font-size: 15px; }

            /* --- MODIFICATION: CSS for new sliders --- */
            .slider-control { display: flex; align-items: center; gap: 5px; }
            .slider-control label { color: #a0a7b0; font-size: 12px; font-weight: bold; }
            #tf-mesh-editor-toolbar input[type=range] {
                width: 70px;
                -webkit-appearance: none;
                height: 4px;
                background: rgba(0,0,0,0.3);
                border-radius: 2px;
                vertical-align: middle;
            }
            #tf-mesh-editor-toolbar input[type=range]::-webkit-slider-thumb {
                -webkit-appearance: none;
                width: 14px;
                height: 14px;
                background: #fff;
                border-radius: 50%;
                cursor: pointer;
                border: 2px solid #2575fc;
            }
        `;
        document.head.appendChild(style);

        toolbar = document.createElement('div');
        toolbar.id = 'tf-mesh-editor-toolbar';
        // --- MODIFICATION: Added HTML for the slider group ---
        toolbar.innerHTML = `
            <div class="tool-group">
                <button id="editor-cancel-btn" class="tf-editor-btn tf-editor-btn-secondary">Cancel</button>
            </div>
            <div class="tool-group">
                <button id="editor-box-tool-btn" class="tf-editor-btn tf-editor-btn-secondary">Box Erase</button>
                <div id="editor-slider-group" style="display:none; align-items: center; gap: 10px; border-left: 1px solid rgba(255,255,255,0.1); padding-left: 10px;">
                    <div class="slider-control">
                        <label for="editor-scale-h">H</label>
                        <input type="range" id="editor-scale-h" min="0.01" max="3" step="0.01" value="1" title="Horizontal Size">
                    </div>
                    <div class="slider-control">
                        <label for="editor-scale-v">V</label>
                        <input type="range" id="editor-scale-v" min="0.01" max="3" step="0.01" value="1" title="Vertical Size">
                    </div>
                </div>
            </div>
            <div class="tool-group">
                <button id="editor-apply-box-btn" class="tf-editor-btn tf-editor-btn-primary" style="display:none;">Apply Box</button>
                <button id="editor-save-btn" class="tf-editor-btn tf-editor-btn-primary">Apply & Save</button>
            </div>
        `;
        document.getElementById('app').appendChild(toolbar);

        // --- MODIFICATION: Get references to new elements and add listeners ---
        sliderGroup = toolbar.querySelector('#editor-slider-group');
        hSlider = toolbar.querySelector('#editor-scale-h');
        vSlider = toolbar.querySelector('#editor-scale-v');

        hSlider.addEventListener('input', (e) => {
            if (selectionBox) {
                const value = parseFloat(e.target.value);
                selectionBox.scale.x = value;
                selectionBox.scale.z = value;
            }
        });

        vSlider.addEventListener('input', (e) => {
            if (selectionBox) {
                const value = parseFloat(e.target.value);
                selectionBox.scale.y = value;
            }
        });

        toolbar.querySelector('#editor-save-btn').addEventListener('click', () => close(true));
        toolbar.querySelector('#editor-cancel-btn').addEventListener('click', () => close(false));
        toolbar.querySelector('#editor-box-tool-btn').addEventListener('click', showSelectionBox);
        toolbar.querySelector('#editor-apply-box-btn').addEventListener('click', applyBoxErase);
    }

    async function open(mesh, assetId) {
        if (isEditing) return;
        isEditing = true;

        originalMesh = mesh;
        activeAssetId = assetId;

        originalGeometry = originalMesh.geometry.clone();

        if (window.Viewer && window.Viewer.controls) {
            window.Viewer.controls.enabled = false;
        }

        if (!transformControls) {
            const { TransformControls } = await import('three/addons/controls/TransformControls.js');
            transformControls = new TransformControls(window.Viewer.camera, window.Viewer.renderer.domElement);
            transformControls.addEventListener('dragging-changed', (event) => {
                if(window.Viewer.controls) window.Viewer.controls.enabled = !event.value;
            });
            window.Viewer.scene.add(transformControls);
        }

        toolbar.style.display = 'flex';
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
        
        if (selectionBox) {
            transformControls.detach();
            window.Viewer.scene.remove(selectionBox);
            selectionBox.geometry.dispose();
            selectionBox = null;
        }
        if(transformControls) transformControls.detach();
        
        // --- MODIFICATION: Hide slider and Apply button on close ---
        toolbar.querySelector('#editor-apply-box-btn').style.display = 'none';
        sliderGroup.style.display = 'none';

        if (window.Viewer && window.Viewer.controls) {
            window.Viewer.controls.enabled = true;
        }
        
        originalMesh = null;
        originalGeometry = null;
        activeAssetId = null;
        isEditing = false;
    }
    
    function showSelectionBox() {
        if (!selectionBox) {
            const { THREE } = window.Phonebook;
            const geo = new THREE.BoxGeometry(1, 1, 1);
            const mat = new THREE.MeshBasicMaterial({ color: 0x00c853, transparent: true, opacity: 0.3, wireframe: true });
            selectionBox = new THREE.Mesh(geo, mat);

            const meshBox = new THREE.Box3().setFromObject(originalMesh);
            selectionBox.position.copy(meshBox.getCenter(new THREE.Vector3()));
            const size = meshBox.getSize(new THREE.Vector3());
            // Start with a sensible default size
            selectionBox.scale.set(size.x * 0.5, size.y * 0.5, size.z * 0.5);
            window.Viewer.scene.add(selectionBox);
        }
        
        transformControls.attach(selectionBox);
        
        // --- MODIFICATION: Show sliders and sync their values ---
        toolbar.querySelector('#editor-apply-box-btn').style.display = 'inline-block';
        sliderGroup.style.display = 'flex';
        hSlider.value = selectionBox.scale.x;
        vSlider.value = selectionBox.scale.y;
    }

    function applyBoxErase() {
        if (!selectionBox || !originalMesh) return;
        
        const geometry = originalMesh.geometry;
        const vertices = geometry.attributes.position;
        
        const facesToDelete = new Set();
        const boxMatrixInverse = selectionBox.matrixWorld.clone().invert();
        const tempVertex = new window.Phonebook.THREE.Vector3();

        for (let i = 0; i < vertices.count; i++) {
            tempVertex.fromBufferAttribute(vertices, i);
            tempVertex.applyMatrix4(originalMesh.matrixWorld);
            tempVertex.applyMatrix4(boxMatrixInverse);

            if (Math.abs(tempVertex.x) <= 0.5 && Math.abs(tempVertex.y) <= 0.5 && Math.abs(tempVertex.z) <= 0.5) {
                if (geometry.index) {
                    for (let j = 0; j < geometry.index.count; j += 3) {
                        if (geometry.index.getX(j) === i || geometry.index.getY(j) === i || geometry.index.getZ(j) === i) {
                            facesToDelete.add(j / 3);
                        }
                    }
                }
            }
        }

        if (facesToDelete.size > 0) {
            deleteFaces(Array.from(facesToDelete));
        }

        toolbar.querySelector('#editor-apply-box-btn').style.display = 'none';
        sliderGroup.style.display = 'none'; // --- MODIFICATION: Hide sliders after applying
        transformControls.detach();
    }

    function deleteFaces(faceIndices) {
        const oldGeo = originalMesh.geometry;
        if (!oldGeo.index) {
            console.warn("Delete faces is only supported for indexed geometry.");
            return;
        }
        const facesToDelete = new Set(faceIndices);

        const oldIndices = oldGeo.index.array;
        const newIndices = [];

        for (let i = 0; i < oldIndices.length; i += 3) {
            if (!facesToDelete.has(i / 3)) {
                newIndices.push(oldIndices[i], oldIndices[i+1], oldIndices[i+2]);
            }
        }
        
        const newGeo = new window.Phonebook.THREE.BufferGeometry();
        newGeo.setAttribute('position', oldGeo.attributes.position);
        if(oldGeo.attributes.normal) newGeo.setAttribute('normal', oldGeo.attributes.normal);
        if(oldGeo.attributes.uv) newGeo.setAttribute('uv', oldGeo.attributes.uv);
        newGeo.setIndex(newIndices);
        
        originalMesh.geometry.dispose();
        originalMesh.geometry = newGeo;
        window.Debug?.log(`Erased ${facesToDelete.size} faces.`);
    }

    function bootstrap() {
        if (window.MeshEditor) return;
        injectUI();
        window.MeshEditor = {
            open,
        };
        window.Debug?.log('In-Viewer Mesh Editor module ready.');
    }

    if (window.App?.glVersion) bootstrap();
    else window.App?.on('app:booted', bootstrap);

})();
