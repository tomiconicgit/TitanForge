// src/js/mesh-editor.js - In-viewer mesh geometry editor

(function() {
    'use strict';

    // --- Module State ---
    let originalMesh = null;
    let originalGeometry = null;
    let activeAssetId = null;
    
    // --- MODIFICATION: Added references for new UI elements ---
    let toolbar, transformControls, selectionBox;
    let toolSettings, hSlider, vSlider, xSlider, ySlider, zSlider;
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
                /* --- MODIFICATION: New layout using column flex --- */
                flex-direction: column;
                gap: 8px;
            }
            .editor-toolbar-row {
                display: flex;
                width: 100%;
                justify-content: space-between;
                align-items: center;
                gap: 10px;
            }
            #editor-tool-settings {
                flex-grow: 1;
                display: flex;
                justify-content: center;
                gap: 15px;
            }
            .tf-editor-btn {
                padding: 8px 16px; font-size: 14px; font-weight: 600;
                border-radius: 6px; border: none; cursor: pointer;
            }
            .tf-editor-btn-primary { background: #00c853; color: #fff; }
            .tf-editor-btn-secondary { background: rgba(255,255,255,0.1); color: #fff; }

            .slider-control { display: flex; align-items: center; gap: 5px; }
            .slider-control label { color: #a0a7b0; font-size: 12px; font-weight: bold; width: 15px; text-align: center; }
            #tf-mesh-editor-toolbar input[type=range] {
                width: 80px;
                -webkit-appearance: none;
                height: 4px;
                background: rgba(0,0,0,0.3);
                border-radius: 2px;
                vertical-align: middle;
            }
            #tf-mesh-editor-toolbar input[type=range]::-webkit-slider-thumb {
                -webkit-appearance: none;
                width: 14px; height: 14px;
                background: #fff;
                border-radius: 50%;
                cursor: pointer;
                border: 2px solid #2575fc;
            }
        `;
        document.head.appendChild(style);

        toolbar = document.createElement('div');
        toolbar.id = 'tf-mesh-editor-toolbar';
        // --- MODIFICATION: New HTML structure for rows and all sliders ---
        toolbar.innerHTML = `
            <div class="editor-toolbar-row">
                 <button id="editor-box-tool-btn" class="tf-editor-btn tf-editor-btn-secondary">Show Erase Box</button>
                 <div id="editor-tool-settings" style="display:none;">
                    <div class="slider-control">
                        <label>H</label>
                        <input type="range" id="editor-scale-h" min="0.01" max="5" step="0.01" value="1" title="Horizontal Size">
                    </div>
                    <div class="slider-control">
                        <label>V</label>
                        <input type="range" id="editor-scale-v" min="0.01" max="5" step="0.01" value="1" title="Vertical Size">
                    </div>
                    <div class="slider-control">
                        <label>X</label>
                        <input type="range" id="editor-pos-x" min="-5" max="5" step="0.01" value="0" title="Left/Right Position">
                    </div>
                    <div class="slider-control">
                        <label>Y</label>
                        <input type="range" id="editor-pos-y" min="-5" max="5" step="0.01" value="0" title="Up/Down Position">
                    </div>
                    <div class="slider-control">
                        <label>Z</label>
                        <input type="range" id="editor-pos-z" min="-5" max="5" step="0.01" value="0" title="Forward/Back Position">
                    </div>
                 </div>
                 <button id="editor-apply-box-btn" class="tf-editor-btn tf-editor-btn-primary" style="display:none;">Apply Box</button>
            </div>
            <div class="editor-toolbar-row" style="border-top: 1px solid rgba(255,255,255,0.1); padding-top: 8px;">
                <button id="editor-cancel-btn" class="tf-editor-btn tf-editor-btn-secondary">Cancel</button>
                <div style="flex-grow: 1;"></div>
                <button id="editor-save-btn" class="tf-editor-btn tf-editor-btn-primary">Apply & Save</button>
            </div>
        `;
        document.getElementById('app').appendChild(toolbar);

        toolSettings = toolbar.querySelector('#editor-tool-settings');
        hSlider = toolbar.querySelector('#editor-scale-h');
        vSlider = toolbar.querySelector('#editor-scale-v');
        xSlider = toolbar.querySelector('#editor-pos-x');
        ySlider = toolbar.querySelector('#editor-pos-y');
        zSlider = toolbar.querySelector('#editor-pos-z');

        hSlider.addEventListener('input', e => { if (selectionBox) { selectionBox.scale.x = selectionBox.scale.z = parseFloat(e.target.value); } });
        vSlider.addEventListener('input', e => { if (selectionBox) { selectionBox.scale.y = parseFloat(e.target.value); } });
        xSlider.addEventListener('input', e => { if (selectionBox) { selectionBox.position.x = parseFloat(e.target.value); } });
        ySlider.addEventListener('input', e => { if (selectionBox) { selectionBox.position.y = parseFloat(e.target.value); } });
        zSlider.addEventListener('input', e => { if (selectionBox) { selectionBox.position.z = parseFloat(e.target.value); } });

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
            
            // --- MODIFICATION: Sync sliders when gizmo is moved ---
            transformControls.addEventListener('objectChange', () => {
                if (selectionBox) {
                    hSlider.value = selectionBox.scale.x;
                    vSlider.value = selectionBox.scale.y;
                    xSlider.value = selectionBox.position.x;
                    ySlider.value = selectionBox.position.y;
                    zSlider.value = selectionBox.position.z;
                }
            });

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
        
        toolbar.querySelector('#editor-apply-box-btn').style.display = 'none';
        toolSettings.style.display = 'none';

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
            // --- MODIFICATION: New material for the selection box ---
            const geo = new THREE.BoxGeometry(1, 1, 1);
            const mat = new THREE.MeshBasicMaterial({ color: 0xff0000, transparent: true, opacity: 0.5 });
            selectionBox = new THREE.Mesh(geo, mat);
            window.Viewer.scene.add(selectionBox);
        }
        
        // Center the box on the mesh and reset its local position
        const meshBox = new window.Phonebook.THREE.Box3().setFromObject(originalMesh);
        selectionBox.position.copy(meshBox.getCenter(new window.Phonebook.THREE.Vector3()));
        selectionBox.scale.set(1,1,1); // Start with a default scale
        
        // This moves the box to the mesh center, so its local transforms should be reset
        selectionBox.translateX(0); selectionBox.translateY(0); selectionBox.translateZ(0);
        
        transformControls.attach(selectionBox);
        
        toolbar.querySelector('#editor-apply-box-btn').style.display = 'inline-block';
        toolSettings.style.display = 'flex';

        // --- MODIFICATION: Sync all sliders to the box's initial state ---
        hSlider.value = selectionBox.scale.x;
        vSlider.value = selectionBox.scale.y;
        xSlider.value = 0;
        ySlider.value = 0;
        zSlider.value = 0;
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
        toolSettings.style.display = 'none';
        transformControls.detach();
    }

    function deleteFaces(faceIndices) {
        const oldGeo = originalMesh.geometry;
        if (!oldGeo.index) { return; }
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
        window.MeshEditor = { open };
        window.Debug?.log('In-Viewer Mesh Editor module ready.');
    }

    if (window.App?.glVersion) bootstrap();
    else window.App?.on('app:booted', bootstrap);

})();
