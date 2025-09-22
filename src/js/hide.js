// src/js/hide.js - Toggles the visibility of the active model.

(function () {
    'use strict';

    let activeAsset = null;
    let isHidden = false;

    // UI is now handled by toggles.js

    function applyVisibility() {
        if (activeAsset && activeAsset.object) {
            activeAsset.object.visible = !isHidden;
        }
    }

    function handleAssetActivated(event) {
        // When switching models, ensure the previous one is visible again
        if (activeAsset && activeAsset.object) {
            activeAsset.object.visible = true;
        }
        activeAsset = event.detail;
        // Apply the current hide state to the new model
        applyVisibility();
    }
    
    function handleAssetCleaned(event) {
        if (activeAsset && activeAsset.id === event.detail.id) {
            activeAsset = null;
        }
    }

    function bootstrap() {
        if (window.Hide) return;
        
        App.on('asset:activated', handleAssetActivated);
        App.on('asset:cleaned', handleAssetCleaned);

        // Expose a public API for the toggles UI to control this module
        window.Hide = {
            setVisible: (hidden) => {
                isHidden = !!hidden;
                applyVisibility();
            }
        };
        
        window.Debug?.log('Hide Manager (Logic) ready.');
    }

    if (window.App?.glVersion) {
        bootstrap();
    } else {
        window.App?.on('app:booted', bootstrap);
    }
})();
