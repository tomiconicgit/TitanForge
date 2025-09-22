// src/js/rig.js - Toggles the visibility of the active model's skeleton.

(function () {
    'use strict';

    let activeAsset = null;
    let skeletonHelper = null;
    let isVisible = false;

    // --- UI Injection ---
    function injectUI() {
        const style = document.createElement('style');
        style.textContent = `
            #tf-rig-toggle {
                position: fixed;
                /* --- CORRECTED POSITIONING --- */
                bottom: calc(50vh + 16px); /* 16px above the viewer's bottom edge */
                left: 16px;
                z-index: 20;
                display: flex;
                align-items: center;
                gap: 10px;
                background: rgba(28, 32, 38, 0.9);
                padding: 8px 12px;
                border-radius: 20px;
                border: 1px solid rgba(255,255,255,0.1);
            }
            #tf-rig-toggle label {
                color: #a0a7b0;
                font-size: 14px;
                font-weight: 500;
                cursor: pointer;
            }
            .tf-switch {
                position: relative;
                display: inline-block;
                width: 34px;
                height: 20px;
            }
            .tf-switch input { display: none; }
            .tf-slider {
                position: absolute;
                cursor: pointer;
                inset: 0;
                background-color: rgba(255,255,255,0.2);
                transition: .4s;
                border-radius: 20px;
            }
            .tf-slider:before {
                position: absolute;
                content: "";
                height: 14px;
                width: 14px;
                left: 3px;
                bottom: 3px;
                background-color: white;
                transition: .4s;
                border-radius: 50%;
            }
            input:checked + .tf-slider {
                background-color: #00c853;
            }
            input:checked + .tf-slider:before {
                transform: translateX(14px);
            }
        `;
        document.head.appendChild(style);

        const container = document.createElement('div');
        container.id = 'tf-rig-toggle';
        container.innerHTML = `
            <label for="rig-toggle-checkbox">Show Rig</label>
            <label class="tf-switch">
                <input type="checkbox" id="rig-toggle-checkbox">
                <span class="tf-slider"></span>
            </label>
        `;
        document.getElementById('app')?.appendChild(container);
    }

    // --- Core Logic ---
    function destroyRigVisual() {
        if (skeletonHelper) {
            window.Viewer.remove(skeletonHelper);
            // SkeletonHelper does not need manual disposal of geometry/material
            skeletonHelper = null;
        }
    }

    function createRigVisual() {
        destroyRigVisual(); // Clean up any existing helper first
        if (!activeAsset || !activeAsset.object) {
            console.log('No active asset with a rig to display.');
            return;
        }
        
        const { THREE } = window.Phonebook;
        skeletonHelper = new THREE.SkeletonHelper(activeAsset.object);
        window.Viewer.add(skeletonHelper);
    }

    // --- Event Handlers ---
    function handleToggle(event) {
        isVisible = event.target.checked;
        if (isVisible) {
            createRigVisual();
        } else {
            destroyRigVisual();
        }
    }

    function handleAssetActivated(event) {
        activeAsset = event.detail;
        // If the toggle is already on, update the rig to the new model
        if (isVisible) {
            createRigVisual();
        }
    }
    
    function handleAssetCleaned(event) {
        // If the asset being cleaned is the active one, remove its rig
        if (activeAsset && activeAsset.id === event.detail.id) {
            activeAsset = null;
            destroyRigVisual();
        }
    }

    function bootstrap() {
        if (window.Rig) return;
        
        injectUI();

        // Listen for UI interaction
        document.getElementById('rig-toggle-checkbox').addEventListener('change', handleToggle);

        // Listen for global app events
        App.on('asset:activated', handleAssetActivated);
        App.on('asset:cleaned', handleAssetCleaned);

        window.Rig = {};
        window.Debug?.log('Rig Manager ready.');
    }

    if (window.App?.glVersion) {
        bootstrap();
    } else {
        window.App?.on('app:booted', bootstrap);
    }
})();
