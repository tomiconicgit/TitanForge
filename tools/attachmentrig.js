// tools/attachmentrig.js
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { GLTFExporter } from 'three/addons/exporters/GLTFExporter.js';

export function init(scene, uiContainer, onBackToDashboard) {
    // Local state
    const clock = new THREE.Clock();
    let mainCharacter = null;
    const sceneObjects = new Map();
    let activeObjectId = null;
    let currentMode = 'equipment'; // Keep for future expansion if needed

    uiContainer.innerHTML = `
        <style>
            #attachment-rig-ui {
                display: flex;
                flex-direction: column;
                height: 100%;
                color: var(--text-color);
            }
            #button-bar {
                display: grid;
                grid-template-columns: repeat(auto-fit, minmax(100px, 1fr));
                gap: 10px;
                padding-bottom: 10px;
                border-bottom: 1px solid var(--border-color);
            }
            #tab-container {
                display: flex;
                overflow-x: auto;
                padding: 10px 0;
                border-bottom: 1px solid var(--border-color);
            }
            .tab-btn {
                background: transparent;
                border: none;
                padding: 8px 16px;
                cursor: pointer;
                color: var(--secondary-text-color);
                font-weight: bold;
                flex-shrink: 0;
                transition: color 0.2s ease, border-bottom-color 0.2s ease;
                border-bottom: 2px solid transparent;
            }
            .tab-btn.active {
                color: var(--primary-color);
                border-bottom-color: var(--primary-color);
            }
            #control-panels-container {
                flex-grow: 1;
                overflow-y: auto;
                padding-top: 15px;
            }
            .panel {
                display: none;
            }
            .panel.active {
                display: block;
            }
            .control-group {
                margin-bottom: 15px;
            }
            .control-group h3 {
                margin: 0 0 10px;
                font-size: 16px;
                border-bottom: 1px solid var(--border-color);
                padding-bottom: 5px;
            }
            .slider-container {
                display: grid;
                grid-template-columns: 20px 1fr 50px;
                align-items: center;
                gap: 10px;
                margin-bottom: 5px;
            }
            .attachment-select {
                width: 100%;
                padding: 8px;
                border-radius: 8px;
                border: 1px solid var(--border-color);
                background-color: var(--panel-bg);
                color: var(--text-color);
            }
            .modal-bg {
                position: fixed;
                z-index: 100;
                left: 0; top: 0;
                width: 100%; height: 100%;
                background-color: rgba(0,0,0,0.4);
                display: flex;
                align-items: center;
                justify-content: center;
            }
            .modal-content {
                background: var(--panel-bg);
                border-radius: 24px;
                padding: 30px;
                width: 90%;
                max-width: 400px;
                text-align: center;
                box-shadow: 0 10px 30px rgba(0,0,0,0.5);
                backdrop-filter: blur(40px);
                -webkit-backdrop-filter: blur(40px);
                display: flex;
                flex-direction: column;
                gap: 1.5rem;
                transform: scale(0.9);
                opacity: 0;
                animation: modal-fade-in 0.3s forwards;
                color: var(--text-color);
            }
            @keyframes modal-fade-in {
                to { transform: scale(1); opacity: 1; }
            }
            .modal-loader {
                border: 4px solid var(--border-color);
                border-top: 4px solid var(--primary-color);
                border-radius: 50%;
                width: 40px;
                height: 40px;
                animation: spin 1s linear infinite;
                margin: 0 auto;
            }
            @keyframes spin {
                0% { transform: rotate(0deg); }
                100% { transform: rotate(360deg); }
            }
        </style>
        <div id="attachment-rig-ui">
            <div id="button-bar">
                <label for="char-input" class="btn">Load Model</label>
                <input type="file" id="char-input" accept=".glb" hidden>

                <label for="asset-input" class="btn">Load Asset</label>
                <input type="file" id="asset-input" accept=".glb, .gltf" multiple hidden>

                <label for="anim-input" class="btn">Load Animation</label>
                <input type="file" id="anim-input" accept=".glb, .gltf" hidden>
                
                <button class="btn" id="copy-code-btn">Copy</button>
            </div>
            
            <div id="tab-container"></div>
            
            <div id="control-panels-container"></div>

            <div class="anim-controls-container" style="display: none; justify-content: space-around; padding: 10px; background: rgba(0,0,0,0.2); border-radius: 12px; margin-top: 1rem;">
                <button class="btn secondary step-back-btn" style="flex: 1;">&lt;&lt;</button>
                <button class="btn secondary play-pause-btn" style="flex: 2;">Pause</button>
                <button class="btn secondary step-fwd-btn" style="flex: 1;">&gt;&gt;</button>
            </div>

            <button class="btn dashboard" id="dashboard-btn" style="margin-top: 1rem;">Dashboard</button>
        </div>

        <div id="main-modal" class="modal-bg" style="display: none;">
            <div class="modal-content" id="modal-content"></div>
        </div>
    `;

    // Get UI elements
    const charInput = document.getElementById('char-input');
    const assetInput = document.getElementById('asset-input');
    const animInput = document.getElementById('anim-input');
    const copyCodeBtn = document.getElementById('copy-code-btn');
    const dashboardBtn = document.getElementById('dashboard-btn');
    const tabContainer = document.getElementById('tab-container');
    const controlPanelsContainer = document.getElementById('control-panels-container');
    const animControlsContainer = document.querySelector('.anim-controls-container');
    const playPauseBtn = document.querySelector('.play-pause-btn');
    const stepFwdBtn = document.querySelector('.step-fwd-btn');
    const stepBackBtn = document.querySelector('.step-back-btn');
    const mainModal = document.getElementById('main-modal');
    const modalContent = document.getElementById('modal-content');
    
    // Core Three.js dependencies
    const gltfLoader = new GLTFLoader();

    // Utility functions
    const showModal = (contentHTML) => {
        modalContent.innerHTML = contentHTML;
        mainModal.style.display = 'flex';
    };

    const hideModal = () => {
        mainModal.style.display = 'none';
        modalContent.innerHTML = '';
    };

    const resetScene = () => {
        sceneObjects.forEach(data => scene.remove(data.mesh));
        sceneObjects.clear();
        mainCharacter = null;
        tabContainer.innerHTML = '';
        controlPanelsContainer.innerHTML = '';
        animControlsContainer.style.display = 'none';
        activeObjectId = null;
    };

    const centerAndOrientModel = (model) => {
        const box = new THREE.Box3().setFromObject(model);
        const size = box.getSize(new THREE.Vector3());
        
        if (size.y > 0) model.scale.setScalar(1.65 / size.y);

        const scaledBox = new THREE.Box3().setFromObject(model);
        model.position.y -= scaledBox.min.y;
    };

    const loadGLB = (files, isCharacter) => {
        if (!files || files.length === 0) return;
        
        const fileList = Array.from(files);
        fileList.forEach(file => {
            showModal(`
                <h2 class="modal-title">Loading Model</h2>
                <p>Processing file: ${file.name}</p>
                <div class="modal-loader"></div>
            `);
            const reader = new FileReader();
            reader.onload = (e) => {
                gltfLoader.parse(e.target.result, '', (gltf) => {
                    if (isCharacter) resetScene();
                    const model = gltf.scene;
                    model.name = file.name.replace(/\.[^/.]+$/, "");
                    model.userData.fileName = file.name;

                    model.rotation.set(-Math.PI / 2, 0, Math.PI);
                    centerAndOrientModel(model);
                    model.traverse(node => { if (node.isMesh) node.castShadow = true; });
                    
                    const objectData = {
                        mesh: model,
                        bones: [],
                        mixer: null,
                        activeAction: null,
                        isPaused: true,
                    };
                    model.traverse(node => {
                        if (node.isBone) objectData.bones.push(node.name);
                    });
                    
                    sceneObjects.set(model.uuid, objectData);
                    scene.add(model);
                    if (isCharacter) mainCharacter = objectData;

                    createUIForObject(objectData);
                    setActiveObject(model.uuid);
                    hideModal();
                }, (error) => {
                    showModal(`
                        <h2 class="modal-title" style="color: var(--error-color);">Error</h2>
                        <p>Failed to parse GLB file: ${error.message}</p>
                        <button class="btn" onclick="location.reload()">Reload</button>
                    `);
                    console.error(error);
                });
            };
            reader.readAsArrayBuffer(file);
        });
    };

    const loadAnimation = (file) => {
        if (!file || !mainCharacter) {
            alert("Please load a character model first!");
            return;
        }

        showModal(`
            <h2 class="modal-title">Loading Animation</h2>
            <p>Processing file: ${file.name}</p>
            <div class="modal-loader"></div>
        `);
        
        const reader = new FileReader();
        reader.onload = (e) => {
            gltfLoader.parse(e.target.result, '', (gltf) => {
                const clip = gltf.animations[0];
                if (!clip) {
                    showModal(`
                        <h2 class="modal-title" style="color: var(--error-color);">Error</h2>
                        <p>This GLB file contains no animations.</p>
                        <button class="btn" onclick="hideModal()">OK</button>
                    `);
                    return;
                }
                
                if (!mainCharacter.mixer) {
                    mainCharacter.mixer = new THREE.AnimationMixer(mainCharacter.mesh);
                }
                if (mainCharacter.activeAction) mainCharacter.activeAction.stop();

                const action = mainCharacter.mixer.clipAction(clip);
                action.setLoop(THREE.LoopRepeat, Infinity).play();
                mainCharacter.activeAction = action;
                mainCharacter.isPaused = false;
                mainCharacter.mixer.timeScale = 1;

                playPauseBtn.textContent = 'Pause';
                animControlsContainer.style.display = 'flex';
                hideModal();

            }, (error) => {
                showModal(`
                    <h2 class="modal-title" style="color: var(--error-color);">Error</h2>
                    <p>Failed to load animation file: ${error.message}</p>
                    <button class="btn" onclick="hideModal()">OK</button>
                `);
                console.error(error);
            });
        };
        reader.readAsArrayBuffer(file);
    };

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

    const renderPanelContent = (objectData) => {
        const { mesh, bones } = objectData;
        const panel = document.querySelector(`.panel[data-id="${mesh.uuid}"]`);
        if (!panel) return;
        
        let panelHTML = '';

        panelHTML += `<div class="control-group">
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

        if (mainCharacter && objectData !== mainCharacter) {
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
    
    const addEventListenersToPanel = (panel, objectData) => {
        const { mesh } = objectData;
        panel.querySelectorAll('input[type="range"], input[type="number"]').forEach(input => {
            input.addEventListener('input', () => {
                const getVal = (id) => parseFloat(panel.querySelector(`[data-uuid="${objectData.mesh.uuid}"][id^="${id}-"]`).value);
                mesh.position.set(getVal('pos-x'), getVal('pos-y'), getVal('pos-z'));
                mesh.rotation.set(THREE.MathUtils.degToRad(getVal('rot-x')), THREE.MathUtils.degToRad(getVal('rot-y')), THREE.MathUtils.degToRad(getVal('rot-z')));
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
                if (boneName === 'scene') scene.attach(mesh);
                else { const bone = mainCharacter.mesh.getObjectByName(boneName); if (bone) bone.attach(mesh); }
            });
        }
    };

    const createSlider = (id, label, value, min, max, step, uuid) => {
         const uniqueId = `${id}-${uuid}`;
         return `<div class="slider-container">
                    <label>${label}</label>
                    <input type="range" id="${uniqueId}-range" data-uuid="${uuid}" min="${min}" max="${max}" step="${step}" value="${value}">
                    <input type="number" id="${uniqueId}-num" data-uuid="${uuid}" value="${value}" step="${step}">
                </div>`;
    };
    
    const setActiveObject = (id) => {
        activeObjectId = id;
        document.querySelectorAll('#tab-container .tab-btn').forEach(btn => btn.classList.toggle('active', btn.dataset.id === id));
        document.querySelectorAll('#control-panels-container .panel').forEach(panel => panel.classList.toggle('active', panel.dataset.id === id));
    };

    const copyEquipment = () => {
        if (!activeObjectId || !sceneObjects.has(activeObjectId) || !mainCharacter) {
            alert("Please load a character and select an asset.");
            return;
        }

        const { mesh } = sceneObjects.get(activeObjectId);
        if (!mesh.parent || !mesh.parent.isBone) {
            alert("Asset must be attached to a bone to copy its transform.");
            return;
        }
        
        const { position: pos, rotation: rot, scale: scl } = mesh;
        const output = `// Transform for ${mesh.name} attached to ${mesh.parent.name}\n` +
                       `object.position.set(${pos.x.toFixed(4)}, ${pos.y.toFixed(4)}, ${pos.z.toFixed(4)});\n` +
                       `object.rotation.set(${rot.x.toFixed(4)}, ${rot.y.toFixed(4)}, ${rot.z.toFixed(4)}); // Radians\n` +
                       `object.scale.set(${scl.x.toFixed(4)}, ${scl.y.toFixed(4)}, ${scl.z.toFixed(4)});`;
        
        navigator.clipboard.writeText(output).then(() => {
            alert("Code copied to clipboard!");
        }).catch(err => {
            console.error("Failed to copy text: ", err);
            alert("Failed to copy code.");
        });
    };

    // Event Listeners
    charInput.addEventListener('change', (e) => loadGLB(e.target.files, true));
    assetInput.addEventListener('change', (e) => loadGLB(e.target.files, false));
    animInput.addEventListener('change', (e) => loadAnimation(e.target.files[0]));
    copyCodeBtn.addEventListener('click', copyEquipment);
    dashboardBtn.addEventListener('click', () => {
        resetScene();
        onBackToDashboard();
    });

    playPauseBtn.addEventListener('click', () => {
        if (!mainCharacter || !mainCharacter.mixer) return;
        mainCharacter.isPaused = !mainCharacter.isPaused;
        mainCharacter.mixer.timeScale = mainCharacter.isPaused ? 0 : 1;
        playPauseBtn.textContent = mainCharacter.isPaused ? 'Play' : 'Pause';
    });
    const step = (amount) => {
        if (!mainCharacter || !mainCharacter.mixer) return;
        if (!mainCharacter.isPaused) {
            mainCharacter.isPaused = true;
            mainCharacter.mixer.timeScale = 0;
            playPauseBtn.textContent = 'Play';
        }
        mainCharacter.mixer.update(amount);
    };
    stepFwdBtn.addEventListener('click', () => step(1/60));
    stepBackBtn.addEventListener('click', () => step(-1/60));
    
    // Animation loop for the attachment rig tool
    const animateTool = () => {
        requestAnimationFrame(animateTool);
        const delta = clock.getDelta();
        if (mainCharacter && mainCharacter.mixer && !mainCharacter.isPaused) {
            mainCharacter.mixer.update(delta);
        }
    };
    animateTool();
}
