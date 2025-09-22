// src/js/transform.js - Transform controls for the active asset.

(function () {
    'use strict';

    let panel, activeAsset, mainModel;
    let sliders = {};
    let boneAttachBtn, boneDropdown, boneList;

    // --- UI Injection ---
    function injectUI() {
        const style = document.createElement('style');
        style.textContent = `
            #tf-transform-panel {
                position: fixed;
                top: calc(50vh + 54px); /* Below viewer and nav bar */
                left: 0; right: 0; bottom: 0;
                background: #0D1014;
                z-index: 5;
                padding: 16px;
                box-sizing: border-box;
                overflow-y: auto;
                display: none; /* Hidden by default */
            }
            #tf-transform-panel.show { display: block; }
            .tf-slider-group {
                margin-bottom: 16px;
            }
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
            .tf-slider-group input[type=range]:hover {
                 background: rgba(255,255,255,0.2);
            }
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
            #tf-bone-attach-section {
                margin-bottom: 20px;
                position: relative;
            }
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
             #tf-bone-attach-btn:hover {
                background: rgba(255,255,255,0.15);
             }
            #tf-bone-dropdown {
                display: none;
                position: absolute;
                bottom: calc(100% + 4px);
                left: 0;
                right: 0;
                max-height: 25vh;
                overflow-y: auto;
                background: #1c2026;
                border: 1px solid rgba(255,255,255,0.1);
                border-radius: 8px;
                z-index: 10;
            }
            #tf-bone-dropdown.show { display: block; }
            .tf-bone-item {
                padding: 10px;
                color: #e6eef6;
                cursor: pointer;
                font-size: 14px;
                border-bottom: 1px solid rgba(255,255,255,0.1);
            }
            .tf-bone-item:last-child { border-bottom: none; }
            .tf-bone-item:hover { background: rgba(255,255,255,0.2); }
        `;
        document.head.appendChild(style);

        panel = document.createElement('div');
        panel.id = 'tf-transform-panel';
        panel.innerHTML = `
            <div id="tf-bone-attach-section" style="display: none;">
                <button id="tf-bone-attach-btn">Attach to Bone...</button>
                <div id="tf-bone-dropdown"><div id="tf-bone-list"></div></div>
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
        `;
        document.getElementById('app')?.appendChild(panel);
        
        sliders.pos_x = panel.querySelector('#pos-x');
        sliders.pos_y = panel.querySelector('#pos-y');
        sliders.scale = panel.querySelector('#scale');
        sliders.rot_y = panel.querySelector('#rot-y');
        sliders.rot_x = panel.querySelector('#rot-x');
        boneAttachBtn = panel.querySelector('#tf-bone-attach-btn');
        boneDropdown = panel.querySelector('#tf-bone-dropdown');
        boneList = panel.querySelector('#tf-bone-list');
    }

    // --- Logic ---
    function syncSlidersToAsset() {
        if (!activeAsset || !activeAsset.object) return;
        const obj = activeAsset.object;
        sliders.pos_x.value = obj.position.x;
        sliders.pos_y.value = obj.position.y;
        sliders.scale.value = obj.scale.x; // Assumes uniform scale
        sliders.rot_y.value = obj.rotation.y;
        sliders.rot_x.value = obj.rotation.x;
    }

    function updatePanelForAsset() {
        const boneSection = panel.querySelector('#tf-bone-attach-section');
        const showBoneAttach = !!activeAsset && !!mainModel && activeAsset.id !== mainModel.id;
        boneSection.style.display = showBoneAttach ? 'block' : 'none';
        
        if (showBoneAttach && activeAsset.object.parent && activeAsset.object.parent.isBone) {
             boneAttachBtn.textContent = `Attached to: ${activeAsset.object.parent.name}`;
        } else if (showBoneAttach) {
            boneAttachBtn.textContent = 'Attach to Bone...';
        }
        
        syncSlidersToAsset();
    }
    
    function populateBoneList() {
        if (!mainModel) return;
        boneList.innerHTML = '';
        
        const bones = [];
        mainModel.object.traverse(obj => {
            if (obj.isBone) bones.push(obj);
        });

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
    
    function attachAssetToBone(boneName) {
        if (!activeAsset || !mainModel) return;

        if (boneName === 'detach') {
            window.Viewer.scene.attach(activeAsset.object);
            syncSlidersToAsset(); // Update sliders to reflect new world transforms
            boneAttachBtn.textContent = 'Attach to Bone...';
            return;
        }

        const targetBone = mainModel.object.getObjectByName(boneName);
        if (targetBone) {
            targetBone.attach(activeAsset.object);
            // Reset local transforms to snap the asset to the bone's origin
            activeAsset.object.position.set(0, 0, 0);
            activeAsset.object.rotation.set(0, 0, 0);
            activeAsset.object.scale.set(1, 1, 1);
            
            syncSlidersToAsset(); // Update sliders to new zeroed/one values
            boneAttachBtn.textContent = `Attached to: ${boneName}`;
        }
    }

    // --- Event Handlers ---
    function handleNavChange(event) {
        panel.classList.toggle('show', event.detail.tab === 'transform');
    }
    
    function handleAssetLoaded(event) {
        if (mainModel) return; // Main model already found
        const assetData = event.detail;
        assetData.object.traverse(obj => {
            if (obj.isSkinnedMesh) {
                mainModel = assetData;
                window.Debug?.log(`Main model designated: ${mainModel.name}`);
                populateBoneList();
                return;
            }
        });
    }

    function handleAssetActivated(event) {
        activeAsset = event.detail;
        updatePanelForAsset();
    }

    function wireEvents() {
        Navigation.on('change', handleNavChange);
        App.on('asset:loaded', handleAssetLoaded);
        App.on('asset:activated', handleAssetActivated);

        const applyTransforms = {
            pos_x: val => activeAsset.object.position.x = val,
            pos_y: val => activeAsset.object.position.y = val,
            scale: val => activeAsset.object.scale.set(val, val, val),
            rot_y: val => activeAsset.object.rotation.y = val,
            rot_x: val => activeAsset.object.rotation.x = val,
        };
        
        Object.keys(sliders).forEach(key => {
            sliders[key].addEventListener('input', e => {
                 if (activeAsset && activeAsset.object) {
                    applyTransforms[key](parseFloat(e.target.value));
                }
            });
        });
        
        boneAttachBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            boneDropdown.classList.toggle('show');
        });
        
        boneList.addEventListener('click', (event) => {
            if (event.target.matches('.tf-bone-item')) {
                const boneName = event.target.dataset.boneName;
                attachAssetToBone(boneName);
            }
        });

        // Close dropdown on outside click
         window.addEventListener('click', () => {
            if (boneDropdown.classList.contains('show')) {
                boneDropdown.classList.remove('show');
            }
        });
    }

    // --- Bootstrap ---
    function bootstrap() {
        if (window.Transform) return;
        injectUI();
        wireEvents();
        window.Transform = {};

        // "Transform" is the default active nav tab, so show this panel on load.
        panel.classList.add('show');
        window.Debug?.log('Transform Panel ready.');
    }

    if (window.App?.glVersion) {
        bootstrap();
    } else {
        window.App?.on('app:booted', bootstrap);
    }
})();
