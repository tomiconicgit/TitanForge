// src/js/export.js - Exports a modified asset as a new GLB file using a Web Worker.
(function () {
    'use strict';

    // --- Module State ---
    let modal, listContainer, statusText, progressBar, progressFill;
    const assets = new Map();

    // --- UI Injection (No changes needed here) ---
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
                transition: background-color 0.2s ease, opacity 0.2s ease;
            }
            #tf-export-list button:hover {
                background-color: rgba(255,255,255,0.15);
            }
             #tf-export-list button:disabled {
                opacity: 0.5;
                cursor: not-allowed;
            }
            #tf-export-list .no-assets {
                text-align: center;
                color: #a0a7b0;
                padding: 20px 0;
            }
            #tf-export-status {
                font-size: 13px; color: #a0a7b0; height: 16px; text-align: center;
            }
            /* Progress Bar Styles */
            .tf-export-progress-bar {
                width: 100%; height: 10px; background: rgba(255,255,255,0.1);
                border-radius: 5px; overflow: hidden;
            }
            .tf-export-progress-fill {
                width: 0%; height: 100%;
                background: linear-gradient(90deg, #6a11cb 0%, #2575fc 100%);
                transition: width 0.3s ease-out;
            }
        `;
        document.head.appendChild(style);

        modal = document.createElement('div');
        modal.id = 'tf-export-modal';
        modal.className = 'tf-modal-overlay';
        modal.innerHTML = `
            <div class="tf-export-modal-content">
                <div class="title">Export Model as GLB</div>
                <div id="tf-export-list"></div>
                <div class="tf-export-progress-bar" style="display: none;">
                    <div class="tf-export-progress-fill"></div>
                </div>
                <div id="tf-export-status">Select an item to download.</div>
            </div>
        `;
        document.body.appendChild(modal);

        listContainer = modal.querySelector('#tf-export-list');
        statusText = modal.querySelector('#tf-export-status');
        progressBar = modal.querySelector('.tf-export-progress-bar');
        progressFill = modal.querySelector('.tf-export-progress-fill');
    }

    // --- Logic ---
    function showModal(visible) {
        if (visible) {
            populateList();
            statusText.textContent = 'Select an item to download.';
            progressBar.style.display = 'none';
        }
        modal.classList.toggle('show', visible);
    }

    function populateList() {
        listContainer.innerHTML = '';
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

    function exportAsset(assetId) {
        const asset = assets.get(assetId);
        if (!asset || !asset.object) {
            statusText.textContent = 'Error: Asset not found.';
            return;
        }

        // --- UI Setup & Progress Simulation ---
        listContainer.querySelectorAll('button').forEach(b => b.disabled = true);
        progressBar.style.display = 'block';
        progressFill.style.background = '';
        const updateProgress = (percent, text) => {
            progressFill.style.width = `${percent}%`;
            statusText.textContent = `${text} (${percent}%)`;
        };
        updateProgress(10, 'Preparing data');

        // --- Initialize and Manage the Worker ---
        const worker = new Worker('./src/js/export-worker.js', { type: 'module' });

        worker.onmessage = (event) => {
            if (event.data.error) {
                console.error('Worker Error:', event.data.error);
                updateProgress(100, 'Export failed!');
                progressFill.style.background = '#ff3b30'; // Error color
                listContainer.querySelectorAll('button').forEach(b => b.disabled = false);
            } else {
                updateProgress(95, 'Creating file');
                const glb = event.data.glb;
                const blob = new Blob([glb], { type: 'model/gltf-binary' });
                const url = URL.createObjectURL(blob);
                const link = document.createElement('a');

                const baseName = asset.name.endsWith('.glb') ? asset.name.slice(0, -4) : asset.name;
                link.download = `exported_${baseName}.glb`;
                link.href = url;
                document.body.appendChild(link);
                link.click();
                
                document.body.removeChild(link);
                URL.revokeObjectURL(url);
                
                updateProgress(100, 'Download complete!');
                setTimeout(() => showModal(false), 1200);
            }
            worker.terminate();
        };

        worker.onerror = (err) => {
            console.error('A fatal error occurred in the worker:', err);
            updateProgress(100, 'Critical worker error!');
            progressFill.style.background = '#ff3b30';
            listContainer.querySelectorAll('button').forEach(b => b.disabled = false);
            worker.terminate();
        };
        
        // Give the UI a moment to update before starting the heavy task
        setTimeout(() => {
            try {
                // To bake the final world transform, we first apply it to the object
                // before serialization. The worker will then reset the local transform.
                asset.object.updateWorldMatrix(true, true);
                const modelJson = asset.object.toJSON();

                updateProgress(40, 'Exporting in background');
                
                // Send the serialized data to the worker to start the export
                worker.postMessage({ modelJson });
            } catch (e) {
                console.error("Error preparing data for worker:", e);
                updateProgress(100, 'Failed to prepare data!');
                progressFill.style.background = '#ff3b30';
                listContainer.querySelectorAll('button').forEach(b => b.disabled = false);
                worker.terminate();
            }
        }, 300);
    }
    
    // --- Event Handling & Bootstrap ---
    function bootstrap() {
        if (window.Export) return;
        injectUI();
        App.on('asset:loaded', (event) => assets.set(event.detail.id, event.detail));
        App.on('asset:cleaned', (event) => assets.delete(event.detail.id));
        modal.addEventListener('click', (e) => { if (e.target === modal) showModal(false); });
        listContainer.addEventListener('click', (e) => {
            const button = e.target.closest('button');
            if (button && button.dataset.assetId) exportAsset(button.dataset.assetId);
        });
        window.Export = { show: () => showModal(true) };
        window.Debug?.log('Export Module (Worker) ready.');
    }

    if (window.App?.glVersion) bootstrap();
    else window.App?.on('app:booted', bootstrap);
})();
