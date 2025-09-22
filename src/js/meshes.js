// src/js/meshes.js - Panel for toggling mesh visibility on the active asset.

(function () {
    'use strict';

    let panel, waitingMessage, listContainer, activeAsset;

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
            <div id="tf-meshes-list" style="display: none;"></div>
        `;
        document.getElementById('app')?.appendChild(panel);

        waitingMessage = panel.querySelector('#tf-meshes-waiting');
        listContainer = panel.querySelector('#tf-meshes-list');
    }

    // --- Logic ---
    function resetPanel() {
        activeAsset = null;
        listContainer.innerHTML = '';
        listContainer.style.display = 'none';
        waitingMessage.style.display = 'block';
    }

    function populateMeshList() {
        if (!activeAsset) {
            resetPanel();
            return;
        }

        const meshes = [];
        activeAsset.object.traverse(obj => {
            if (obj.isMesh) {
                meshes.push(obj);
            }
        });

        listContainer.innerHTML = ''; // Clear previous list
        
        if (meshes.length === 0) {
            listContainer.innerHTML = `<div id="tf-meshes-waiting">No meshes found in this model.</div>`;
            return;
        }

        meshes.forEach((mesh, index) => {
            const row = document.createElement('div');
            row.className = 'tf-mesh-row';

            const meshName = mesh.name || `Mesh ${index + 1}`;
            const meshId = `${activeAsset.id}-mesh-${index}`;

            row.innerHTML = `
                <span class="name" title="${meshName}">${meshName}</span>
                <label class="tf-switch">
                    <input type="checkbox" id="${meshId}" ${mesh.visible ? 'checked' : ''}>
                    <span class="tf-slider"></span>
                </label>
            `;

            const checkbox = row.querySelector(`#${meshId}`);
            checkbox.addEventListener('change', () => {
                mesh.visible = checkbox.checked;
            });

            listContainer.appendChild(row);
        });
        
        waitingMessage.style.display = 'none';
        listContainer.style.display = 'flex';
    }

    // --- Event Handlers ---
    function handleNavChange(event) {
        panel.classList.toggle('show', event.detail.tab === 'meshes');
    }

    function handleAssetActivated(event) {
        activeAsset = event.detail; // This can be an asset object or null
        if (activeAsset) {
            populateMeshList();
        } else {
            resetPanel();
        }
    }

    function wireEvents() {
        Navigation.on('change', handleNavChange);
        App.on('asset:activated', handleAssetActivated);
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
