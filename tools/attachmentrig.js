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

    function normalizeAndCenterModel(model) {
        model.rotation.set(-Math.PI / 2, 0, Math.PI);
        const box = new THREE.Box3().setFromObject(model);
        const size = box.getSize(new THREE.Vector3());
        const targetHeight = 1.75;
        if (size.y > 0) {
            const scaleFactor = targetHeight / size.y;
            model.scale.setScalar(scaleFactor);
        }
        const scaledBox = new THREE.Box3().setFromObject(model);
        model.position.y = -scaledBox.min.y;
    }

    const showModal = (contentHTML) => { const modal = document.getElementById('main-modal'); modal.querySelector('#modal-content').innerHTML = contentHTML; modal.style.display = 'flex'; };
    const hideModal = () => { document.getElementById('main-modal').style.display = 'none'; };
    const resetScene = () => { sceneObjects.forEach(data => scene.remove(data.mesh)); sceneObjects.clear(); mainCharacter = null; tabContainer.innerHTML = ''; controlPanelsContainer.innerHTML = ''; animControlsContainer.style.display = 'none'; activeObjectId = null; };
    
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
                        type: type 
                    };
                    
                    model.traverse(node => { if (node.isBone) objectData.bones.push(node.name); });
                    
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

    const loadAnimation = (file) => { /* ... unchanged ... */ };
    
    const createUIForObject = (objectData) => {
        const tab = document.createElement('button');
        tab.className = 'tab-btn';
        tab.textContent = objectData.mesh.name;
        tab.dataset.id = objectData.mesh.uuid;
        tab.onclick = () => setActiveObject(objectData.mesh.uuid);
        tabContainer.appendChild(tab);
        const panel = document.createElement('div');
        panel.className = 'panel';
        panel.dataset.id = objectData.mesh.uuid;
        controlPanelsContainer.appendChild(panel);
        renderPanelContent(objectData);
    };

    // --- START: MODIFIED RENDERPANELCONTENT FUNCTION ---
    const renderPanelContent = (objectData) => {
        const { mesh } = objectData;
        const panel = document.querySelector(`.panel[data-id="${mesh.uuid}"]`);
        if (!panel) return;

        // Sliders are now generated for ALL object types
        let panelHTML = `<div class="control-group">
            <h3>Position</h3>
            ${createSlider('pos-x', 'X', mesh.position.x, -5, 5, 0.01, mesh.uuid)}
            ${createSlider('pos-y', 'Y', mesh.position.y, -5, 5, 0.01, mesh.uuid)}
            ${createSlider('pos-z', 'Z', mesh.position.z, -5, 5, 0.01, mesh.uuid)}
            <h3>Rotation (Degrees)</h3>
            ${createSlider('rot-x', 'X', THREE.MathUtils.radToDeg(mesh.rotation.x), -180, 180, 1, mesh.uuid)}
            ${createSlider('rot-y', 'Y', THREE.MathUtils.radToDeg(mesh.rotation.y), -180, 180, 1, mesh.uuid)}
            ${createSlider('rot-z', 'Z', THREE.MathUtils.radToDeg(mesh.rotation.z), -180, 180, 1, mesh.uuid)}
            <h3>Scale</h3>
            ${createSlider('scale-all', 'S', mesh.scale.x, 0.1, 5, 0.01, mesh.uuid)}
        </div>`;

        // The attachment dropdown is ONLY added for non-character objects
        if (mainCharacter && objectData.type !== 'character') {
            const boneOptions = mainCharacter.bones.map(name => `<option value="${name}">${name}</option>`).join('');
            panelHTML += `<div class="control-group"><h3>Attachment</h3>
                <select class="attachment-select" data-id="${mesh.uuid}">
                    <option value="scene">-- Detach (World) --</option>
                    ${boneOptions}
                </select></div>`;
        }

        panel.innerHTML = panelHTML;
        addEventListenersToPanel(panel, objectData);
    };
    // --- END: MODIFIED RENDERPANELCONTENT FUNCTION ---
    
    const addEventListenersToPanel = (panel, objectData) => {
        const { mesh } = objectData;
        panel.querySelectorAll('input[type="range"], input[type="number"]').forEach(input => {
            input.addEventListener('input', () => {
                const getVal = (id) => parseFloat(panel.querySelector(`[data-uuid="${objectData.mesh.uuid}"][id^="${id}-"]`).value);
                mesh.position.set(getVal('pos-x'), getVal('pos-y'), getVal('pos-z'));
                mesh.rotation.set(
                    THREE.MathUtils.degToRad(getVal('rot-x')),
                    THREE.MathUtils.degToRad(getVal('rot-y')),
                    THREE.MathUtils.degToRad(getVal('rot-z'))
                );
                const scale = getVal('scale-all');
                mesh.scale.set(scale, scale, scale);
                if (input.type === 'range') {
                    panel.querySelector(`#${input.id.replace(/-range$/, '-num')}`).value = input.value;
                }
                if (input.type === 'number') {
                    panel.querySelector(`#${input.id.replace(/-num$/, '-range')}`).value = input.value;
                }
            });
        });
        const attachmentSelect = panel.querySelector('.attachment-select');
        if (attachmentSelect) {
            attachmentSelect.addEventListener('change', (e) => {
                const boneName = e.target.value;
                if (boneName === 'scene') {
                    scene.attach(mesh);
                } else {
                    const bone = mainCharacter.mesh.getObjectByName(boneName);
                    if (bone) bone.attach(mesh);
                }
            });
        }
    };
    
    const createSlider = (id, label, value, min, max, step, uuid) => {
        const uniqueId = `${id}-${uuid}`;
        return `<div class="slider-container">
                    <label>${label}</label>
                    <input type="range" id="${uniqueId}-range" data-uuid="${uuid}" min="${min}" max="${max}" step="${step}" value="${value}" style="flex-grow: 1;">
                    <input type="number" id="${uniqueId}-num" data-uuid="${uuid}" value="${value}" step="${step}">
                </div>`;
    };

    const setActiveObject = (id) => {
        activeObjectId = id;
        document.querySelectorAll('#tab-container .tab-btn').forEach(btn => btn.classList.toggle('active', btn.dataset.id === id));
        document.querySelectorAll('#control-panels-container .panel').forEach(panel => panel.classList.toggle('active', panel.dataset.id === id));
    };
    
    const copyAssetInfo = () => {
        if (!activeObjectId || !sceneObjects.has(activeObjectId)) return alert("Please select an asset.");
        const { mesh, type } = sceneObjects.get(activeObjectId);
        if (type !== 'asset') return alert("This is not an asset. Please use 'Copy Clothing' for clothing items.");
        if (!mesh.parent || !mesh.parent.isBone) return alert("Asset must be attached to a bone to copy its transform.");
        
        const { position: pos, rotation: rot, scale: scl } = mesh;
        const output = `// Asset Attachment: '${mesh.name}' to bone '${mesh.parent.name}'\n` +
                       `object.position.set(${pos.x.toFixed(4)}, ${pos.y.toFixed(4)}, ${pos.z.toFixed(4)});\n` +
                       `object.rotation.set(${rot.x.toFixed(4)}, ${rot.y.toFixed(4)}, ${rot.z.toFixed(4)}); // Radians\n` +
                       `object.scale.set(${scl.x.toFixed(4)}, ${scl.y.toFixed(4)}, ${scl.z.toFixed(4)});`;
        navigator.clipboard.writeText(output).then(() => alert("Asset transform copied!"));
    };

    const copyClothingInfo = () => {
        if (!activeObjectId || !sceneObjects.has(activeObjectId)) return alert("Please select a clothing item.");
        const { mesh, type } = sceneObjects.get(activeObjectId);
        if (type !== 'clothing') return alert("This is not a clothing item. Please use 'Copy Asset'.");
        if (!mesh.parent || !mesh.parent.isBone) return alert("Clothing must be attached to a bone to copy its transform.");

        const { position: pos, rotation: rot, scale: scl } = mesh;
        const output = `// Clothing Attachment: '${mesh.name}' to bone '${mesh.parent.name}'\n` +
                       `// This is a RIGID attachment. The clothing will not bend.\n` +
                       `object.position.set(${pos.x.toFixed(4)}, ${pos.y.toFixed(4)}, ${pos.z.toFixed(4)});\n` +
                       `object.rotation.set(${rot.x.toFixed(4)}, ${rot.y.toFixed(4)}, ${rot.z.toFixed(4)}); // Radians\n` +
                       `object.scale.set(${scl.x.toFixed(4)}, ${scl.y.toFixed(4)}, ${scl.z.toFixed(4)});`;
        navigator.clipboard.writeText(output).then(() => alert("Clothing transform copied!"));
    };

    const handleDropdown = (btn, dropdown) => (event) => {
        event.stopPropagation();
        const isHidden = dropdown.style.display === 'none';
        document.getElementById('load-dropdown').style.display = 'none';
        document.getElementById('copy-dropdown').style.display = 'none';
        if (isHidden) dropdown.style.display = 'block';
    };

    addTrackedListener(loadBtn, 'click', handleDropdown(loadBtn, loadDropdown));
    addTrackedListener(copyBtn, 'click', handleDropdown(copyBtn, copyDropdown));
    addTrackedListener(window, 'click', () => {
        loadDropdown.style.display = 'none';
        copyDropdown.style.display = 'none';
    });
    
    addTrackedListener(charInput, 'change', (e) => loadObject(e.target.files, 'character'));
    addTrackedListener(assetInput, 'change', (e) => loadObject(e.target.files, 'asset'));
    addTrackedListener(clothingInput, 'change', (e) => loadObject(e.target.files, 'clothing'));
    addTrackedListener(animInput, 'change', (e) => loadAnimation(e.target.files[0]));
    
    addTrackedListener(copyAssetBtn, 'click', copyAssetInfo);
    addTrackedListener(copyClothingBtn, 'click', copyClothingInfo);
    
    addTrackedListener(playPauseBtn, 'click', () => { if (!mainCharacter || !mainCharacter.mixer) return; mainCharacter.isPaused = !mainCharacter.isPaused; mainCharacter.mixer.timeScale = mainCharacter.isPaused ? 0 : 1; playPauseBtn.textContent = mainCharacter.isPaused ? 'Play' : 'Pause'; });
    addTrackedListener(stepFwdBtn, 'click', () => { if (!mainCharacter || !mainCharacter.mixer) return; if (!mainCharacter.isPaused) { mainCharacter.isPaused = true; mainCharacter.mixer.timeScale = 0; playPauseBtn.textContent = 'Play'; } mainCharacter.mixer.update(1/60); });
    addTrackedListener(stepBackBtn, 'click', () => { if (!mainCharacter || !mainCharacter.mixer) return; if (!mainCharacter.isPaused) { mainCharacter.isPaused = true; mainCharacter.mixer.timeScale = 0; playPauseBtn.textContent = 'Play'; } mainCharacter.mixer.update(-1/60); });
    
    const animateTool = () => {
        animationFrameId = requestAnimationFrame(animateTool);
        const delta = clock.getDelta();
        if (mainCharacter && mainCharacter.mixer && !mainCharacter.isPaused) {
            mainCharacter.mixer.update(delta);
        }
    };
    animateTool();

    return function cleanup() {
        console.log("Cleaning up Attachment Rig tool...");
        cancelAnimationFrame(animationFrameId);
        eventListeners.forEach(({ target, type, handler }) => {
            target.removeEventListener(type, handler);
        });
        if (floatingButtonsContainer) {
            floatingButtonsContainer.style.display = 'none';
        }
        return "Attachment Rig listeners & animations stopped.";
    };
}
