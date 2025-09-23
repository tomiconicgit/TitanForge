// src/js/transform.js - Transform controls for the active asset.

(function () {
    'use strict';

    let panel, activeAsset, mainModel, boneModal;
    let waitingMessage, controlsContainer;
    let boneAttachBtn, boneList;

    // Gizmo (TransformControls)
    let transformControls = null;
    let gizmoEnabledCheckbox, gizmoModesContainer;
    let currentGizmoMode = 'translate';

    // --- Slider Configuration ---
    // These define the initial visible range for the sliders.
    // The text input allows entering values outside this range.
    const SLIDER_CONFIG = {
        pos:   { min: -10, max: 10, step: 0.01 },
        rot:   { min: -Math.PI, max: Math.PI, step: 0.01 },
        scale: { min: 0.01, max: 10, step: 0.01 },
    };
    
    // --- Helper function for formatting numbers in text inputs ---
    function formatNumber(value, key) {
        // Rotations are in radians; show more precision for them.
        const decimals = (key.startsWith('rot')) ? 3 : 2;
        // Use parseFloat and toFixed to handle potential floating point inaccuracies
        return parseFloat(Number(value).toFixed(decimals));
    }

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
            #tf-transform-waiting { color: #a0a7b0; font-size: 16px; }
            #tf-transform-controls { width: 100%; max-width: 600px; margin: 0 auto; }
            .tf-slider-group { margin-bottom: 12px; }
            .tf-slider-group label {
                display: block; color: #a0a7b0; font-size: 14px; margin-bottom: 8px;
            }
            
            /* NEW: Flex container for slider, buttons, and text input */
            .tf-slider-controls {
                display: flex;
                align-items: center;
                gap: 10px;
            }
            .tf-slider-range {
                flex-grow: 1; /* The slider takes up the remaining space */
                -webkit-appearance: none;
                height: 5px;
                background: rgba(255,255,255,0.1);
                border-radius: 5px;
                outline: none;
            }
            .tf-slider-range::-webkit-slider-thumb {
                -webkit-appearance: none; appearance: none;
                width: 18px; height: 18px; background: #2575fc; cursor: pointer;
                border-radius: 50%; border: 2px solid #fff;
            }

            /* NEW: Arrow buttons for fine control */
            .tf-slider-btn {
                flex-shrink: 0;
                width: 30px; height: 30px;
                font-size: 20px; font-weight: 500;
                padding: 0; line-height: 30px; text-align: center;
                border-radius: 6px; border: 1px solid rgba(255,255,255,0.2);
                background: rgba(255,255,255,0.1); color: #fff; cursor: pointer;
                transition: background-color 0.2s ease;
            }
            .tf-slider-btn:hover { background: rgba(255,255,255,0.15); }
            
            /* NEW: Text input for direct value entry */
            .tf-slider-input {
                flex-shrink: 0;
                width: 75px;
                padding: 6px;
                background: rgba(0,0,0,0.3);
                border: 1px solid #555;
                color: #fff; border-radius: 5px;
                font-size: 14px; text-align: center;
                -moz-appearance: textfield; /* Hide number spinners in Firefox */
            }
            .tf-slider-input::-webkit-outer-spin-button,
            .tf-slider-input::-webkit-inner-spin-button {
                -webkit-appearance: none; margin: 0; /* Hide spinners in Chrome/Safari */
            }

            #tf-bone-attach-section { margin-bottom: 12px; }
            #tf-bone-attach-btn, #tf-reset-centre-btn {
                width: 100%; padding: 10px; font-size: 14px; font-weight: 600;
                border-radius: 8px; border: 1px solid rgba(255,255,255,0.2);
                background: rgba(255,255,255,0.1); color: #fff; cursor: pointer; text-align: center;
                transition: background .2s ease;
            }
            #tf-bone-attach-btn:hover, #tf-reset-centre-btn:hover { background: rgba(255,255,255,0.15); }
            .tf-actions { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-bottom: 12px; }

            /* Gizmo controls styling remains the same */
            #tf-gizmo-controls { margin: 10px 0 16px 0; display: none; }
            .tf-row { display:flex; align-items:center; justify-content:space-between; margin-bottom:8px; }
            .tf-switch { position: relative; display: inline-block; width: 30px; height: 16px; flex-shrink: 0; }
            .tf-switch input { display: none; }
            .tf-slider-switch-thumb { /* Renamed from .tf-slider to avoid ambiguity */
                position: absolute; cursor: pointer; inset: 0; background-color: rgba(255,255,255,0.2);
                transition: .4s; border-radius: 16px;
            }
            .tf-slider-switch-thumb:before {
                position: absolute; content: ""; height: 12px; width: 12px; left: 2px; bottom: 2px;
                background-color: white; transition: .4s; border-radius: 50%;
            }
            input:checked + .tf-slider-switch-thumb { background-color: #00c853; }
            input:checked + .tf-slider-switch-thumb:before { transform: translateX(14px); }
            .tf-gizmo-modes { display:flex; gap:8px; }
            .tf-gizmo-modes button {
                flex:1; padding:8px; font-size:13px; font-weight:600; border:none; border-radius:6px;
                background: rgba(255,255,255,0.1); color:#e6eef6; cursor:pointer;
            }
            .tf-gizmo-modes button.active { background: rgba(37,117,252,0.35); }
            
            /* Bone modal styling remains the same */
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
                padding: 10px 12px; color: #e6eef6; cursor: pointer; font-size: 14px;
                border-bottom: 1px solid rgba(255,255,255,0.08);
            }
            .tf-bone-item:last-child { border-bottom: none; }
            .tf-bone-item:hover { background: rgba(255,255,255,0.1); }
        `;
        document.head.appendChild(style);

        // --- Dynamically generate slider controls for cleaner code ---
        const controlDefs = [
            { key: 'pos_x', label: 'Position X', ...SLIDER_CONFIG.pos },
            { key: 'pos_y', label: 'Position Y', ...SLIDER_CONFIG.pos },
            { key: 'pos_z', label: 'Position Z', ...SLIDER_CONFIG.pos },
            { key: 'scale', label: 'Scale', ...SLIDER_CONFIG.scale },
            { key: 'rot_y', label: 'Rotation (Yaw)', ...SLIDER_CONFIG.rot },
            { key: 'rot_x', label: 'Tilt (Pitch)', ...SLIDER_CONFIG.rot },
        ];

        const slidersHTML = controlDefs.map(c => `
            <div class="tf-slider-group" data-control="${c.key}">
                <label>${c.label}</label>
                <div class="tf-slider-controls">
                    <button class="tf-slider-btn" data-action="dec" aria-label="Decrease ${c.label}">&minus;</button>
                    <input type="range" class="tf-slider-range" 
                           min="${c.min}" max="${c.max}" value="0" step="${c.step}">
                    <button class="tf-slider-btn" data-action="inc" aria-label="Increase ${c.label}">&plus;</button>
                    <input type="number" class="tf-slider-input" step="${c.step}" value="0">
                </div>
            </div>
        `).join('');

        panel = document.createElement('div');
        panel.id = 'tf-transform-panel';
        panel.innerHTML = `
            <div id="tf-transform-waiting">Load a model to begin transforming.</div>
            <div id="tf-transform-controls" style="display: none;">
                <div id="tf-bone-attach-section" style="display: none;">
                    <div class="tf-actions">
                        <button id="tf-bone-attach-btn">Attach to Bone...</button>
                        <button id="tf-reset-centre-btn">Reset to Centre</button>
                    </div>
                </div>

                <div id="tf-gizmo-controls">
                    <div class="tf-row">
                        <label for="tf-gizmo-enable" style="color:#e6eef6;">Gizmo</label>
                        <label class="tf-switch">
                            <input type="checkbox" id="tf-gizmo-enable">
                            <span class="tf-slider-switch-thumb"></span>
                        </label>
                    </div>
                    <div class="tf-gizmo-modes" id="tf-gizmo-modes">
                        <button data-mode="translate" class="active">Move</button>
                        <button data-mode="rotate">Rotate</button>
                        <button data-mode="scale">Scale</button>
                    </div>
                </div>
                ${slidersHTML}
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
        boneAttachBtn = panel.querySelector('#tf-bone-attach-btn');
        boneList = boneModal.querySelector('#tf-bone-list');
        gizmoEnabledCheckbox = panel.querySelector('#tf-gizmo-enable');
        gizmoModesContainer = panel.querySelector('#tf-gizmo-modes');

        panel.querySelector('#tf-reset-centre-btn').addEventListener('click', resetToCentre);
    }

    function showBoneModal(visible) { boneModal.classList.toggle('show', visible); }

    function resetPanel() {
        activeAsset = null;
        waitingMessage.style.display = 'block';
        controlsContainer.style.display = 'none';
        panel.style.justifyContent = 'center';
        panel.style.alignItems = 'center';
        setGizmoEnabled(false);
    }
    
    // Syncs all UI controls (sliders and text boxes) to match the active asset's state
    function syncSlidersToAsset() {
        if (!activeAsset?.object) return;
        const o = activeAsset.object;
        const values = {
            pos_x: o.position.x,
            pos_y: o.position.y,
            pos_z: o.position.z,
            scale: o.scale.x,
            rot_y: o.rotation.y,
            rot_x: o.rotation.x,
        };

        Object.entries(values).forEach(([key, value]) => {
            const group = controlsContainer.querySelector(`[data-control="${key}"]`);
            if (group) {
                group.querySelector('.tf-slider-range').value = value;
                group.querySelector('.tf-slider-input').value = formatNumber(value, key);
            }
        });
    }


    function updatePanelForAsset() {
        if (!activeAsset) return;
        const boneSection = panel.querySelector('#tf-bone-attach-section');
        const showBoneAttach = !!mainModel && !activeAsset.isMainModel;
        boneSection.style.display = showBoneAttach ? 'block' : 'none';

        document.getElementById('tf-gizmo-controls').style.display = 'block';

        if (showBoneAttach && activeAsset.object.parent?.isBone) {
            boneAttachBtn.textContent = `Attached to: ${activeAsset.object.parent.name}`;
        } else if (showBoneAttach) {
            boneAttachBtn.textContent = 'Attach to Bone...';
        }

        syncSlidersToAsset();
        if (transformControls && gizmoEnabledCheckbox.checked) {
            transformControls.attach(activeAsset.object);
        }
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

    function attachAssetToBone(boneName) {
        if (!activeAsset || !mainModel) return;

        const { THREE } = window.Phonebook;
        const obj = activeAsset.object;

        if (boneName === 'detach') {
            window.Viewer.scene.attach(obj);
            boneAttachBtn.textContent = 'Attach to Bone...';
            syncSlidersToAsset();
            return;
        }

        const targetBone = mainModel.object.getObjectByName(boneName);
        if (!targetBone) return;

        const worldScaleBefore = new THREE.Vector3();
        obj.getWorldScale(worldScaleBefore);

        targetBone.attach(obj);

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
        if (transformControls && gizmoEnabledCheckbox.checked) transformControls.attach(obj);
    }

    function resetToCentre() {
        if (!activeAsset?.object) return;
        const obj = activeAsset.object;
        obj.position.set(0, 0, 0);
        obj.rotation.set(0, 0, 0);
        obj.updateMatrixWorld(true);
        syncSlidersToAsset();
        if (transformControls && gizmoEnabledCheckbox.checked) {
            transformControls.update();
        }
    }

    async function ensureTransformControls() {
        if (transformControls) return transformControls;
        const mod = await import('three/addons/controls/TransformControls.js');
        const { camera, renderer, controls: orbit, scene } = window.Viewer;

        transformControls = new mod.TransformControls(camera, renderer.domElement);
        transformControls.setMode(currentGizmoMode);
        transformControls.addEventListener('dragging-changed', (e) => {
            if (orbit) orbit.enabled = !e.value;
        });
        transformControls.addEventListener('change', () => {
            if (activeAsset?.object) syncSlidersToAsset();
        });
        scene.add(transformControls);
        return transformControls;
    }

    async function setGizmoEnabled(enabled) {
        if (!enabled) {
            if (transformControls) {
                transformControls.detach();
            }
            return;
        }
        await ensureTransformControls();
        if (activeAsset?.object) {
            transformControls.setMode(currentGizmoMode);
            transformControls.attach(activeAsset.object);
        }
    }

    function handleNavChange(event) {
        const show = event.detail.tab === 'transform';
        panel.classList.toggle('show', show);
        if (!show) setGizmoEnabled(false);
    }
    
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
        if (activeAsset && activeAsset.id === event.detail.id) {
            activeAsset = null;
            if (transformControls) transformControls.detach();
        }
    }

    function wireEvents() {
        Navigation.on('change', handleNavChange);
        App.on('asset:loaded', handleAssetLoaded);
        App.on('asset:activated', handleAssetActivated);
        App.on('asset:cleaned', handleAssetCleaned);

        const apply = {
            pos_x: v => activeAsset.object.position.x = v,
            pos_y: v => activeAsset.object.position.y = v,
            pos_z: v => activeAsset.object.position.z = v,
            scale: v => activeAsset.object.scale.set(v, v, v),
            rot_y: v => activeAsset.object.rotation.y = v,
            rot_x: v => activeAsset.object.rotation.x = v,
        };

        // --- Event Delegation for all slider controls ---

        // Listen for 'input' on sliders and text boxes
        controlsContainer.addEventListener('input', e => {
            if (!activeAsset?.object) return;
            const group = e.target.closest('.tf-slider-group');
            if (!group) return;

            const key = group.dataset.control;
            const rangeInput = group.querySelector('.tf-slider-range');
            const numberInput = group.querySelector('.tf-slider-input');
            
            let value;
            // If the range slider was moved, update the text box
            if (e.target === rangeInput) {
                value = parseFloat(rangeInput.value);
                numberInput.value = formatNumber(value, key);
            } 
            // If the text box was changed, update the range slider
            else if (e.target === numberInput) {
                value = parseFloat(numberInput.value);
                if (isNaN(value)) return; // Ignore invalid text input
                rangeInput.value = value;
            } else {
                return; // Not an element we care about
            }
            
            apply[key](value); // Apply the transformation to the 3D object
            
            if (transformControls && gizmoEnabledCheckbox.checked) {
                transformControls.update();
            }
        });

        // Listen for 'click' on increment/decrement buttons
        controlsContainer.addEventListener('click', e => {
            const btn = e.target.closest('.tf-slider-btn');
            if (!btn) return;
            
            const group = btn.closest('.tf-slider-group');
            const rangeInput = group.querySelector('.tf-slider-range');
            const numberInput = group.querySelector('.tf-slider-input');
            const step = parseFloat(rangeInput.step);
            
            let currentValue = parseFloat(numberInput.value);
            if(isNaN(currentValue)) currentValue = 0;

            if (btn.dataset.action === 'inc') {
                currentValue += step;
            } else if (btn.dataset.action === 'dec') {
                currentValue -= step;
            }

            // Update the number input first, then dispatch an event to sync everything else
            numberInput.value = currentValue;
            numberInput.dispatchEvent(new Event('input', { bubbles: true }));
        });

        boneAttachBtn.addEventListener('click', () => { if (mainModel) showBoneModal(true); });
        boneList.addEventListener('click', e => {
            if (e.target.matches('.tf-bone-item')) {
                attachAssetToBone(e.target.dataset.boneName);
                showBoneModal(false);
            }
        });
        boneModal.addEventListener('click', e => { if (e.target === boneModal) showBoneModal(false); });
        gizmoEnabledCheckbox.addEventListener('change', e => setGizmoEnabled(e.target.checked));
        gizmoModesContainer.addEventListener('click', async (e) => {
            const btn = e.target.closest('button');
            if (!btn) return;
            currentGizmoMode = btn.dataset.mode;
            gizmoModesContainer.querySelectorAll('button').forEach(b => b.classList.toggle('active', b === btn));
            if (!gizmoEnabledCheckbox.checked) return;
            await ensureTransformControls();
            transformControls.setMode(currentGizmoMode);
        });
    }

    function bootstrap() {
        if (window.Transform) return;
        injectUI();
        wireEvents();
        window.Transform = {};
        panel.classList.add('show');
        window.Debug?.log('Transform Panel ready (v2: precision controls).');
    }

    if (window.App?.glVersion) bootstrap();
    else window.App?.on('app:booted', bootstrap);
})();
