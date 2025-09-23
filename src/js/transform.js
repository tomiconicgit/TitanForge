// src/js/transform.js - Transform controls for the active asset.

(function () {
    'use strict';

    let panel, activeAsset, mainModel, boneModal;
    let waitingMessage, controlsContainer;
    let sliders = {};
    let boneAttachBtn, boneList;

    // Gizmo (TransformControls)
    let transformControls = null;
    let gizmoEnabledCheckbox, gizmoModesContainer;
    let currentGizmoMode = 'translate';

    // --- Slider config + dynamic range expand ---
    const INITIAL = {
        pos: { min: -10, max: 10, step: 0.01 },
        rotY: { min: -Math.PI, max: Math.PI, step: 0.01 },
        rotX: { min: -Math.PI, max: Math.PI, step: 0.01 },
        scale: { min: 0.01, max: 10, step: 0.01 },
    };

    function applySliderConfig(input, { min, max, step }) {
        input.min = String(min);
        input.max = String(max);
        input.step = String(step);
    }

    function expandRangeIfNeeded(input, value) {
        const min = parseFloat(input.min), max = parseFloat(input.max);
        const span = max - min;
        const nearMax = value > (max - 0.05 * span);
        const nearMin = value < (min + 0.05 * span);
        if (nearMax || nearMin) {
            const factor = 2; // double the range
            const newMin = nearMin ? min - span : min;
            const newMax = nearMax ? max + span : max;
            input.min = String(newMin);
            input.max = String(newMax);
        }
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
            #tf-transform-controls { width: 100%; }
            .tf-slider-group { margin-bottom: 14px; }
            .tf-slider-group label {
                display: block; color: #a0a7b0; font-size: 14px; margin-bottom: 6px;
            }
            .tf-slider-group input[type=range] {
                width: 100%; -webkit-appearance: none; height: 5px;
                background: rgba(255,255,255,0.1); border-radius: 5px; outline: none;
            }
            .tf-slider-group input[type=range]::-webkit-slider-thumb {
                -webkit-appearance: none; appearance: none;
                width: 18px; height: 18px; background: #2575fc; cursor: pointer;
                border-radius: 50%; border: 2px solid #fff;
            }

            #tf-bone-attach-section { margin-bottom: 16px; }
            #tf-bone-attach-btn {
                width: 100%; padding: 10px; font-size: 14px; font-weight: 600;
                border-radius: 8px; border: 1px solid rgba(255,255,255,0.2);
                background: rgba(255,255,255,0.1); color: #fff; cursor: pointer; text-align: center;
            }
            #tf-bone-attach-btn:hover { background: rgba(255,255,255,0.15); }

            /* Gizmo controls */
            #tf-gizmo-controls { margin: 10px 0 16px 0; display: none; }
            .tf-row { display:flex; align-items:center; justify-content:space-between; margin-bottom:8px; }
            .tf-switch { position: relative; display: inline-block; width: 30px; height: 16px; flex-shrink: 0; }
            .tf-switch input { display: none; }
            .tf-slider {
                position: absolute; cursor: pointer; inset: 0; background-color: rgba(255,255,255,0.2);
                transition: .4s; border-radius: 16px;
            }
            .tf-slider:before {
                position: absolute; content: ""; height: 12px; width: 12px; left: 2px; bottom: 2px;
                background-color: white; transition: .4s; border-radius: 50%;
            }
            input:checked + .tf-slider { background-color: #00c853; }
            input:checked + .tf-slider:before { transform: translateX(14px); }

            .tf-gizmo-modes { display:flex; gap:8px; }
            .tf-gizmo-modes button {
                flex:1; padding:8px; font-size:13px; font-weight:600; border:none; border-radius:6px;
                background: rgba(255,255,255,0.1); color:#e6eef6; cursor:pointer;
            }
            .tf-gizmo-modes button.active { background: rgba(37,117,252,0.35); }
            
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

        panel = document.createElement('div');
        panel.id = 'tf-transform-panel';
        panel.innerHTML = `
            <div id="tf-transform-waiting">Load a model to begin transforming.</div>
            <div id="tf-transform-controls" style="display: none;">
                <div id="tf-bone-attach-section" style="display: none;">
                    <button id="tf-bone-attach-btn">Attach to Bone...</button>
                </div>

                <div id="tf-gizmo-controls">
                    <div class="tf-row">
                        <label for="tf-gizmo-enable" style="color:#e6eef6;">Gizmo</label>
                        <label class="tf-switch">
                            <input type="checkbox" id="tf-gizmo-enable">
                            <span class="tf-slider"></span>
                        </label>
                    </div>
                    <div class="tf-gizmo-modes" id="tf-gizmo-modes">
                        <button data-mode="translate" class="active">Move</button>
                        <button data-mode="rotate">Rotate</button>
                        <button data-mode="scale">Scale</button>
                    </div>
                </div>

                <div class="tf-slider-group">
                    <label for="pos-x">Position X</label>
                    <input type="range" id="pos-x">
                </div>
                <div class="tf-slider-group">
                    <label for="pos-y">Position Y</label>
                    <input type="range" id="pos-y">
                </div>
                <div class="tf-slider-group">
                    <label for="pos-z">Position Z</label>
                    <input type="range" id="pos-z">
                </div>
                <div class="tf-slider-group">
                    <label for="scale">Scale</label>
                    <input type="range" id="scale">
                </div>
                <div class="tf-slider-group">
                    <label for="rot-y">Rotation (Yaw)</label>
                    <input type="range" id="rot-y">
                </div>
                <div class="tf-slider-group">
                    <label for="rot-x">Tilt (Pitch)</label>
                    <input type="range" id="rot-x">
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
        sliders.pos_z = panel.querySelector('#pos-z');
        sliders.scale = panel.querySelector('#scale');
        sliders.rot_y = panel.querySelector('#rot-y');
        sliders.rot_x = panel.querySelector('#rot-x');

        // Apply initial ranges
        applySliderConfig(sliders.pos_x, INITIAL.pos);
        applySliderConfig(sliders.pos_y, INITIAL.pos);
        applySliderConfig(sliders.pos_z, INITIAL.pos);
        applySliderConfig(sliders.scale, INITIAL.scale);
        applySliderConfig(sliders.rot_y, INITIAL.rotY);
        applySliderConfig(sliders.rot_x, INITIAL.rotX);

        boneAttachBtn = panel.querySelector('#tf-bone-attach-btn');
        boneList = boneModal.querySelector('#tf-bone-list');

        gizmoEnabledCheckbox = panel.querySelector('#tf-gizmo-enable');
        gizmoModesContainer = panel.querySelector('#tf-gizmo-modes');
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

    function syncSlidersToAsset() {
        if (!activeAsset?.object) return;
        const o = activeAsset.object;
        sliders.pos_x.value = o.position.x;
        sliders.pos_y.value = o.position.y;
        sliders.pos_z.value = o.position.z;
        sliders.scale.value = o.scale.x;
        sliders.rot_y.value = o.rotation.y;
        sliders.rot_x.value = o.rotation.x;
    }

    function updatePanelForAsset() {
        if (!activeAsset) return;
        const boneSection = panel.querySelector('#tf-bone-attach-section');
        const showBoneAttach = !!mainModel && !activeAsset.isMainModel;
        boneSection.style.display = showBoneAttach ? 'block' : 'none';

        // Gizmo controls are useful for ANY asset (main or not); show when controls visible
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

    // Preserve visual size when parenting under a scaled/rotated bone
    function attachAssetToBone(boneName) {
        if (!activeAsset || !mainModel) return;

        const { THREE } = window.Phonebook;
        const obj = activeAsset.object;

        if (boneName === 'detach') {
            window.Viewer.scene.attach(obj); // keep world transform
            boneAttachBtn.textContent = 'Attach to Bone...';
            syncSlidersToAsset();
            return;
        }

        const targetBone = mainModel.object.getObjectByName(boneName);
        if (!targetBone) return;

        const worldScaleBefore = new THREE.Vector3();
        obj.getWorldScale(worldScaleBefore);

        targetBone.attach(obj); // preserve world transform

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

    // --- Gizmo (TransformControls) setup ---
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
            // keep sliders in sync during gizmo moves
            if (activeAsset?.object) syncSlidersToAsset();
        });
        scene.add(transformControls);
        return transformControls;
    }

    async function setGizmoEnabled(enabled) {
        if (!enabled) {
            if (transformControls) {
                transformControls.detach();
                // keep it around for reuse; no need to remove from scene
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

        // Slider -> object bindings (with dynamic range expansion)
        const apply = {
            pos_x: v => activeAsset.object.position.x = v,
            pos_y: v => activeAsset.object.position.y = v,
            pos_z: v => activeAsset.object.position.z = v,
            scale: v => activeAsset.object.scale.set(v, v, v),
            rot_y: v => activeAsset.object.rotation.y = v,
            rot_x: v => activeAsset.object.rotation.x = v,
        };

        Object.entries(sliders).forEach(([key, input]) => {
            input.addEventListener('input', e => {
                if (!activeAsset?.object) return;
                const val = parseFloat(e.target.value);
                // expand range as needed
                expandRangeIfNeeded(input, val);
                // apply
                apply[key](val);
                // keep gizmo attached
                if (transformControls && gizmoEnabledCheckbox.checked) {
                    transformControls.update();
                }
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

        // Gizmo toggle + modes
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
        window.Debug?.log('Transform Panel ready (extended ranges + gizmo).');
    }

    if (window.App?.glVersion) bootstrap();
    else window.App?.on('app:booted', bootstrap);
})();