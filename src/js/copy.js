// src/js/copy.js - Copies transform data of the active asset to the clipboard.
(function () {
    'use strict';

    // --- Module State ---
    let modal, copyBtn, statusText, checkboxes;
    let activeAsset = null;

    // --- UI Injection ---
    function injectUI() {
        const style = document.createElement('style');
        style.textContent = `
            /* Styles for the modal content */
            .tf-copy-modal-content {
                width: min(400px, 90vw);
                padding: 25px;
                background: rgba(28, 32, 38, 0.95);
                border-radius: 12px;
                border: 1px solid rgba(255,255,255,0.1);
                display: flex; flex-direction: column; gap: 20px;
                color: #e6eef6;
            }
            .tf-copy-modal-content .title {
                font-size: 18px; font-weight: 600; text-align: center;
            }

            /* Checkbox options styling */
            .tf-copy-options {
                display: flex; flex-direction: column; gap: 15px;
                border-top: 1px solid rgba(255,255,255,0.1);
                border-bottom: 1px solid rgba(255,255,255,0.1);
                padding: 20px 0;
            }
            .tf-checkbox-row {
                display: flex; align-items: center; gap: 12px;
                cursor: pointer; font-size: 15px;
            }
            .tf-checkbox-row input {
                accent-color: #2575fc;
                width: 18px; height: 18px;
            }
            
            /* Action area at the bottom */
            .tf-copy-actions {
                display: flex; flex-direction: column; align-items: center; gap: 10px;
            }
            #tf-copy-btn {
                width: 100%; padding: 12px; font-size: 15px; font-weight: 600;
                border: none; border-radius: 8px;
                background: linear-gradient(90deg, #6a11cb 0%, #2575fc 100%);
                color: #fff; cursor: pointer;
            }
            #tf-copy-status {
                font-size: 13px; color: #a0a7b0; height: 16px;
            }
        `;
        document.head.appendChild(style);

        modal = document.createElement('div');
        modal.id = 'tf-copy-modal';
        modal.className = 'tf-modal-overlay'; // Re-use style from model.js
        modal.innerHTML = `
            <div class="tf-copy-modal-content">
                <div class="title">Copy Asset Data</div>
                <div class="tf-copy-options">
                    <label class="tf-checkbox-row">
                        <input type="checkbox" name="position" checked>
                        <span>Position (X, Y)</span>
                    </label>
                    <label class="tf-checkbox-row">
                        <input type="checkbox" name="scale" checked>
                        <span>Scale</span>
                    </label>
                    <label class="tf-checkbox-row">
                        <input type="checkbox" name="rotation" checked>
                        <span>Rotation (X, Y)</span>
                    </label>
                    <label class="tf-checkbox-row">
                        <input type="checkbox" name="bone" checked>
                        <span>Attached Bone</span>
                    </label>
                </div>
                <div class="tf-copy-actions">
                    <button id="tf-copy-btn">Copy to Clipboard</button>
                    <span id="tf-copy-status"></span>
                </div>
            </div>
        `;
        document.body.appendChild(modal);

        copyBtn = modal.querySelector('#tf-copy-btn');
        statusText = modal.querySelector('#tf-copy-status');
        checkboxes = {
            position: modal.querySelector('input[name="position"]'),
            scale: modal.querySelector('input[name="scale"]'),
            rotation: modal.querySelector('input[name="rotation"]'),
            bone: modal.querySelector('input[name="bone"]'),
        };
    }

    // --- Logic ---
    function showModal(visible) {
        statusText.textContent = ''; // Clear status on show
        modal.classList.toggle('show', visible);
    }

    function generateAndCopyData() {
        if (!activeAsset) {
            statusText.textContent = 'Error: No active asset selected.';
            return;
        }

        const dataToCopy = {
            assetName: activeAsset.name,
        };
        const obj = activeAsset.object;

        if (checkboxes.position.checked) {
            dataToCopy.position = { x: obj.position.x, y: obj.position.y, z: obj.position.z };
        }
        if (checkboxes.scale.checked) {
            dataToCopy.scale = { x: obj.scale.x, y: obj.scale.y, z: obj.scale.z };
        }
        if (checkboxes.rotation.checked) {
            // Copying Euler rotation in XYZ order
            dataToCopy.rotation = { x: obj.rotation.x, y: obj.rotation.y, z: obj.rotation.z };
        }
        if (checkboxes.bone.checked) {
            dataToCopy.attachedToBone = (obj.parent && obj.parent.isBone) ? obj.parent.name : null;
        }

        const jsonString = JSON.stringify(dataToCopy, null, 2);

        navigator.clipboard.writeText(jsonString).then(() => {
            statusText.textContent = 'Copied successfully!';
        }).catch(err => {
            statusText.textContent = 'Error: Could not copy.';
            console.error('Clipboard API error:', err);
        });
    }

    // --- Event Handling & Bootstrap ---
    function bootstrap() {
        if (window.Copy) return;

        injectUI();

        // Listen for the globally active asset
        App.on('asset:activated', (event) => {
            activeAsset = event.detail;
        });

        // Wire up modal events
        copyBtn.addEventListener('click', generateAndCopyData);
        modal.addEventListener('click', (e) => {
            if (e.target === modal) showModal(false); // Close if backdrop is clicked
        });

        // Expose public API
        window.Copy = {
            show: () => showModal(true),
            hide: () => showModal(false),
        };

        window.Debug?.log('Copy Module ready.');
    }

    if (window.App?.glVersion) bootstrap();
    else window.App?.on('app:booted', bootstrap);
})();
