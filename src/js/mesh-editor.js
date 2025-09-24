// src/js/mesh-editor.js - Modal-based mesh geometry editor

(function() {
    'use strict';

    // --- Module State ---
    let originalMesh = null; // The mesh from the main scene
    let editMesh = null;     // A clone of the mesh for editing
    let activeAssetId = null; // The ID of the parent asset
    let modal, renderer, scene, camera, controls, transformControls, selectionBox;
    let eraseMode = false;
    let rafId = null;

    // --- UI & Scene Injection ---
    function injectUI() {
        const style = document.createElement('style');
        style.textContent = `
            #tf-mesh-editor-modal {
                position: fixed; inset: 0; z-index: 2000;
                background: rgba(13, 16, 20, 0.9);
                display: none; flex-direction: column;
            }
            #tf-mesh-editor-canvas-container {
                flex-grow: 1; position: relative;
            }
            #tf-mesh-editor-toolbar {
                flex-shrink: 0; padding: 10px; background: #1C2026;
                display: flex; justify-content: space-between; align-items: center; gap: 10px;
            }
            #tf-mesh-editor-toolbar .tool-group { display: flex; gap: 10px; align-items: center; }
            .tf-editor-btn {
                padding: 8px 16px; font-size: 14px; font-weight: 600;
                border-radius: 6px; border: none; cursor: pointer;
            }
            .tf-editor-btn-primary { background: #00c853; color: #fff; }
            .tf-editor-btn-secondary { background: rgba(255,255,255,0.1); color: #fff; }
            .tf-editor-btn-danger { background: #c62828; color: #fff; }

            /* Re-using toggle switch styles */
            .tf-toggle-row { display: flex; align-items: center; gap: 8px; }
            .tf-toggle-row label { color: #e6eef6; font-size: 15px; }
        `;
        document.head.appendChild(style);

        modal = document.createElement('div');
        modal.id = 'tf-mesh-editor-modal';
        modal.innerHTML = `
            <div id="tf-mesh-editor-canvas-container"></div>
            <div id="tf-mesh-editor-toolbar">
                <div class="tool-group">
                    <button id="editor-cancel-btn" class="tf-editor-btn tf-editor-btn-secondary">Cancel</button>
                </div>
                <div class="tool-group">
                    <div class="tf-toggle-row">
                        <label for="editor-erase-toggle">Erase Mode</label>
                        <label class="tf-switch">
                            <input type="checkbox" id="editor-erase-toggle">
                            <span class="tf-slider"></span>
                        </label>
                    </div>
                    <button id="editor-box-tool-btn" class="tf-editor-btn tf-editor-btn-secondary" style="display:none;">Box Erase</button>
                    <button id="editor-apply-box-btn" class="tf-editor-btn tf-editor-btn-primary" style="display:none;">Apply Box</button>
                </div>
                <div class="tool-group">
                    <button id="editor-save-btn" class="tf-editor-btn tf-editor-btn-primary">Apply & Save</button>
                </div>
            </div>
        `;
        document.body.appendChild(modal);

        // --- Event Listeners ---
        document.getElementById('editor-save-btn').addEventListener('click', saveChanges);
        document.getElementById('editor-cancel-btn').addEventListener('click', close);
        document.getElementById('editor-erase-toggle').addEventListener('change', toggleEraseMode);
        document.getElementById('editor-box-tool-btn').addEventListener('click', showSelectionBox);
        document.getElementById('editor-apply-box-btn').addEventListener('click', applyBoxErase);
    }

    // --- 3D Scene Setup for Modal ---
    // MODIFICATION: Added 'async' keyword to the function declaration.
    async function setupScene() {
        const { THREE } = window.Phonebook;
        const container = document.getElementById('tf-mesh-editor-canvas-container');

        // Scene
        scene = new THREE.Scene();
        scene.background = new THREE.Color(0x22272e);

        // Camera
        camera = new THREE.PerspectiveCamera(50, container.clientWidth / container.clientHeight, 0.1, 100);
        camera.position.set(0, 1, 3);

        // Renderer
        renderer = new THREE.WebGLRenderer({ antialias: true });
        renderer.setSize(container.clientWidth, container.clientHeight);
        renderer.setPixelRatio(window.devicePixelRatio);
        container.appendChild(renderer.domElement);

        // Lighting
        const ambient = new THREE.AmbientLight(0xffffff, 0.7);
        scene.add(ambient);
        const dirLight = new THREE.DirectionalLight(0xffffff, 1.5);
        dirLight.position.set(2, 5, 3);
        scene.add(dirLight);

        // Controls
        const { OrbitControls } = await import('three/addons/controls/OrbitControls.js');
        controls = new OrbitControls(camera, renderer.domElement);
        controls.target.set(0, 0, 0);

        const { TransformControls } = await import('three/addons/controls/TransformControls.js');
        transformControls = new TransformControls(camera, renderer.domElement);
        transformControls.addEventListener('dragging-changed', (event) => {
            controls.enabled = !event.value;
        });
        scene.add(transformControls);
        
        // Grid
        scene.add(new THREE.GridHelper(10, 10));
    }

    function animate() {
        rafId = requestAnimationFrame(animate);
        controls.update();
        renderer.render(scene, camera);
    }

    // --- Core Editor Logic ---
    // MODIFICATION: Updated signature to accept assetId.
    async function open(mesh, assetId) {
        if (!renderer) await setupScene(); // Lazy setup

        originalMesh = mesh;
        activeAssetId = assetId; // MODIFICATION: Store the asset ID.
        
        // IMPORTANT: Work on a clone of the geometry.
        const clonedGeometry = originalMesh.geometry.clone();
        editMesh = new window.Phonebook.THREE.Mesh(clonedGeometry, originalMesh.material);
        
        scene.add(editMesh);
        
        // Center view on the cloned mesh
        const box = new window.Phonebook.THREE.Box3().setFromObject(editMesh);
        const center = box.getCenter(new window.Phonebook.THREE.Vector3());
        editMesh.position.sub(center); // Center mesh at origin for easier editing
        controls.target.copy(center).sub(center);
        controls.update();

        modal.style.display = 'flex';
        animate();
    }

    function close() {
        if (rafId) cancelAnimationFrame(rafId);
        rafId = null;

        modal.style.display = 'none';

        // Cleanup to prevent memory leaks
        if (editMesh) {
            scene.remove(editMesh);
            editMesh.geometry.dispose();
            editMesh = null;
        }
        if (selectionBox) {
            scene.remove(selectionBox);
            transformControls.detach();
            selectionBox.geometry.dispose();
            selectionBox = null;
        }
        originalMesh = null;
        activeAssetId = null; // MODIFICATION: Clear the asset ID.
        eraseMode = false;
        document.getElementById('editor-erase-toggle').checked = false;
        toggleEraseMode({ target: { checked: false } }); // Reset UI state
    }

    function saveChanges() {
        if (!originalMesh || !editMesh || !activeAssetId) return;

        // Apply the edited geometry back to the original mesh
        originalMesh.geometry.dispose(); // Dispose the old one
        originalMesh.geometry = editMesh.geometry.clone();
        originalMesh.geometry.computeBoundingSphere();
        originalMesh.geometry.computeBoundingBox();

        // MODIFICATION: Use the stored activeAssetId to emit the update event.
        App.emit('asset:updated', { id: activeAssetId });
        
        close();
    }
    
    // --- Tool Implementation ---
    function toggleEraseMode(event) {
        eraseMode = event.target.checked;
        controls.enabled = !eraseMode; // Disable orbit when erasing
        document.getElementById('editor-box-tool-btn').style.display = eraseMode ? 'inline-block' : 'none';
        
        // Hide box-specific buttons if erase mode is turned off
        if (!eraseMode && selectionBox) {
            scene.remove(selectionBox);
            transformControls.detach();
            selectionBox = null;
            document.getElementById('editor-apply-box-btn').style.display = 'none';
        }
    }

    function showSelectionBox() {
        if (selectionBox) return; // Only one box at a time
        const { THREE } = window.Phonebook;

        const geo = new THREE.BoxGeometry(1, 1, 1);
        const mat = new THREE.MeshBasicMaterial({ color: 0x00c853, transparent: true, opacity: 0.3, wireframe: true });
        selectionBox = new THREE.Mesh(geo, mat);

        // Position it near the mesh
        const meshBox = new THREE.Box3().setFromObject(editMesh);
        selectionBox.position.copy(meshBox.getCenter(new THREE.Vector3()));
        const size = meshBox.getSize(new THREE.Vector3());
        selectionBox.scale.set(size.x * 0.5, size.y * 0.5, size.z * 0.5);

        scene.add(selectionBox);
        transformControls.attach(selectionBox);
        document.getElementById('editor-apply-box-btn').style.display = 'inline-block';
    }

    function applyBoxErase() {
        if (!selectionBox || !editMesh) return;
        const { THREE } = window.Phonebook;

        const geometry = editMesh.geometry;
        const vertices = geometry.attributes.position;
        
        const facesToDelete = new Set();
        const boxMatrixInverse = selectionBox.matrixWorld.clone().invert();
        const tempVertex = new THREE.Vector3();

        for (let i = 0; i < vertices.count; i++) {
            tempVertex.fromBufferAttribute(vertices, i);
            tempVertex.applyMatrix4(editMesh.matrixWorld); // To world space
            tempVertex.applyMatrix4(boxMatrixInverse); // To box's local space

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

        // Clean up the box
        scene.remove(selectionBox);
        transformControls.detach();
        selectionBox = null;
        document.getElementById('editor-apply-box-btn').style.display = 'none';
    }

    function deleteFaces(faceIndices) {
        const { THREE } = window.Phonebook;
        const oldGeo = editMesh.geometry;
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
        
        const newGeo = new THREE.BufferGeometry();
        newGeo.setAttribute('position', oldGeo.attributes.position);
        if(oldGeo.attributes.normal) newGeo.setAttribute('normal', oldGeo.attributes.normal);
        if(oldGeo.attributes.uv) newGeo.setAttribute('uv', oldGeo.attributes.uv);
        newGeo.setIndex(newIndices);
        
        editMesh.geometry.dispose();
        editMesh.geometry = newGeo;
        window.Debug?.log(`Erased ${facesToDelete.size} faces.`);
    }

    // --- Public API ---
    function bootstrap() {
        if (window.MeshEditor) return;

        injectUI();

        window.MeshEditor = {
            open,
        };
        
        window.Debug?.log('Mesh Editor module ready.');
    }

    if (window.App?.glVersion) bootstrap();
    else window.App?.on('app:booted', bootstrap);

})();
