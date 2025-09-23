// src/js/meshes.js - Panel for toggling mesh visibility on the active asset.

(function () {
    'use strict';

    let panel, waitingMessage, listContainer, activeAsset;
    let renameModal, renameInput, confirmRenameBtn, cancelRenameBtn;
    let meshToRename = null; // To keep track of the mesh being edited

    // --- UI Injection ---
    function injectUI() {
        const style = document.createElement('style');
        style.textContent = `
            /* Panel layout - similar to transform.js */
            #tf-meshes-panel {
                position: fixed;
                top: calc(50vh + 54px);
                left: 0; right: 0; bottom: 0;
                background: #0D1014;
                z-index: 5;
                padding: 16px;
                box-sizing: border-box;
                overflow-y: auto;
                display: none; /* Hidden by default */
            }
            #tf-meshes-panel.show { display: flex; flex-direction: column; }
            #tf-meshes-waiting {
                color: #a0a7b0;
                font-size: 16px;
                text-align: center;
                margin: auto; /* Center the waiting text */
            }

            /* --- NEW: Remove Meshes Button --- */
            #tf-remove-all-meshes-btn {
                width: 100%;
                padding: 10px 12px;
                margin-bottom: 15px;
                font-size: 14px;
                font-weight: 600;
                border: 1px solid rgba(255, 59, 48, 0.5);
                border-radius: 8px;
                background-color: rgba(255, 59, 48, 0.15);
                color: #ff5959;
                cursor: pointer;
                transition: background-color 0.2s ease, color 0.2s ease;
            }
            #tf-remove-all-meshes-btn:hover {
                background-color: rgba(255, 59, 48, 0.3);
                color: #ff8a80;
            }
            #tf-remove-all-meshes-btn:disabled {
                opacity: 0.4;
                cursor: not-allowed;
            }


            /* Mesh list styles */
            #tf-meshes-list {
                display: flex;
                flex-direction: column;
                gap: 8px;
            }
            .tf-mesh-row {
                display: flex;
                align-items: center;
                justify-content: space-between;
                padding: 10px;
                background: rgba(255,255,255,0.05);
                border-radius: 6px;
            }
            .tf-mesh-row .name {
                color: #e6eef6;
                font-size: 14px;
                white-space: nowrap;
                overflow: hidden;
                text-overflow: ellipsis;
                padding-right: 15px;
            }
            .tf-mesh-row .actions {
                display: flex;
                align-items: center;
                gap: 15px;
            }
            .tf-mesh-row .rename-btn {
                background: none; border: none; padding: 0; cursor: pointer;
                width: 16px; height: 16px;
            }
            .tf-mesh-row .rename-btn svg {
                fill: #a0a7b0;
                transition: fill 0.2s ease;
            }
            .tf-mesh-row .rename-btn:hover svg { fill: #fff; }

            /* Rename Modal Styles */
            .tf-rename-modal-content {
                width: min(350px, 90vw);
                padding: 20px;
                background: rgba(28, 32, 38, 0.95);
                border-radius: 12px;
                border: 1px solid rgba(255,255,255,0.1);
                display: flex; flex-direction: column; gap: 15px;
            }
            .tf-rename-modal-content .title { font-size: 18px; font-weight: 600; }
            .tf-rename-modal-content input {
                width: 100%;
                padding: 10px;
                background: rgba(0,0,0,0.3);
                border: 1px solid #555;
                color: #fff; border-radius: 5px; font-size: 15px;
                box-sizing: border-box;
            }
            .tf-rename-modal-content .buttons { display: flex; gap: 10px; }
            .tf-rename-modal-content button {
                flex: 1; padding: 10px; border: none; border-radius: 5px;
                font-weight: 600; cursor: pointer;
            }
            #tf-rename-confirm { background: #2575fc; color: #fff; }
            #tf-rename-cancel { background: rgba(255,255,255,0.1); color: #fff; }


            /* Toggle switch styles - reused from toggles.js */
            .tf-switch {
                position: relative; display: inline-block;
                width: 30px; height: 16px; flex-shrink: 0;
            }
            .tf-switch input { display: none; }
            .tf-slider {
                position: absolute; cursor: pointer; inset: 0;
                background-color: rgba(255,255,255,0.2);
                transition: .4s; border-radius: 16px;
            }
            .tf-slider:before {
                position: absolute; content: "";
                height: 12px; width: 12px;
                left: 2px; bottom: 2px;
                background-color: white;
                transition: .4s; border-radius: 50%;
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
                <button id="tf-remove-all-meshes-btn">Remove All Meshes 🗑️</button>
                <div id="tf-meshes-list"></div>
            </div>
        `;
        document.getElementById('app')?.appendChild(panel);

        // Rename modal
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
            if (obj.isMesh) meshes.push(obj);
        });

        const editorEl = panel.querySelector('#tf-meshes-editor');
        const removeBtn = panel.querySelector('#tf-remove-all-meshes-btn');
        listContainer.innerHTML = ''; // Clear previous list
        
        if (meshes.length === 0) {
            removeBtn.disabled = true;
            listContainer.innerHTML = `<div style="text-align: center; color: #a0a7b0;">No meshes found in this model.</div>`;
        } else {
             removeBtn.disabled = false;
             meshes.forEach((mesh, index) => {
                const row = document.createElement('div');
                row.className = 'tf-mesh-row';
                row.dataset.meshUuid = mesh.uuid;

                const meshName = mesh.name || `Mesh ${index + 1}`;
                const meshId = `${activeAsset.id}-mesh-${index}`;

                row.innerHTML = `
                    <span class="name" title="${meshName}">${meshName}</span>
                    <div class="actions">
                        <button class="rename-btn" title="Rename Mesh">
                            <svg viewBox="0 0 20 20" width="16" height="16"><path d="M17.56 4.44l-2-2C15.38 2.26 15.19 2.18 15 2.18c-.19 0-.38.08-.53.22l-1.5 1.5L17 7.82l1.5-1.5c.3-.29.3-.76 0-1.06zM11.44 5.44L3.03 13.85c-.14.14-.22.33-.22.53V16.5c0 .28.22.5.5.5h2.12c.2 0 .39-.08.53-.22l8.41-8.41L11.44 5.44z"/></svg>
                        </button>
                        <label class="tf-switch">
                            <input type="checkbox" id="${meshId}" ${mesh.visible ? 'checked' : ''}>
                            <span class="tf-slider"></span>
                        </label>
                    </div>
                `;
                const checkbox = row.querySelector(`#${meshId}`);
                checkbox.addEventListener('change', () => { mesh.visible = checkbox.checked; });
                listContainer.appendChild(row);
            });
        }
        
        waitingMessage.style.display = 'none';
        editorEl.style.display = 'block';
    }

    // --- NEW: Logic to permanently remove all meshes ---
    function removeAllMeshes() {
        if (!activeAsset) return;
        
        if (!confirm('Are you sure you want to permanently remove all meshes from this model? This cannot be undone.')) {
            return;
        }

        const meshesToRemove = [];
        activeAsset.object.traverse(child => {
            if (child.isMesh) {
                meshesToRemove.push(child);
            }
        });

        if (meshesToRemove.length === 0) {
            window.Debug?.warn('No meshes found to remove.');
            return;
        }
        
        meshesToRemove.forEach(mesh => {
            // Clean up GPU memory
            mesh.geometry.dispose();
            if (Array.isArray(mesh.material)) {
                mesh.material.forEach(mat => mat.dispose());
            } else if (mesh.material) {
                mesh.material.dispose();
            }
            // Remove from scene graph
            mesh.parent.remove(mesh);
        });

        window.Debug?.log(`Removed ${meshesToRemove.length} meshes.`);
        // Refresh the UI to show that the list is now empty.
        populateMeshList();
    }

    // --- Event Handlers ---
    function handleNavChange(event) {
        panel.classList.toggle('show', event.detail.tab === 'meshes');
    }

    function handleAssetActivated(event) {
        activeAsset = event.detail;
        if (activeAsset) {
            populateMeshList();
        } else {
            resetPanel();
        }
    }

    function wireEvents() {
        Navigation.on('change', handleNavChange);
        App.on('asset:activated', handleAssetActivated);

        // --- UPDATED: Add listener for the new remove button ---
        panel.querySelector('#tf-remove-all-meshes-btn').addEventListener('click', removeAllMeshes);

        // Event delegation for rename buttons
        listContainer.addEventListener('click', (e) => {
            const renameButton = e.target.closest('.rename-btn');
            if (!renameButton || !activeAsset) return;

            const row = renameButton.closest('.tf-mesh-row');
            const uuid = row.dataset.meshUuid;
            meshToRename = activeAsset.object.getObjectByProperty('uuid', uuid);
            
            if (meshToRename) {
                renameInput.value = meshToRename.name;
                showRenameModal(true);
                renameInput.focus();
            }
        });

        // Modal event handlers
        confirmRenameBtn.addEventListener('click', () => {
            if (!meshToRename) return;
            const newName = renameInput.value.trim();
            if (newName) {
                meshToRename.name = newName;
                const row = listContainer.querySelector(`[data-mesh-uuid="${meshToRename.uuid}"]`);
                if (row) {
                    const nameEl = row.querySelector('.name');
                    nameEl.textContent = newName;
                    nameEl.title = newName;
                }
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
