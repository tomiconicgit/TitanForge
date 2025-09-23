// src/js/export.js - Exports a modified asset as a new GLB file.
(function () {
    'use strict';

    // --- Module State ---
    let modal, listContainer, statusText;
    const assets = new Map(); // Keep a local track of loaded assets

    // --- UI Injection ---
    function injectUI() {
        const style = document.createElement('style');
        style.textContent = `
            /* Styles for the export modal */
            .tf-export-modal-content {
                width: min(400px, 90vw);
                padding: 25px;
                background: rgba(28, 32, 38, 0.95);
                border-radius: 12px;
                border: 1px solid rgba(255,255,255,0.1);
                display: flex; flex-direction: column; gap: 20px;
                color: #e6eef6;
            }
            .tf-export-modal-content .title {
                font-size: 18px; font-weight: 600; text-align: center;
                padding-bottom: 15px;
                border-bottom: 1px solid rgba(255,255,255,0.1);
            }
            #tf-export-list {
                display: flex; flex-direction: column; gap: 10px;
                max-height: 50vh; overflow-y: auto;
            }
            #tf-export-list button {
                width: 100%;
                padding: 12px;
                font-size: 15px;
                font-weight: 500;
                border: none;
                border-radius: 8px;
                background-color: rgba(255,255,255,0.1);
                color: #e6eef6;
                cursor: pointer;
                text-align: left;
                transition: background-color 0.2s ease;
            }
            #tf-export-list button:hover {
                background-color: rgba(255,255,255,0.15);
            }
            #tf-export-list .no-assets {
                text-align: center;
                color: #a0a7b0;
                padding: 20px 0;
            }
            #tf-export-status {
                font-size: 13px; color: #a0a7b0; height: 16px; text-align: center;
            }
        `;
        document.head.appendChild(style);

        modal = document.createElement('div');
        modal.id = 'tf-export-modal';
        modal.className = 'tf-modal-overlay'; // Re-use style from model.js
        modal.innerHTML = `
            <div class="tf-export-modal-content">
                <div class="title">Export Model as GLB</div>
                <div id="tf-export-list">
                    </div>
                <div id="tf-export-status">Select an item to download.</div>
            </div>
        `;
        document.body.appendChild(modal);

        listContainer = modal.querySelector('#tf-export-list');
        statusText = modal.querySelector('#tf-export-status');
    }

    // --- Logic ---
    function showModal(visible) {
        if (visible) {
            populateList();
            statusText.textContent = 'Select an item to download.';
        }
        modal.classList.toggle('show', visible);
    }

    function populateList() {
        listContainer.innerHTML = ''; // Clear previous items
        if (assets.size === 0) {
            listContainer.innerHTML = `<div class="no-assets">No models or assets are loaded.</div>`;
            return;
        }

        for (const [id, asset] of assets.entries()) {
            const button = document.createElement('button');
            button.textContent = asset.name;
            button.dataset.assetId = id;
            listContainer.appendChild(button);
        }
    }

    /**
     * Exports the selected asset, baking its world transform into the new file.
     * This ensures that attached assets are saved in their final visual position.
     */
    function exportAsset(assetId) {
        const asset = assets.get(assetId);
        if (!asset || !asset.object) {
            console.error('Export failed: Asset not found for ID', assetId);
            statusText.textContent = 'Error: Asset not found.';
            return;
        }

        statusText.textContent = 'Preparing export...';

        const { GLTFExporter, THREE } = window.Phonebook;
        const exporter = new GLTFExporter();
        const options = { binary: true }; // Export as a binary GLB file
        
        const objectToExport = asset.object;
        
        // To bake the final world transform (especially for attached items),
        // we clone the object, apply its world matrix, and export the clone.
        const tempScene = new THREE.Scene();
        const clone = objectToExport.clone();
        
        // Apply the object's current world matrix to the clone
        objectToExport.updateWorldMatrix(true, true);
        clone.applyMatrix4(objectToExport.matrixWorld);

        // Reset clone's local transforms so it sits at the origin in the new file
        clone.position.set(0, 0, 0);
        clone.rotation.set(0, 0, 0);
        clone.scale.set(1, 1, 1);
        
        tempScene.add(clone);

        exporter.parse(
            tempScene,
            (gltf) => { // onSuccess
                const blob = new Blob([gltf], { type: 'model/gltf-binary' });
                const url = URL.createObjectURL(blob);
                const link = document.createElement('a');

                const baseName = asset.name.endsWith('.glb') ? asset.name.slice(0, -4) : asset.name;
                link.download = `exported_${baseName}.glb`;
                link.href = url;
                
                document.body.appendChild(link);
                link.click();
                
                // Cleanup
                document.body.removeChild(link);
                URL.revokeObjectURL(url);
                showModal(false); // Close modal on success
            },
            (error) => { // onError
                console.error('GLTF export error:', error);
                statusText.textContent = 'Error: Export failed. See console.';
            },
            options
        );
    }
    
    // --- Event Handling & Bootstrap ---
    function bootstrap() {
        if (window.Export) return;

        injectUI();

        // Keep local asset list in sync with the rest of the app
        App.on('asset:loaded', (event) => {
            const assetData = event.detail;
            if (assetData && assetData.id) {
                assets.set(assetData.id, assetData);
            }
        });
        App.on('asset:cleaned', (event) => {
            const { id } = event.detail;
            if (id && assets.has(id)) {
                assets.delete(id);
            }
        });

        // Wire up modal events
        modal.addEventListener('click', (e) => {
            if (e.target === modal) showModal(false);
        });

        listContainer.addEventListener('click', (e) => {
            const button = e.target.closest('button');
            if (button && button.dataset.assetId) {
                exportAsset(button.dataset.assetId);
            }
        });

        window.Export = {
            show: () => showModal(true),
        };

        window.Debug?.log('Export Module ready.');
    }

    if (window.App?.glVersion) bootstrap();
    else window.App?.on('app:booted', bootstrap);
})();
