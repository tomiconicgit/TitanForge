// src/js/rig.js - Toggles the visibility of the main model's skeleton.
(function () {
    'use strict';

    // FIX: This module should only ever operate on the main model, not any active asset.
    let mainModel = null;
    let skeletonHelper = null;
    let isVisible = false;

    function destroyRigVisual() {
        if (skeletonHelper) {
            window.Viewer.remove(skeletonHelper);
            skeletonHelper.dispose(); // Free up GPU resources
            skeletonHelper = null;
        }
    }

    function createRigVisual() {
        destroyRigVisual(); // Always clear the old one first
        if (!mainModel || !mainModel.object) { return; }
        
        const { THREE } = window.Phonebook;
        skeletonHelper = new THREE.SkeletonHelper(mainModel.object);
        skeletonHelper.material.linewidth = 2; // Make it a bit more visible
        window.Viewer.add(skeletonHelper);
    }

    // FIX: Listen for when the main model is loaded or cleaned.
    function handleAssetLoaded(event) {
        if (event.detail?.isMainModel) {
            mainModel = event.detail;
            if (isVisible) {
                createRigVisual();
            }
        }
    }
    
    function handleAssetCleaned(event) {
        if (mainModel && mainModel.id === event.detail.id) {
            mainModel = null;
            destroyRigVisual();
        }
    }

    function bootstrap() {
        if (window.Rig) return;
        
        App.on('asset:loaded', handleAssetLoaded);
        App.on('asset:cleaned', handleAssetCleaned);

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
