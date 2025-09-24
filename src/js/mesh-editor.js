// src/js/mesh-editor.js - In-viewer mesh geometry editor

(function() {
    'use strict';

    // --- Module State ---
    let originalMesh = null;        // The mesh being edited
    let originalGeometry = null;    // A backup of the geometry for 'cancel'
    let activeAssetId = null;       // The ID of the parent asset
    
    let toolbar, transformControls, selectionBox;
    let isEditing = false;

    // --- UI Injection ---
    function injectUI() {
        const style = document.createElement('style');
        style.textContent = `
            /* This is now a floating toolbar, not a full-screen modal */
            #tf-mesh-editor-toolbar {
                position: fixed;
                bottom: 80px; /* Position it above the lower nav panels */
                left: 16px;
                right: 16px;
                z-index: 20; /* Above nav panels but below modals */
                
                padding: 10px;
                background: rgba(28, 38, 50, 0.9);
                backdrop-filter: blur(10px);
                -webkit-backdrop-filter: blur(10px);
                border: 1px solid rgba(255, 255, 255, 0.1);
                border-radius: 8px;
                
                display: none; /* Hidden by default */
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
        `;
        document.head.appendChild(style);

        toolbar = document.createElement('div');
        toolbar.id = 'tf-mesh-editor-toolbar';
        toolbar.innerHTML = `
            <div class="tool-group">
                <button id="editor-cancel-btn" class="tf-editor-btn tf-editor-btn-secondary">Cancel</button>
            </div>
            <div class="tool-group">
                <div class="tf-toggle-row">
                    <label>Erase Mode</label>
                </div>
                <button id="editor-box-tool-btn" class="tf-editor-btn tf-editor-btn-secondary">Box Erase</button>
                <button id="editor-apply-box-btn" class="tf-editor-btn tf-editor-btn-primary" style="display:none;">Apply Box</button>
            </div>
            <div class="tool-group">
                <button id="editor-save-btn" class="tf-editor-btn tf-editor-btn-primary">Apply & Save</button>
            </div>
        `;
        document.getElementById('app').appendChild(toolbar);

        // --- Event Listeners ---
        toolbar.querySelector('#editor-save-btn').addEventListener('click', () => close(true));
        toolbar.querySelector('#editor-cancel-btn').addEventListener('click', () => close(false));
        toolbar.querySelector('#editor-box-tool-btn').addEventListener('click', showSelectionBox);
        toolbar.querySelector('#editor-apply-box-btn').addEventListener('click', applyBoxErase);
    }

    // --- Core Editor Logic ---
    async function open(mesh, assetId) {
        if (isEditing) return; // Prevent opening multiple edit sessions
        isEditing = true;

        originalMesh = mesh;
        activeAssetId = assetId;

        // CRITICAL: Create a backup of the geometry for the cancel/undo functionality.
        originalGeometry = originalMesh.geometry.clone();

        // Disable main viewer controls so we can use the editor tools
        if (window.Viewer && window.Viewer.controls) {
            window.Viewer.controls.enabled = false;
        }

        // Setup TransformControls for the selection box
        if (!transformControls) {
            const { TransformControls } = await import('three/addons/controls/TransformControls.js');
            transformControls = new TransformControls(window.Viewer.camera, window.Viewer.renderer.domElement);
            transformControls.addEventListener('dragging-changed', (event) => {
                // While dragging the box, keep main controls disabled
                if(window.Viewer.controls) window.Viewer.controls.enabled = !event.value;
            });
            window.Viewer.scene.add(transformControls);
        }

        toolbar.style.display = 'flex';
    }

    function close(shouldSaveChanges) {
        if (!isEditing) return;

        if (shouldSaveChanges) {
            // The geometry on originalMesh is already the edited version.
            // We just need to dispose of the backup.
            if(originalGeometry) originalGeometry.dispose();
            
            // Notify other modules that the mesh has changed
            App.emit('asset:updated', { id: activeAssetId });
            window.Debug?.log('Mesh edits applied.');

        } else {
            // User cancelled. Restore the backup geometry.
            if (originalMesh && originalGeometry) {
                originalMesh.geometry.dispose(); // Dispose of the edited, unsaved geometry
                originalMesh.geometry = originalGeometry; // Restore the backup
                window.Debug?.log('Mesh edits cancelled.');
            }
        }
        
        // --- Universal Cleanup ---
        toolbar.style.display = 'none';
        
        // Clean up selection box and transform controls
        if (selectionBox) {
            transformControls.detach();
            window.Viewer.scene.remove(selectionBox);
            selectionBox.geometry.dispose();
            selectionBox = null;
        }
        if(transformControls) transformControls.detach();
        toolbar.querySelector('#editor-apply-box-btn').style.display = 'none';

        // Re-enable main viewer controls
        if (window.Viewer && window.Viewer.controls) {
            window.Viewer.controls.enabled = true;
        }
        
        // Reset state
        originalMesh = null;
        originalGeometry = null;
        activeAssetId = null;
        isEditing = false;
    }
    
    // --- Tool Implementation ---
    function showSelectionBox() {
        if (selectionBox) { // If box already exists, just re-attach controls
             transformControls.attach(selectionBox);
             return;
        };
        const { THREE } = window.Phonebook;

        const geo = new THREE.BoxGeometry(1, 1, 1);
        const mat = new THREE.MeshBasicMaterial({ color: 0x00c853, transparent: true, opacity: 0.3, wireframe: true });
        selectionBox = new THREE.Mesh(geo, mat);

        const meshBox = new THREE.Box3().setFromObject(originalMesh);
        selectionBox.position.copy(meshBox.getCenter(new THREE.Vector3()));
        const size = meshBox.getSize(new THREE.Vector3());
        selectionBox.scale.set(size.x * 0.5, size.y * 0.5, size.z * 0.5);

        window.Viewer.scene.add(selectionBox);
        transformControls.attach(selectionBox);
        toolbar.querySelector('#editor-apply-box-btn').style.display = 'inline-block';
    }

    function applyBoxErase() {
        if (!selectionBox || !originalMesh) return;
        
        // The mesh being edited is now originalMesh directly
        const geometry = originalMesh.geometry;
        const vertices = geometry.attributes.position;
        
        const facesToDelete = new Set();
        const boxMatrixInverse = selectionBox.matrixWorld.clone().invert();
        const tempVertex = new window.Phonebook.THREE.Vector3();

        for (let i = 0; i < vertices.count; i++) {
            tempVertex.fromBufferAttribute(vertices, i);
            tempVertex.applyMatrix4(originalMesh.matrixWorld); // From mesh's local to world space
            tempVertex.applyMatrix4(boxMatrixInverse); // From world space to box's local space

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
        
        originalMesh.geometry.dispose(); // Dispose of the old geometry with all faces
        originalMesh.geometry = newGeo; // Assign the new, smaller geometry
        window.Debug?.log(`Erased ${facesToDelete.size} faces.`);
    }

    // --- Public API ---
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
