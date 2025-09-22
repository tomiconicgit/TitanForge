// src/js/hide.js - Toggles the visibility of the active model.

(function () {
    'use strict';

    let activeAsset = null;
    let isHidden = false;

    function injectUI() {
        const style = document.createElement('style');
        style.textContent = `
            #tf-hide-toggle {
                position: fixed;
                /* --- FINAL POSITIONING --- */
                bottom: 374px;
                left: 139px; /* Positioned right next to the rig toggle */
                z-index: 20;
                display: flex;
                align-items: center;
                justify-content: space-between;
                gap: 8px;
                padding: 6px 10px;
                border-radius: 16px;
                background: rgba(28, 32, 38, 0.9);
                border: 1px solid rgba(255,255,255,0.1);
                box-sizing: border-box;
            }
            #tf-hide-toggle label {
                color: #a0a7b0;
                /* --- FINAL FONT SIZING --- */
                font-size: 12px;
                font-weight: 500;
                cursor: pointer;
            }
        `;
        document.head.appendChild(style);

        const container = document.createElement('div');
        container.id = 'tf-hide-toggle';
        // The .tf-switch and .tf-slider classes are globally defined by rig.js, so we can reuse them here.
        container.innerHTML = `
            <label for="hide-toggle-checkbox">Hide</label>
            <label class="tf-switch">
                <input type="checkbox" id="hide-toggle-checkbox">
                <span class="tf-slider"></span>
            </label>
        `;
        document.getElementById('app')?.appendChild(container);
    }

    /**
     * Applies the current visibility state to the active asset.
     */
    function applyVisibility() {
        if (activeAsset && activeAsset.object) {
            activeAsset.object.visible = !isHidden;
        }
    }

    /**
     * Handles the user clicking the toggle switch.
     */
    function handleToggle(event) {
        isHidden = event.target.checked;
        applyVisibility();
    }

    /**
     * Listens for when a new asset becomes active.
     */
    function handleAssetActivated(event) {
        // When switching models, ensure the previous one is visible again
        if (activeAsset && activeAsset.object) {
            activeAsset.object.visible = true;
        }

        activeAsset = event.detail;
        
        // Apply the current hide state to the new model
        applyVisibility();
    }
    
    /**
     * Listens for when an asset is removed from the scene.
     */
    function handleAssetCleaned(event) {
        if (activeAsset && activeAsset.id === event.detail.id) {
            activeAsset = null;
        }
    }

    /**
     * Initializes the module.
     */
    function bootstrap() {
        if (window.Hide) return;
        
        injectUI();
        document.getElementById('hide-toggle-checkbox').addEventListener('change', handleToggle);
        
        // Listen to global application events
        App.on('asset:activated', handleAssetActivated);
        App.on('asset:cleaned', handleAssetCleaned);

        window.Hide = {};
        window.Debug?.log('Hide Manager ready.');
    }

    if (window.App?.glVersion) {
        bootstrap();
    } else {
        window.App?.on('app:booted', bootstrap);
    }
})();
