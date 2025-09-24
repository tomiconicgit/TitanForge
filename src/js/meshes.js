// src/js/meshes.js - Panel for toggling mesh visibility on the active asset.

(function () {
    'use-strict';

    let panel, waitingMessage, listContainer, activeAsset;
    let renameModal, renameInput, confirmRenameBtn, cancelRenameBtn;
    let meshToRename = null;
    let isMassRemoveMode = false;

    // --- UI Injection ---
    function injectUI() {
        const style = document.createElement('style');
        style.textContent = `
            /* Panel layout */
            #tf-meshes-panel {
                position: fixed; top: calc(50vh + 54px);
                left: 0; right: 0; bottom: 0;
                background: #0D1014; z-index: 5;
                padding: 16px; box-sizing: border-box;
                overflow-y: auto; display: none; flex-direction: column;
            }
            #tf-meshes-panel.show { display: flex; }
            #tf-meshes-waiting { color: #a0a7b0; text-align: center; margin: auto; }

            /* --- NEW: Proxy Plane Controls & Button --- */
            #tf-proxy-controls {
                border-bottom: 1px solid rgba(255,255,255,0.1);
                margin-bottom: 15px; padding-bottom: 10px;
            }
            .tf-slider-group { margin-bottom: 10px; }
            .tf-slider-group label {
                display: block; color: #a0a7b0; font-size: 13px; margin-bottom: 8px;
            }
            .tf-slider-group input[type=range] {
                width: 100%; -webkit-appearance: none; height: 4px;
                background: rgba(255,255,255,0.1); border-radius: 4px; outline: none;
            }
            .tf-slider-group input[type=range]::-webkit-slider-thumb {
                -webkit-appearance: none; appearance: none;
                width: 16px; height: 16px; background: #2575fc;
                cursor: pointer; border-radius: 50%;
            }
            #tf-add-plane-btn {
                width: 100%; padding: 10px 12px; margin-bottom: 15px; font-size: 14px; font-weight: 600;
                border-radius: 8px; border: none;
                background-color: rgba(37, 117, 252, 0.2); color: #5c9eff;
                cursor: pointer; transition: background-color 0.2s ease;
            }
            #tf-add-plane-btn:hover { background-color: rgba(37, 117, 252, 0.3); }

            /* --- NEW: Mass Remove Buttons --- */
            #tf-mass-remove-toggle-btn {
                width: 100%; padding: 10px 12px; margin-bottom: 15px; font-size: 14px; font-weight: 600;
                border-radius: 8px; border: none;
                background-color: rgba(255, 255, 255, 0.1); color: #e6eef6;
                cursor: pointer; transition: background-color 0.2s ease;
            }
            #tf-mass-remove-toggle-btn:hover { background-color: rgba(255, 255, 255, 0.15); }
            #tf-mass-remove-toggle-btn:disabled { opacity: 0.4; cursor: not-allowed; }
            #tf-mass-remove-actions { display: flex; gap: 10px; margin-bottom: 15px; }
            #tf-mass-remove-actions button {
                flex: 1; padding: 10px 12px; font-size: 14px; font-weight: 600;
                border-radius: 8px; border: none; cursor: pointer; transition: opacity 0.2s ease;
            }
            #tf-mass-remove-actions button:hover { opacity: 0.85; }
            #tf-remove-selected-btn { background-color: #c62828; color: #fff; }
            #tf-cancel-mass-remove-btn { background-color: rgba(255,255,255,0.1); color: #fff; }

            /* Mesh list styles */
            #tf-meshes-list { display: flex; flex-direction: column; gap: 8px; }
            .tf-mesh-row {
                display: flex; align-items: center; justify-content: space-between;
                padding: 10px; background: rgba(255,255,255,0.05); border-radius: 6px;
            }
            .tf-mesh-row .mesh-details {
                display: flex; align-items: center; flex-grow: 1; overflow: hidden;
            }
            .tf-mesh-row .name {
                color: #e6eef6; font-size: 14px; white-space: nowrap;
                overflow: hidden; text-overflow: ellipsis; padding-right: 15px;
            }
            .tf-mesh-row .actions { display: flex; align-items: center; gap: 10px; }
            .tf-mesh-row .icon-btn {
                background: none; border: none; padding: 0; cursor: pointer;
                width: 20px; height: 20px; display: flex; align-items: center; justify-content: center;
            }
            .tf-mesh-row .icon-btn svg { fill: #a0a7b0; transition: fill 0.2s ease; }
            /* --- MODIFICATION: Added new hover color for edit button --- */
            .tf-mesh-row .edit-btn:hover svg { fill: #25e2a0; }
            .tf-mesh-row .rename-btn:hover svg { fill: #fff; }
            .tf-mesh-row .delete-btn:hover svg { fill: #ff5959; }
            .tf-mesh-row .unskin-btn:hover svg { fill: #ffc107; }

            /* --- NEW: Checkbox styles for Mass Remove --- */
            .mass-remove-checkbox {
                display: none; margin-right: 12px; width: 18px; height: 18px;
                accent-color: #2575fc; flex-shrink: 0;
            }
            #tf-meshes-list.mass-remove-active .mass-remove-checkbox { display: inline-block; }
            #tf-meshes-list.mass-remove-active .actions { display: none; }

            /* Rename Modal Styles */
            .tf-rename-modal-content {
                width: min(350px, 90vw); padding: 20px;
                background: rgba(28, 32, 38, 0.95); border-radius: 12px;
                border: 1px solid rgba(255,255,255,0.1); display: flex; flex-direction: column; gap: 15px;
            }
            .tf-rename-modal-content .title { font-size: 18px; font-weight: 600; }
            .tf-rename-modal-content input {
                width: 100%; padding: 10px; background: rgba(0,0,0,0.3);
                border: 1px solid #555; color: #fff; border-radius: 5px; font-size: 15px; box-sizing: border-box;
            }
            .tf-rename-modal-content .buttons { display: flex; gap: 10px; }
            .tf-rename-modal-content button {
                flex: 1; padding: 10px; border: none; border-radius: 5px; font-weight: 600; cursor: pointer;
            }
            #tf-rename-confirm { background: #2575fc; color: #fff; }
            #tf-rename-cancel { background: rgba(255,255,255,0.1); color: #fff; }

            /* Toggle switch styles */
            .tf-switch { position: relative; display: inline-block; width: 30px; height: 16px; flex-shrink: 0; }
            .tf-switch input { display: none; }
            .tf-slider {
                position: absolute; cursor: pointer; inset: 0; background-color: rgba(255,255,255,0.2);
                transition: .4s; border-radius: 16px;
            }
            .tf-slider:before {
                position: absolute; content: ""; height: 12px; width: 12px;
                left: 2px; bottom: 2px; background-color: white; transition: .4s; border-radius: 50%;
            }
            input:checked + .tf-slider { background-color: #00c853; }
            input:checked + .tf-slider:before { transform: translateX(14px); }
        `;
        document.head.appendChild(style);

        panel = document.createElement('div');
        panel.id = 'tf-meshes-panel';
        panel.innerHTML = `
            <div id="tf-meshes-waiting">Load a model to view its meshes.</div>
            <div id="tf-meshes-editor" style="display: none;">
                <div id="tf-proxy-controls" style="display: none;">
                    <div class="tf-slider-group">
                        <label for="proxy-opacity">Proxy Opacity</label>
                        <input type="range" id="proxy-opacity" min="0" max="1" value="0.5" step="0.01">
                    </div>
                    <div class="tf-slider-group">
                        <label for="proxy-size">Proxy Size</label>
                        <input type="range" id="proxy-size" min="0.01" max="2" value="1" step="0.01">
                    </div>
                </div>
                <button id="tf-add-plane-btn">Add Proxy Plane</button>
                <button id="tf-mass-remove-toggle-btn">Mass Remove</button>
                <div id="tf-mass-remove-actions" style="display: none;">
                    <button id="tf-remove-selected-btn">Remove Selected</button>
                    <button id="tf-cancel-mass-remove-btn">Cancel</button>
                </div>
                <div id="tf-meshes-list"></div>
            </div>
        `;
        document.getElementById('app')?.appendChild(panel);

        renameModal = document.createElement('div');
        renameModal.id = 'tf-rename-modal';
        renameModal.className = 'tf-modal-overlay';
        renameModal.innerHTML = `
            <div class="tf-rename-modal-content">
                <div class="title">Rename Mesh</div>
                <input type="text" id="tf-mesh-rename-input" placeholder="Enter new mesh name">
                <div class="buttons">
                    <button id="tf-rename-cancel">Cancel</button>
                    <button id="tf-rename-confirm">Confirm</button>
                </div>
            </div>
        `;
        document.body.appendChild(renameModal);

        waitingMessage = panel.querySelector('#tf-meshes-waiting');
        listContainer = panel.querySelector('#tf-meshes-list');
        renameInput = renameModal.querySelector('#tf-mesh-rename-input');
        confirmRenameBtn = renameModal.querySelector('#tf-rename-confirm');
        cancelRenameBtn = renameModal.querySelector('#tf-rename-cancel');
    }

    // --- Logic ---
    function showRenameModal(visible) {
        renameModal.classList.toggle('show', visible);
        if (!visible) meshToRename = null;
    }
    
    function resetPanel() {
        activeAsset = null;
        panel.querySelector('#tf-meshes-editor').style.display = 'none';
        waitingMessage.style.display = 'block';
    }

    function populateMeshList() {
        if (!activeAsset) {
            resetPanel();
            return;
        }

        const meshes = [];
        activeAsset.object.traverse(obj => {
            if (obj.isMesh || obj.isSkinnedMesh) meshes.push(obj);
        });
        
        const proxyControls = panel.querySelector('#tf-proxy-controls');
        const proxyPlane = activeAsset.object.getObjectByName('ProxyPlane');
        if (proxyPlane) {
            proxyControls.style.display = 'block';
            panel.querySelector('#proxy-opacity').value = proxyPlane.material.opacity;
            panel.querySelector('#proxy-size').value = proxyPlane.scale.x;
        } else {
            proxyControls.style.display = 'none';
        }

        const editorEl = panel.querySelector('#tf-meshes-editor');
        const massRemoveBtn = panel.querySelector('#tf-mass-remove-toggle-btn');
        listContainer.innerHTML = '';
        
        if (meshes.length === 0) {
            massRemoveBtn.disabled = true;
            listContainer.innerHTML = `<div style="text-align: center; color: #a0a7b0;">No meshes found in this model.</div>`;
        } else {
             massRemoveBtn.disabled = false;
             meshes.forEach((mesh, index) => {
                const row = document.createElement('div');
                row.className = 'tf-mesh-row';
                row.dataset.meshUuid = mesh.uuid;
                const meshName = mesh.name || `Mesh ${index + 1}`;
                const meshId = `${activeAsset.id}-mesh-${index}`;

                // --- MODIFICATION: Added the new edit button to the actions ---
                row.innerHTML = `
                    <div class="mesh-details">
                        <input type="checkbox" class="mass-remove-checkbox" title="Select for removal">
                        <span class="name" title="${meshName}">${meshName}</span>
                    </div>
                    <div class="actions">
                        <button class="icon-btn edit-btn" title="Edit Mesh Geometry">
                            <svg viewBox="0 0 24 24" width="16" height="16"><path d="M20.71 7.04c.34-.34.34-.92 0-1.26l-2.79-2.79c-.34-.34-.92-.34-1.26 0l-1.37 1.37 4.05 4.05 1.37-1.37zM3 17.25V21h3.75L17.81 9.94l-4.05-4.05L3 17.25z"/></svg>
                        </button>
                        <button class="icon-btn unskin-btn" title="Remove Rig from Mesh" style="display: none;">
                            <svg viewBox="0 0 24 24" width="16" height="16"><path fill="currentColor" d="M17 7h-4v2h4c1.65 0 3 1.35 3 3s-1.35 3-3 3h-4v2h4c2.76 0 5-2.24 5-5s-2.24-5-5-5zm-6 8H7c-1.65 0-3-1.35-3-3s1.35-3 3-3h4V7H7c-2.76 0-5 2.24-5 5s2.24 5 5 5h4v-2zm-3-4h8v2H8v-2z"></path></svg>
                        </button>
                        <button class="icon-btn rename-btn" title="Rename Mesh">
                            <svg viewBox="0 0 20 20" width="16" height="16"><path d="M17.56 4.44l-2-2C15.38 2.26 15.19 2.18 15 2.18c-.19 0-.38.08-.53.22l-1.5 1.5L17 7.82l1.5-1.5c.3-.29.3-.76 0-1.06zM11.44 5.44L3.03 13.85c-.14.14-.22.33-.22.53V16.5c0 .28.22.5.5.5h2.12c.2 0 .39-.08.53-.22l8.41-8.41L11.44 5.44z"/></svg>
                        </button>
                        <button class="icon-btn delete-btn" title="Delete Mesh">
                            <svg viewBox="0 0 16 16" width="16" height="16"><path fill-rule="evenodd" d="M5 3.5h6A1.5 1.5 0 0 1 12.5 5v1.5a.5.5 0 0 1-1 0V5a.5.5 0 0 0-.5-.5H5a.5.5 0 0 0-.5.5v10a.5.5 0 0 0 .5.5h6a.5.5 0 0 0 .5-.5V10a.5.5 0 0 1 1 0v5.5A1.5 1.5 0 0 1 11 17H5a1.5 1.5 0 0 1-1.5-1.5v-10A1.5 1.5 0 0 1 5 3.5ZM10 6a.5.5 0 0 1 .5.5v6a.5.5 0 0 1-1 0V6.5a.5.5 0 0 1 .5-.5Zm-3 0a.5.5 0 0 1 .5.5v6a.5.5 0 0 1-1 0V6.5A.5.5 0 0 1 7 6Zm-4.32 1.05a.5.5 0 0 1 0-.7l4-3a.5.5 0 0 1 .64.64L3.97 6.75l3.35 2.5a.5.5 0 0 1-.64.8l-4-3a.5.5 0 0 1-.03-.09Zm10.64.64a.5.5 0 0 0-.64-.64l-4 3a.5.5 0 0 0 .03.09l4 3a.5.5 0 0 0 .64-.8L12.03 9.25l3.35-2.5a.5.5 0 0 0 0-.7Z"></path></svg>
                        </button>
                        <label class="tf-switch">
                            <input type="checkbox" id="${meshId}" ${mesh.visible ? 'checked' : ''}>
                            <span class="tf-slider"></span>
                        </label>
                    </div>
                `;
                
                if (mesh.isSkinnedMesh) {
                    const unskinBtn = row.querySelector('.unskin-btn');
                    if(unskinBtn) unskinBtn.style.display = 'flex';
                }

                const checkbox = row.querySelector(`#${meshId}`);
                checkbox.addEventListener('change', () => { mesh.visible = checkbox.checked; });
                listContainer.appendChild(row);
            });
        }
        waitingMessage.style.display = 'none';
        editorEl.style.display = 'block';
    }

    // --- Mesh Management Logic ---
    function toggleMassRemoveMode(enable) {
        const toggleBtn = panel.querySelector('#tf-mass-remove-toggle-btn');
        const actionsDiv = panel.querySelector('#tf-mass-remove-actions');

        isMassRemoveMode = enable;

        toggleBtn.style.display = enable ? 'none' : 'block';
        actionsDiv.style.display = enable ? 'flex' : 'none';
        listContainer.classList.toggle('mass-remove-active', enable);

        if (!enable) {
            listContainer.querySelectorAll('.mass-remove-checkbox:checked').forEach(cb => {
                cb.checked = false;
            });
        }
    }

    function addProxyPlane() {
        if (!activeAsset) return;

        const existingPlane = activeAsset.object.getObjectByName('ProxyPlane');
        if (existingPlane) {
            alert('A Proxy Plane already exists for this model.');
            return;
        }

        const { THREE } = window.Phonebook;
        const geo = new THREE.PlaneGeometry(1, 1);
        const mat = new THREE.MeshStandardMaterial({
            color: 0xcccccc,
            transparent: true,
            opacity: 0.5,
            side: THREE.DoubleSide
        });

        let newMesh;
        const bones = [];
        activeAsset.object.traverse(node => { if (node.isBone) bones.push(node); });

        if (bones.length > 0) {
            const vertexCount = geo.attributes.position.count;
            const skinIndices = new Uint16Array(vertexCount * 4);
            const skinWeights = new Float32Array(vertexCount * 4);
            for (let i = 0; i < vertexCount; i++) {
                const i4 = i * 4;
                skinIndices[i4] = 0; skinIndices[i4+1] = 0; skinIndices[i4+2] = 0; skinIndices[i4+3] = 0;
                skinWeights[i4] = 1; skinWeights[i4+1] = 0; skinWeights[i4+2] = 0; skinWeights[i4+3] = 0;
            }
            geo.setAttribute('skinIndex', new THREE.BufferAttribute(skinIndices, 4));
            geo.setAttribute('skinWeight', new THREE.BufferAttribute(skinWeights, 4));

            newMesh = new THREE.SkinnedMesh(geo, mat);
            const skeleton = new THREE.Skeleton(bones);
            newMesh.bind(skeleton);
            window.Debug?.log('Added Proxy Plane as SkinnedMesh with skinning attributes.');
        } else {
            newMesh = new THREE.Mesh(geo, mat);
            window.Debug?.log('Added Proxy Plane as standard Mesh.');
        }

        newMesh.name = 'ProxyPlane';
        activeAsset.object.add(newMesh);

        App.emit('asset:updated', { id: activeAsset.id });
        populateMeshList();
    }

    function unskinMesh(meshUuid) {
        if (!activeAsset) return;

        const skinnedMesh = activeAsset.object.getObjectByProperty('uuid', meshUuid);
        if (!skinnedMesh || !skinnedMesh.isSkinnedMesh) return;
        
        const parent = skinnedMesh.parent;
        if (!parent) return;

        const { THREE } = window.Phonebook;
        
        const staticMesh = new THREE.Mesh(skinnedMesh.geometry, skinnedMesh.material);
        staticMesh.name = skinnedMesh.name;
        staticMesh.position.copy(skinnedMesh.position);
        staticMesh.quaternion.copy(skinnedMesh.quaternion);
        staticMesh.scale.copy(skinnedMesh.scale);

        parent.add(staticMesh);
        parent.remove(skinnedMesh);

        const bonesToRemove = [];
        activeAsset.object.traverse(obj => { if (obj.isBone) bonesToRemove.push(obj); });
        if (bonesToRemove.length > 0) {
            window.Debug?.log(`Removing ${bonesToRemove.length} bones from asset.`);
            bonesToRemove.forEach(bone => bone.parent.remove(bone));
        }
        
        populateMeshList();
        App.emit('asset:updated', { id: activeAsset.id });
    }

    function isMaterialUsedElsewhere(root, mat, exceptMesh) {
        if (!mat) return false;
        let used = false;
        root.traverse(o => {
            if (used || o === exceptMesh || !(o.isMesh || o.isSkinnedMesh)) return;
            const mats = Array.isArray(o.material) ? o.material : [o.material];
            if (mats && mats.some(m => m === mat)) used = true;
        });
        return used;
    }

    function disposeMesh(mesh) {
        if (!mesh) return;

        if (mesh.geometry) mesh.geometry.dispose();

        if (mesh.material) {
            const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
            mats.forEach(mat => {
                if (!isMaterialUsedElsewhere(activeAsset.object, mat, mesh)) {
                    if (mat.map) mat.map.dispose?.();
                    if (mat.normalMap) mat.normalMap.dispose?.();
                    if (mat.roughnessMap) mat.roughnessMap.dispose?.();
                    if (mat.metalnessMap) mat.metalnessMap.dispose?.();
                    if (mat.aoMap) mat.aoMap.dispose?.();
                    if (mat.emissiveMap) mat.emissiveMap.dispose?.();
                    mat.dispose?.();
                }
            });
        }

        if (mesh.parent) mesh.parent.remove(mesh);
    }
    
    function removeSingleMesh(meshUuid) {
        if (!activeAsset) return;
        const mesh = activeAsset.object.getObjectByProperty('uuid', meshUuid);
        if (mesh && confirm(`Permanently delete mesh: "${mesh.name || 'Unnamed Mesh'}"?`)) {
            disposeMesh(mesh);
            window.Debug?.log(`Removed mesh: ${mesh.name}`);
            App.emit('asset:updated', { id: activeAsset.id });
            populateMeshList();
        }
    }

    function removeSelectedMeshes() {
        if (!activeAsset) return;

        const selectedCheckboxes = listContainer.querySelectorAll('.mass-remove-checkbox:checked');
        if (selectedCheckboxes.length === 0) {
            alert('No meshes selected for removal.');
            return;
        }

        if (!confirm(`Are you sure you want to permanently remove the ${selectedCheckboxes.length} selected meshes? This cannot be undone.`)) {
            return;
        }

        const meshesToRemove = [];
        selectedCheckboxes.forEach(cb => {
            const row = cb.closest('.tf-mesh-row');
            if (row?.dataset.meshUuid) {
                const mesh = activeAsset.object.getObjectByProperty('uuid', row.dataset.meshUuid);
                if (mesh) meshesToRemove.push(mesh);
            }
        });

        if (meshesToRemove.length > 0) {
            meshesToRemove.forEach(disposeMesh);
            window.Debug?.log(`Removed ${meshesToRemove.length} meshes.`);
            App.emit('asset:updated', { id: activeAsset.id });
            populateMeshList();
        }

        toggleMassRemoveMode(false);
    }


    // --- Event Handlers ---
    function handleNavChange(event) {
        const isShowing = event.detail.tab === 'meshes';
        panel.classList.toggle('show', isShowing);
        if (!isShowing && isMassRemoveMode) {
            toggleMassRemoveMode(false);
        }
    }

    function handleAssetActivated(event) {
        activeAsset = event.detail;
        if (isMassRemoveMode) {
           toggleMassRemoveMode(false);
        }
        populateMeshList();
    }

    function wireEvents() {
        Navigation.on('change', handleNavChange);
        App.on('asset:activated', handleAssetActivated);
        
        panel.querySelector('#tf-add-plane-btn').addEventListener('click', addProxyPlane);
        panel.querySelector('#tf-mass-remove-toggle-btn').addEventListener('click', () => toggleMassRemoveMode(true));
        panel.querySelector('#tf-cancel-mass-remove-btn').addEventListener('click', () => toggleMassRemoveMode(false));
        panel.querySelector('#tf-remove-selected-btn').addEventListener('click', removeSelectedMeshes);

        const opacitySlider = panel.querySelector('#proxy-opacity');
        const sizeSlider = panel.querySelector('#proxy-size');

        opacitySlider.addEventListener('input', e => {
            if (!activeAsset) return;
            const plane = activeAsset.object.getObjectByName('ProxyPlane');
            if (plane) plane.material.opacity = parseFloat(e.target.value);
        });

        sizeSlider.addEventListener('input', e => {
            if (!activeAsset) return;
            const plane = activeAsset.object.getObjectByName('ProxyPlane');
            if (plane) {
                const size = parseFloat(e.target.value);
                plane.scale.set(size, size, 1);
            }
        });

        listContainer.addEventListener('click', (e) => {
            if (isMassRemoveMode) return;
            
            const button = e.target.closest('.icon-btn');
            if (!button || !activeAsset) return;

            const row = button.closest('.tf-mesh-row');
            const uuid = row.dataset.meshUuid;
            const mesh = activeAsset.object.getObjectByProperty('uuid', uuid);
            if (!mesh) return;

            // --- MODIFICATION: Handle the new edit button click ---
            if (button.classList.contains('edit-btn')) {
                // Check if the MeshEditor is available and open it
                if (window.MeshEditor && typeof window.MeshEditor.open === 'function') {
                    window.MeshEditor.open(mesh);
                } else {
                    alert('Mesh Editor module not loaded.');
                }
            } else if (button.classList.contains('unskin-btn')) {
                unskinMesh(uuid);
            } else if (button.classList.contains('rename-btn')) {
                meshToRename = mesh;
                renameInput.value = meshToRename.name;
                showRenameModal(true);
                renameInput.focus();
            } else if (button.classList.contains('delete-btn')) {
                removeSingleMesh(uuid);
            }
        });

        // Modal event handlers
        confirmRenameBtn.addEventListener('click', () => {
            if (!meshToRename) return;
            const newName = renameInput.value.trim();
            if (newName) {
                meshToRename.name = newName;
                populateMeshList();
                showRenameModal(false);
            }
        });
        
        cancelRenameBtn.addEventListener('click', () => showRenameModal(false));
        renameModal.addEventListener('click', (e) => {
            if (e.target === renameModal) showRenameModal(false);
        });
    }

    // --- Bootstrap ---
    function bootstrap() {
        if (window.Meshes) return;
        injectUI();
        wireEvents();
        window.Meshes = {};
        window.Debug?.log('Meshes Panel ready.');
    }

    if (window.App?.glVersion) bootstrap();
    else window.App?.on('app:booted', bootstrap);

})();
