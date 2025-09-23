// src/js/transform.js - Transform controls for the active asset.

(function () {
    'use strict';

    let panel, activeAsset, mainModel, boneModal;
    let waitingMessage, controlsContainer;
    let sliders = {};
    let boneAttachBtn, boneList;

    // --- UI Injection ---
    function injectUI() {
        const style = document.createElement('style');
        style.textContent = `
            #tf-transform-panel {
                position: fixed;
                top: calc(50vh + 54px);
                left: 0; right: 0; bottom: 0;
                background: #0D1014;
                z-index: 5;
                padding: 16px;
                box-sizing: border-box;
                overflow-y: auto;
                display: none;
            }
            #tf-transform-panel.show { display: flex; align-items: center; justify-content: center; }
            #tf-transform-waiting {
                color: #a0a7b0;
                font-size: 16px;
            }
            #tf-transform-controls {
                width: 100%;
            }
            .tf-slider-group { margin-bottom: 16px; }
            .tf-slider-group label {
                display: block;
                color: #a0a7b0;
                font-size: 14px;
                margin-bottom: 8px;
            }
            .tf-slider-group input[type=range] {
                width: 100%;
                -webkit-appearance: none;
                height: 5px;
                background: rgba(255,255,255,0.1);
                border-radius: 5px;
                outline: none;
                transition: background 0.2s ease;
            }
            .tf-slider-group input[type=range]:hover { background: rgba(255,255,255,0.2); }
            .tf-slider-group input[type=range]::-webkit-slider-thumb {
                -webkit-appearance: none;
                appearance: none;
                width: 18px;
                height: 18px;
                background: #2575fc;
                cursor: pointer;
                border-radius: 50%;
                border: 2px solid #fff;
            }
            #tf-bone-attach-section { margin-bottom: 20px; }
            #tf-bone-attach-btn {
                width: 100%;
                padding: 10px;
                font-size: 14px;
                font-weight: 600;
                border-radius: 8px;
                border: 1px solid rgba(255,255,255,0.2);
                background: rgba(255,255,255,0.1);
                color: #fff;
                cursor: pointer;
                text-align: center;
            }
            #tf-bone-attach-btn:hover { background: rgba(255,255,255,0.15); }
            .tf-bone-modal-content {
                width: min(400px, 90vw); padding: 20px;
                background: rgba(28, 32, 38, 0.95); border-radius: 12px;
                border: 1px solid rgba(255,255,255,0.1);
                box-shadow: 0 8px 30px rgba(0,0,0,0.4);
                display: flex; flex-direction: column; gap: 15px;
            }
            .tf-bone-modal-content .title {
                font-size: 18px; font-weight: 600; text-align: center;
                padding-bottom: 10px; border-bottom: 1px solid rgba(255,255,255,0.1);
            }
            .tf-bone-modal-list-container { max-height: 50vh; overflow-y: auto; }
            .tf-bone-item {
                padding: 10px 12px;
                color: #e6eef6;
                cursor: pointer;
                font-size: 14px;
                border-bottom: 1px solid rgba(255,255,255,0.08);
            }
            .tf-bone-item:last-child { border-bottom: none; }
            .tf-bone-item:hover { background: rgba(255,255,255,0.1); }
        `;
        document.head.appendChild(style);

        panel = document.createElement('div');
        panel.id = 'tf-transform-panel';
        panel.innerHTML = `
            <div id="tf-transform-waiting">Load a model to begin transforming.</div>
            <div id="tf-transform-controls" style="display: none;">
                <div id="tf-bone-attach-section" style="display: none;">
                    <button id="tf-bone-attach-btn">Attach to Bone...</button>
                </div>
                <div class="tf-slider-group">
                    <label for="pos-x">Position X</label>
                    <input type="range" id="pos-x" min="-5" max="5" value="0" step="0.01">
                </div>
                <div class="tf-slider-group">
                    <label for="pos-y">Position Y</label>
                    <input type="range" id="pos-y" min="-5" max="5" value="0" step="0.01">
                </div>
                <div class="tf-slider-group">
                    <label for="scale">Scale</label>
                    <input type="range" id="scale" min="0.1" max="3" value="1" step="0.01">
                </div>
                <div class="tf-slider-group">
                    <label for="rot-y">Rotation</label>
                    <input type="range" id="rot-y" min="-3.14" max="3.14" value="0" step="0.01">
                </div>
                <div class="tf-slider-group">
                    <label for="rot-x">Tilt</label>
                    <input type="range" id="rot-x" min="-1.57" max="1.57" value="0" step="0.01">
                </div>
            </div>
        `;
        document.getElementById('app')?.appendChild(panel);

        boneModal = document.createElement('div');
        boneModal.className = 'tf-modal-overlay';
        boneModal.innerHTML = `
            <div class="tf-bone-modal-content">
                <div class="title">Select a Bone</div>
                <div class="tf-bone-modal-list-container">
                    <div id="tf-bone-list"></div>
                </div>
            </div>
        `;
        document.body.appendChild(boneModal);
        
        waitingMessage = panel.querySelector('#tf-transform-waiting');
        controlsContainer = panel.querySelector('#tf-transform-controls');
        sliders.pos_x = panel.querySelector('#pos-x');
        sliders.pos_y = panel.querySelector('#pos-y');
        sliders.scale = panel.querySelector('#scale');
        sliders.rot_y = panel.querySelector('#rot-y');
        sliders.rot_x = panel.querySelector('#rot-x');
        boneAttachBtn = panel.querySelector('#tf-bone-attach-btn');
        boneList = boneModal.querySelector('#tf-bone-list');
    }

    function showBoneModal(visible) { boneModal.classList.toggle('show', visible); }

    // **NEW**: Function to reset the panel to its default state
    function resetPanel() {
        activeAsset = null;
        waitingMessage.style.display = 'block';
        controlsContainer.style.display = 'none';
        panel.style.justifyContent = 'center';
        panel.style.alignItems = 'center';
    }

    function syncSlidersToAsset() {
        if (!activeAsset || !activeAsset.object) return;
        const obj = activeAsset.object;
        sliders.pos_x.value = obj.position.x;
        sliders.pos_y.value = obj.position.y;
        sliders.scale.value = obj.scale.x;
        sliders.rot_y.value = obj.rotation.y;
        sliders.rot_x.value = obj.rotation.x;
    }

    function updatePanelForAsset() {
        if (!activeAsset) return;
        const boneSection = panel.querySelector('#tf-bone-attach-section');
        // Show attach button only if the active asset is NOT a main model
        const showBoneAttach = !!mainModel && !activeAsset.isMainModel;
        boneSection.style.display = showBoneAttach ? 'block' : 'none';
        
        if (showBoneAttach && activeAsset.object.parent?.isBone) {
             boneAttachBtn.textContent = `Attached to: ${activeAsset.object.parent.name}`;
        } else if (showBoneAttach) {
            boneAttachBtn.textContent = 'Attach to Bone...';
        }
        
        syncSlidersToAsset();
    }
    
    function populateBoneList() {
        boneList.innerHTML = '';
        if (!mainModel) return;

        const bones = [];
        mainModel.object.traverse(obj => { if (obj.isBone) bones.push(obj); });

        const detachItem = document.createElement('div');
        detachItem.className = 'tf-bone-item';
        detachItem.textContent = 'Detach (Move to World)';
        detachItem.dataset.boneName = 'detach';
        boneList.appendChild(detachItem);

        bones.forEach(bone => {
            const item = document.createElement('div');
            item.className = 'tf-bone-item';
            item.textContent = bone.name;
            item.dataset.boneName = bone.name;
            boneList.appendChild(item);
        });
    }
    
    // UPDATED: preserve visual size when parenting under a scaled/rotated bone
    function attachAssetToBone(boneName) {
        if (!activeAsset || !mainModel) return;

        const { THREE } = window.Phonebook;
        const obj = activeAsset.object;

        if (boneName === 'detach') {
            window.Viewer.scene.attach(obj);          // keep world transform
            boneAttachBtn.textContent = 'Attach to Bone...';
            syncSlidersToAsset();
            return;
        }

        const targetBone = mainModel.object.getObjectByName(boneName);
        if (!targetBone) return;

        // 1) cache the current world scale (visual size) before re-parenting
        const worldScaleBefore = new THREE.Vector3();
        obj.getWorldScale(worldScaleBefore);

        // 2) re-parent while preserving world transform (prevents sudden shrink/disappear)
        targetBone.attach(obj);

        // 3) snap to bone origin but compensate for bone world scale, so visual size stays constant
        const boneWorldScale = new THREE.Vector3();
        targetBone.getWorldScale(boneWorldScale);

        obj.position.set(0, 0, 0);
        obj.rotation.set(0, 0, 0);
        obj.scale.set(
            worldScaleBefore.x / (boneWorldScale.x || 1),
            worldScaleBefore.y / (boneWorldScale.y || 1),
            worldScaleBefore.z / (boneWorldScale.z || 1)
        );
        obj.updateMatrixWorld(true);

        boneAttachBtn.textContent = `Attached to: ${boneName}`;
        syncSlidersToAsset();
    }

    function handleNavChange(event) { panel.classList.toggle('show', event.detail.tab === 'transform'); }
    
    function handleAssetLoaded(event) {
        const assetData = event.detail;
        if (assetData.isMainModel) {
            mainModel = assetData;
            window.Debug?.log(`Main model designated: ${mainModel.name}`);
            populateBoneList();
        }
    }

    function handleAssetActivated(event) {
        const assetData = event.detail;

        if (!assetData) {
            resetPanel();
            return;
        }

        if (waitingMessage.style.display !== 'none') {
            waitingMessage.style.display = 'none';
            controlsContainer.style.display = 'block';
            panel.style.justifyContent = 'flex-start';
            panel.style.alignItems = 'stretch';
        }
        activeAsset = assetData;
        updatePanelForAsset();
    }
    
    function handleAssetCleaned(event) {
        if (mainModel && mainModel.id === event.detail.id) {
            mainModel = null;
            populateBoneList();
            window.Debug?.log('Main model was cleaned.');
        }
    }

    function wireEvents() {
        Navigation.on('change', handleNavChange);
        App.on('asset:loaded', handleAssetLoaded);
        App.on('asset:activated', handleAssetActivated);
        App.on('asset:cleaned', handleAssetCleaned);

        const applyTransforms = {
            pos_x: val => activeAsset.object.position.x = val,
            pos_y: val => activeAsset.object.position.y = val,
            scale: val => activeAsset.object.scale.set(val, val, val),
            rot_y: val => activeAsset.object.rotation.y = val,
            rot_x: val => activeAsset.object.rotation.x = val,
        };
        
        Object.keys(sliders).forEach(key => {
            sliders[key].addEventListener('input', e => {
                 if (activeAsset?.object) applyTransforms[key](parseFloat(e.target.value));
            });
        });
        
        boneAttachBtn.addEventListener('click', () => { if (mainModel) showBoneModal(true); });
        
        boneList.addEventListener('click', e => {
            if (e.target.matches('.tf-bone-item')) {
                attachAssetToBone(e.target.dataset.boneName);
                showBoneModal(false);
            }
        });

        boneModal.addEventListener('click', e => { if (e.target === boneModal) showBoneModal(false); });
    }

    function bootstrap() {
        if (window.Transform) return;
        injectUI();
        wireEvents();
        window.Transform = {};
        panel.classList.add('show');
        window.Debug?.log('Transform Panel ready.');
    }

    if (window.App?.glVersion) bootstrap();
    else window.App?.on('app:booted', bootstrap);
})();