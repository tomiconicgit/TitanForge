// src/js/cleaner.js - Disposes of 3D assets to free up memory.

(function () {
    'use strict';

    let cleaningModal;

    // --- Helper for disposing materials and their textures ---
    function disposeMaterial(material) {
        if (material.map) material.map.dispose();
        if (material.lightMap) material.lightMap.dispose();
        if (material.bumpMap) material.bumpMap.dispose();
        if (material.normalMap) material.normalMap.dispose();
        if (material.specularMap) material.specularMap.dispose();
        if (material.envMap) material.envMap.dispose();
        material.dispose();
    }

    // --- The main disposal logic ---
    function disposeAsset(asset) {
        if (!asset || !asset.object) return;

        // Traverse the object to find and dispose of meshes
        asset.object.traverse(obj => {
            if (obj.isMesh) {
                // Dispose of the geometry
                if (obj.geometry) {
                    obj.geometry.dispose();
                }
                // Dispose of the material(s)
                if (obj.material) {
                    if (Array.isArray(obj.material)) {
                        obj.material.forEach(disposeMaterial);
                    } else {
                        disposeMaterial(obj.material);
                    }
                }
            }
        });

        // Remove the object from the viewer's scene
        window.Viewer.remove(asset.object);
    }

    // --- UI and Modal Control ---
    function injectUI() {
        cleaningModal = document.createElement('div');
        cleaningModal.className = 'tf-modal-overlay'; // Reuse class from model.js
        cleaningModal.innerHTML = `
            <div class="tf-loading-modal">
                <div class="title">Cleaning Asset</div>
                <div class="progress-bar"><div class="progress-fill"></div></div>
                <div class="status-text">Starting cleanup...</div>
                <div class="summary-text" style="display: none; text-align: center; color: #a0a7b0; margin-top: 10px;"></div>
                <button class="complete-btn">Complete</button>
            </div>
        `;
        document.body.appendChild(cleaningModal);
    }

    function showCleaningModal(visible) {
        cleaningModal.classList.toggle('show', visible);
        if (!visible) {
            // Reset modal for next time
            updateModalProgress(0, 'Starting cleanup...');
            cleaningModal.querySelector('.complete-btn').style.display = 'none';
            cleaningModal.querySelector('.summary-text').style.display = 'none';
        }
    }

    function updateModalProgress(percent, status) {
        const fill = cleaningModal.querySelector('.progress-fill');
        const text = cleaningModal.querySelector('.status-text');
        if (fill) fill.style.width = `${percent}%`;
        if (text) text.textContent = status;
    }

    function showSummary(asset) {
        const summaryEl = cleaningModal.querySelector('.summary-text');
        summaryEl.innerHTML = `
            Freed: <strong>${asset.polygons.toLocaleString()}</strong> polygons, 
            <strong>${asset.vertices.toLocaleString()}</strong> vertices.<br>
            (Approx. ${asset.fileSize} of data)
        `;
        summaryEl.style.display = 'block';

        const btn = cleaningModal.querySelector('.complete-btn');
        btn.style.display = 'block';
        btn.onclick = () => showCleaningModal(false);
    }

    // --- Public API ---
    function bootstrap() {
        if (window.Cleaner) return;

        injectUI();

        window.Cleaner = {
            clean: (assetToClean) => {
                if (!assetToClean) return;
                
                showCleaningModal(true);

                // Simulate a step-by-step cleanup process for better UX
                setTimeout(() => {
                    updateModalProgress(25, 'Removing from scene...');
                    setTimeout(() => {
                        updateModalProgress(50, 'Disposing geometries...');
                        setTimeout(() => {
                            updateModalProgress(75, 'Releasing materials & textures...');
                            
                            // Perform the actual cleanup
                            disposeAsset(assetToClean);

                            setTimeout(() => {
                                updateModalProgress(100, 'Cleanup Complete!');
                                showSummary(assetToClean);
                                // Notify other modules that the asset is gone
                                App.emit('asset:cleaned', { id: assetToClean.id });
                            }, 300);
                        }, 500);
                    }, 500);
                }, 300);
            }
        };

        window.Debug?.log('Cleaner Module ready.');
    }

    if (window.App?.glVersion) {
        bootstrap();
    } else {
        window.App?.on('app:booted', bootstrap);
    }
})();
