// tools/attachmentrig.js
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

export function init(scene, uiContainer, onBackToDashboard) {
    let animationFrameId;
    const eventListeners = [];
    const clock = new THREE.Clock();
    let mainCharacter = null;
    const sceneObjects = new Map();
    let activeObjectId = null;

    function addTrackedListener(target, type, handler) {
        target.addEventListener(type, handler);
        eventListeners.push({ target, type, handler });
    }

    // --- UI AND ELEMENT SELECTION ---
    const floatingButtonsContainer = document.getElementById('floating-buttons-container');
    const loadBtn = document.getElementById('load-btn');
    const copyBtn = document.getElementById('copy-btn');
    const charInput = document.getElementById('char-input');
    const assetInput = document.getElementById('asset-input');
    const animInput = document.getElementById('anim-input');
    const clothingInput = document.getElementById('clothing-input');
    
    const loadDropdown = document.getElementById('load-dropdown');
    const copyDropdown = document.getElementById('copy-dropdown');
    const copyAssetBtn = document.getElementById('copy-asset-btn');
    const copyClothingBtn = document.getElementById('copy-clothing-btn');
    
    loadDropdown.style.display = 'none';
    copyDropdown.style.display = 'none';
    floatingButtonsContainer.style.display = 'flex';

    uiContainer.innerHTML = `
        <style>
            #attachment-rig-ui { display: flex; flex-direction: column; height: 100%; color: var(--text-color); position: relative; }
            #tab-container { display: flex; overflow-x: auto; padding: 10px 0; border-bottom: 1px solid var(--border-color); min-height: 50px; }
            .tab-btn { background: transparent; border: none; padding: 10px 16px; cursor: pointer; color: var(--secondary-text-color); font-weight: bold; flex-shrink: 0; transition: color 0.2s ease, border-bottom-color 0.2s ease; border-bottom: 2px solid transparent; font-size: 0.9rem; }
            .tab-btn.active { color: var(--primary-color); border-bottom-color: var(--primary-color); }
            #control-panels-container { flex-grow: 1; overflow-y: auto; padding-top: 15px; }
            .panel { display: none; }
            .panel.active { display: block; }
            .control-group { margin-bottom: 15px; }
            .control-group h3 { margin: 0 0 10px; font-size: 16px; border-bottom: 1px solid var(--border-color); padding-bottom: 5px; }
            .slider-container { display: grid; grid-template-columns: 20px 1fr 50px; align-items: center; gap: 10px; margin-bottom: 5px; }
            .attachment-select { width: 100%; padding: 8px; border-radius: 8px; border: 1px solid var(--border-color); background-color: var(--panel-bg); color: var(--text-color); }
            
            /* NEW: Styles for toggle switches */
            .toggle-container { display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px; }
            .switch { position: relative; display: inline-block; width: 44px; height: 24px; }
            .switch input { opacity: 0; width: 0; height: 0; }
            .slider { position: absolute; cursor: pointer; top: 0; left: 0; right: 0; bottom: 0; background-color: #333; transition: .4s; }
            .slider:before { position: absolute; content: ""; height: 18px; width: 18px; left: 3px; bottom: 3px; background-color: white; transition: .4s; }
            input:checked + .slider { background-color: var(--primary-color); }
            input:checked + .slider:before { transform: translateX(20px); }
            .slider.round { border-radius: 24px; }
            .slider.round:before { border-radius: 50%; }

            .modal-bg { position: fixed; z-index: 100; left: 0; top: 0; width: 100%; height: 100%; background-color: rgba(0,0,0,0.4); display: flex; align-items: center; justify-content: center; }
            .modal-content { background: var(--panel-bg); border-radius: 24px; padding: 30px; width: 90%; max-width: 400px; text-align: center; box-shadow: 0 10px 30px rgba(0,0,0,0.5); backdrop-filter: blur(40px); -webkit-backdrop-filter: blur(40px); display: flex; flex-direction: column; gap: 1.5rem; transform: scale(0.9); opacity: 0; animation: modal-fade-in 0.3s forwards; color: var(--text-color); }
            @keyframes modal-fade-in { to { transform: scale(1); opacity: 1; } }
            .modal-loader { border: 4px solid var(--border-color); border-top: 4px solid var(--primary-color); border-radius: 50%; width: 40px; height: 40px; animation: spin 1s linear infinite; margin: 0 auto; }
            @keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
        </style>
        <div id="attachment-rig-ui">
            <div id="tab-container"></div>
            <div id="control-panels-container"></div>
            <div class="anim-controls-container" style="display: none; justify-content: space-around; padding: 10px; background: rgba(0,0,0,0.2); border-radius: 12px; margin-top: 1rem;">
                <button class="btn secondary step-back-btn" style="flex: 1;">&lt;&lt;</button>
                <button class="btn secondary play-pause-btn" style="flex: 2;">Pause</button>
                <button class="btn secondary step-fwd-btn" style="flex: 1;">&gt;&gt;</button>
            </div>
        </div>
        <div id="main-modal" class="modal-bg" style="display: none;"><div class="modal-content" id="modal-content"></div></div>
    `;

    const tabContainer = document.getElementById('tab-container');
    const controlPanelsContainer = document.getElementById('control-panels-container');
    const animControlsContainer = document.querySelector('.anim-controls-container');
    const playPauseBtn = document.querySelector('.play-pause-btn');
    const stepFwdBtn = document.querySelector('.step-fwd-btn');
    const stepBackBtn = document.querySelector('.step-back-btn');
    
    const gltfLoader = new GLTFLoader();

    function normalizeAndCenterModel(model) { /* ... function is unchanged ... */ }
    const showModal = (contentHTML) => { /* ... function is unchanged ... */ };
    const hideModal = () => { /* ... function is unchanged ... */ };
    const resetScene = () => { /* ... function is unchanged ... */ };
    
    // MODIFIED: loadObject now finds and stores all sub-meshes for the character
    const loadObject = (files, type) => {
        if (!files || files.length === 0) return;
        if (type !== 'character' && !mainCharacter) {
             alert("Please load a main character model first!");
             return;
        }

        Array.from(files).forEach(file => {
            showModal(`<h2 class="modal-title">Loading ${type}</h2><p>Processing: ${file.name}</p><div class="modal-loader"></div>`);
            const reader = new FileReader();
            reader.onload = (e) => {
                gltfLoader.parse(e.target.result, '', (gltf) => {
                    if (type === 'character') resetScene();
                    
                    const model = gltf.scene;
                    model.name = file.name.replace(/\.[^/.]+$/, "");

                    if (type === 'character') {
                        normalizeAndCenterModel(model);
                    }
                    
                    model.traverse(node => { if (node.isMesh) node.castShadow = true; });
                    
                    const objectData = {
                        mesh: model,
                        bones: [],
                        mixer: null,
                        activeAction: null,
                        isPaused: true,
                        type: type,
                        // NEW: Store sub-meshes for characters
                        subMeshes: []
                    };
                    
                    model.traverse(node => { if (node.isBone) objectData.bones.push(node.name); });
                    
                    // NEW: If it's a character, find all its visible parts
                    if (type === 'character') {
                        model.traverse(node => {
                            if (node.isMesh || node.isSkinnedMesh) {
                                objectData.subMeshes.push(node);
                            }
                        });
                    }
                    
                    sceneObjects.set(model.uuid, objectData);
                    scene.add(model);
                    if (type === 'character') mainCharacter = objectData;

                    createUIForObject(objectData);
                    setActiveObject(model.uuid);
                    hideModal();
                }, (error) => { showModal(`<h2 class="modal-title" style="color: var(--error-color);">Error</h2><p>Failed to parse GLB file.</p>`); console.error(error); });
            };
            reader.readAsArrayBuffer(file);
        });
    };

    const loadAnimation = (file) => { /* ... function is unchanged ... */ };
    
    const createUIForObject = (objectData) => { /* ... function is unchanged ... */ };

    // --- START: MODIFIED RENDERPANELCONTENT FUNCTION ---
    const renderPanelContent = (objectData) => {
        const { mesh, type } = objectData;
        const panel = document.querySelector(`.panel[data-id="${mesh.uuid}"]`);
        if (!panel) return;
        
        let panelHTML = '';

        if (type === 'character') {
            // UI for the main character: list of sub-meshes with toggles
            panelHTML += `<div class="control-group"><h3>Body Parts</h3>`;
            if (objectData.subMeshes.length > 0) {
                objectData.subMeshes.forEach(subMesh => {
                    panelHTML += createToggle(subMesh.uuid, subMesh.name, subMesh.visible);
                });
            } else {
                panelHTML += `<p>No individual meshes found.</p>`;
            }
            panelHTML += `</div>`;
        } else {
            // UI for assets and clothing: sliders and a single visibility toggle
            panelHTML += `<div class="control-group">
                <h3>Position, Rotation, Scale</h3>
                ${createSlider('pos-x', 'X', mesh.position.x, -5, 5, 0.01, mesh.uuid)}
                ${createSlider('pos-y', 'Y', mesh.position.y, -5, 5, 0.01, mesh.uuid)}
                ${createSlider('pos-z', 'Z', mesh.position.z, -5, 5, 0.01, mesh.uuid)}
                ${createSlider('rot-x', 'X', THREE.MathUtils.radToDeg(mesh.rotation.x), -180, 180, 1, mesh.uuid)}
                ${createSlider('rot-y', 'Y', THREE.MathUtils.radToDeg(mesh.rotation.y), -180, 180, 1, mesh.uuid)}
                ${createSlider('rot-z', 'Z', THREE.MathUtils.radToDeg(mesh.rotation.z), -180, 180, 1, mesh.uuid)}
                ${createSlider('scale-all', 'S', mesh.scale.x, 0.1, 5, 0.01, mesh.uuid)}
            </div>`;

            if (mainCharacter) {
                const boneOptions = mainCharacter.bones.map(name => `<option value="${name}">${name}</option>`).join('');
                panelHTML += `<div class="control-group"><h3>Attachment</h3>
                    <select class="attachment-select" data-id="${mesh.uuid}">
                        <option value="scene">-- Detach (World) --</option>
                        ${boneOptions}
                    </select></div>`;
            }

            panelHTML += `<div class="control-group"><h3>Visibility</h3>${createToggle(mesh.uuid, 'Visible', mesh.visible)}</div>`;
        }

        panel.innerHTML = panelHTML;
        addEventListenersToPanel(panel, objectData);
    };
    // --- END: MODIFIED RENDERPANELCONTENT FUNCTION ---

    // NEW: Helper function to create HTML for a toggle switch
    const createToggle = (uuid, label, isVisible) => {
        return `
            <div class="toggle-container">
                <label for="toggle-${uuid}">${label}</label>
                <label class="switch">
                    <input type="checkbox" id="toggle-${uuid}" data-mesh-uuid="${uuid}" ${isVisible ? 'checked' : ''}>
                    <span class="slider round"></span>
                </label>
            </div>
        `;
    };
    
    // MODIFIED: addEventListenersToPanel now handles the new toggles
    const addEventListenersToPanel = (panel, objectData) => {
        const { mesh, type } = objectData;
        
        // Slider logic (unchanged)
        panel.querySelectorAll('input[type="range"], input[type="number"]').forEach(input => {
            input.addEventListener('input', () => {
                const getVal = (id) => parseFloat(panel.querySelector(`[data-uuid="${mesh.uuid}"][id^="${id}-"]`).value);
                mesh.position.set(getVal('pos-x'), getVal('pos-y'), getVal('pos-z'));
                mesh.rotation.set(
                    THREE.MathUtils.degToRad(getVal('rot-x')),
                    THREE.MathUtils.degToRad(getVal('rot-y')),
                    THREE.MathUtils.degToRad(getVal('rot-z'))
                );
                const scale = getVal('scale-all');
                mesh.scale.set(scale, scale, scale);
                if (input.type === 'range') { panel.querySelector(`#${input.id.replace(/-range$/, '-num')}`).value = input.value; }
                if (input.type === 'number') { panel.querySelector(`#${input.id.replace(/-num$/, '-range')}`).value = input.value; }
            });
        });

        // Attachment select logic (unchanged)
        const attachmentSelect = panel.querySelector('.attachment-select');
        if (attachmentSelect) {
            attachmentSelect.addEventListener('change', (e) => {
                const boneName = e.target.value;
                if (boneName === 'scene') { scene.attach(mesh); } 
                else { const bone = mainCharacter.mesh.getObjectByName(boneName); if (bone) bone.attach(mesh); }
            });
        }

        // NEW: Toggle switch logic
        panel.querySelectorAll('input[type="checkbox"][data-mesh-uuid]').forEach(toggle => {
            toggle.addEventListener('change', (e) => {
                const meshUuid = e.target.dataset.meshUuid;
                let meshToToggle;

                if (type === 'character') {
                    // Find the sub-mesh within the character
                    meshToToggle = objectData.subMeshes.find(m => m.uuid === meshUuid);
                } else {
                    // It's the main mesh of an asset or clothing item
                    meshToToggle = mesh;
                }

                if (meshToToggle) {
                    meshToToggle.visible = e.target.checked;
                }
            });
        });
    };
    
    const createSlider = (id, label, value, min, max, step, uuid) => { /* ... function is unchanged ... */ };
    const setActiveObject = (id) => { /* ... function is unchanged ... */ };
    const copyAssetInfo = () => { /* ... function is unchanged ... */ };
    const copyClothingInfo = () => { /* ... function is unchanged ... */ };
    
    // --- EVENT LISTENERS (UNCHANGED) ---
    const handleDropdown = (btn, dropdown) => (event) => { /* ... */ };
    addTrackedListener(loadBtn, 'click', handleDropdown(loadBtn, loadDropdown));
    addTrackedListener(copyBtn, 'click', handleDropdown(copyBtn, copyDropdown));
    addTrackedListener(window, 'click', () => { /* ... */ });
    addTrackedListener(charInput, 'change', (e) => loadObject(e.target.files, 'character'));
    addTrackedListener(assetInput, 'change', (e) => loadObject(e.target.files, 'asset'));
    addTrackedListener(clothingInput, 'change', (e) => loadObject(e.target.files, 'clothing'));
    addTrackedListener(animInput, 'change', (e) => loadAnimation(e.target.files[0]));
    addTrackedListener(copyAssetBtn, 'click', copyAssetInfo);
    addTrackedListener(copyClothingBtn, 'click', copyClothingInfo);
    addTrackedListener(playPauseBtn, 'click', () => { /* ... */ });
    addTrackedListener(stepFwdBtn, 'click', () => { /* ... */ });
    addTrackedListener(stepBackBtn, 'click', () => { /* ... */ });
    
    // --- ANIMATION LOOP (UNCHANGED) ---
    const animateTool = () => { /* ... */ };
    animateTool();

    // --- RETURN CLEANUP FUNCTION (UNCHANGED) ---
    return function cleanup() { /* ... */ };
}
