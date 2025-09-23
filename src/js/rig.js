// src/js/rig.js - Toggles the visibility of the active model's skeleton.

(function () {
    'use strict';

    let activeAsset = null;
    let skeletonHelper = null;
    let isVisible = false;

    // UI is now handled by toggles.js

    function destroyRigVisual() {
        if (skeletonHelper) {
            window.Viewer.remove(skeletonHelper);
            skeletonHelper.dispose(); // Free up GPU resources
            skeletonHelper = null;
        }
    }

    function createRigVisual() {
        destroyRigVisual(); // Always clear the old one first
        if (!activeAsset || !activeAsset.object) { return; }
        
        const { THREE } = window.Phonebook;
        skeletonHelper = new THREE.SkeletonHelper(activeAsset.object);
        skeletonHelper.material.linewidth = 2; // Make it a bit more visible
        window.Viewer.add(skeletonHelper);
    }

    function handleAssetActivated(event) {
        // FIX: Unconditionally destroy the old helper before switching to the new asset.
        destroyRigVisual();
        
        activeAsset = event.detail;

        // If the rig toggle is already on, create the visual for the new model.
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
        
        App.on('asset:activated', handleAssetActivated);
        App.on('asset:cleaned', handleAssetCleaned);

        // Expose a public API for the toggles UI to control this module
        window.Rig = {
            setVisible: (visible) => {
                isVisible = !!visible;
                if (isVisible) {
                    createRigVisual();
                } else {
                    destroyRigVisual();
                }
            }
        };

        window.Debug?.log('Rig Manager (Logic) ready.');
    }

    if (window.App?.glVersion) {
        bootstrap();
    } else {
        window.App?.on('app:booted', bootstrap);
    }
})();
