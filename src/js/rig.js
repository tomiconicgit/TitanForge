// src/js/rig.js - Toggles the visibility of the active model's skeleton.

(function () {
    'use strict';

    let activeAsset = null;
    let skeletonHelper = null;
    let isVisible = false;

    function injectUI() {
        const style = document.createElement('style');
        style.textContent = `
            #tf-rig-toggle {
                position: fixed;
                /* --- FINAL POSITIONING & SIZING --- */
                bottom: 383px;
                left: 16px;
                padding: 6px 10px;
                z-index: 20;
                display: flex;
                align-items: center;
                justify-content: space-between;
                gap: 8px;
                border-radius: 16px;
                background: rgba(28, 32, 38, 0.9);
                border: 1px solid rgba(255,255,255,0.1);
                box-sizing: border-box;
            }
            #tf-rig-toggle label {
                color: #a0a7b0;
                /* --- FINAL FONT SIZING --- */
                font-size: 16px;
                font-weight: 500;
                cursor: pointer;
            }
            .tf-switch {
                position: relative;
                display: inline-block;
                width: 30px;
                height: 16px;
                flex-shrink: 0;
            }
            .tf-switch input { display: none; }
            .tf-slider {
                position: absolute;
                cursor: pointer;
                inset: 0;
                background-color: rgba(255,255,255,0.2);
                transition: .4s;
                border-radius: 16px;
            }
            .tf-slider:before {
                position: absolute;
                content: "";
                height: 12px;
                width: 12px;
                left: 2px;
                bottom: 2px;
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

    function destroyRigVisual() {
        if (skeletonHelper) {
            window.Viewer.remove(skeletonHelper);
            skeletonHelper = null;
        }
    }

    function createRigVisual() {
        destroyRigVisual();
        if (!activeAsset || !activeAsset.object) { return; }
        
        const { THREE } = window.Phonebook;
        skeletonHelper = new THREE.SkeletonHelper(activeAsset.object);
        window.Viewer.add(skeletonHelper);
    }

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
        if (isVisible) {
            createRigVisual();
        }
    }
    
    function handleAssetCleaned(event) {
        if (activeAsset && activeAsset.id === event.detail.id) {
            activeAsset = null;
            destroyRigVisual();
        }
    }

    function bootstrap() {
        if (window.Rig) return;
        
        injectUI();
        document.getElementById('rig-toggle-checkbox').addEventListener('change', handleToggle);
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
