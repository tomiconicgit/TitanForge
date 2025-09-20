import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

export function initAttachmentRigTool(scene, viewerContainer) {
    const uiContainer = document.getElementById('tools-container');
    uiContainer.innerHTML = `
        <style>
            .nav-btn { flex-grow: 1; padding: 12px; border: none; background: transparent; font-size: 16px; font-weight: bold; cursor: pointer; border-bottom: 3px solid transparent; }
            .nav-btn.active { color: var(--primary-color); border-bottom-color: var(--primary-color); }
            .mode-ui { display: none; }
            .mode-ui.active { display: flex; flex-wrap: wrap; padding: 10px; gap: 10px; border-bottom: 1px solid var(--border-color); flex-shrink: 0; align-items: center; }
            .btn { padding: 10px; border-radius: 8px; border: none; background: var(--primary-color); color: white; font-size: 14px; font-weight: bold; cursor: pointer; text-align: center; flex-grow: 1; }
            .btn.secondary { background: #6c757d; }
            .btn.tertiary { background: #5a3acc; }
            input[type="file"] { display: none; }
            .anim-controls-container { display: none; flex-grow: 2; display: flex; gap: 5px; }
            .anim-controls-container .btn { padding: 10px 0; min-width: 40px; }
            #tab-bar { display: flex; overflow-x: auto; padding: 5px; background: #e9e9e9; flex-shrink: 0; }
            .tab-btn { padding: 8px 16px; border: none; background: transparent; border-bottom: 2px solid transparent; cursor: pointer; font-size: 14px; flex-shrink: 0; }
            .tab-btn.active { font-weight: bold; color: var(--primary-color); border-bottom-color: var(--primary-color); }
            #control-panels { padding: 15px; overflow-y: auto; flex-grow: 1; }
            .panel { display: none; }
            .panel.active { display: block; }
            .control-group { margin-bottom: 15px; }
            .control-group h3 { margin: 0 0 10px; font-size: 16px; border-bottom: 1px solid var(--border-color); padding-bottom: 5px; }
            .slider-container { display: grid; grid-template-columns: 20px 1fr 50px; align-items: center; gap: 10px; margin-bottom: 5px; }
            .wardrobe-item { display: flex; align-items: center; justify-content: space-between; padding: 5px; border-radius: 4px; }
            .wardrobe-item:nth-child(odd) { background-color: rgba(0,0,0,0.05); }
            .wardrobe-item label { user-select: none; }
            .wardrobe-item input[type="checkbox"] { width: 20px; height: 20px; }
        </style>
        <header>
            <button class="nav-btn active" data-mode="equipment">Equipment</button>
            <button class="nav-btn" data-mode="wardrobe">Wardrobe</button>
        </header>
        <div id="equipment-ui" class="mode-ui active">
            <button class="btn" id="attach-load-character">Load Character</button>
            <button class="btn" id="attach-load-asset">Load Asset</button>
            <button class="btn tertiary" id="attach-load-anim">Load Animation</button>
            <div class="anim-controls-container">
                <button class="btn secondary step-back-btn">&lt;&lt;</button>
                <button class="btn secondary play-pause-btn">Pause</button>
                <button class="btn secondary step-fwd-btn">&gt;&gt;</button>
            </div>
            <button class="btn secondary" id="attach-copy-equipment">Copy Equipment</button>
        </div>
        <div id="wardrobe-ui" class="mode-ui">
            <button class="btn" id="attach-load-character2">Load Character</button>
            <button class="btn" id="attach-load-clothing">Load Clothing</button>
            <div class="anim-controls-container">
                <button class="btn secondary step-back-btn">&lt;&lt;</button>
                <button class="btn secondary play-pause-btn">Pause</button>
                <button class="btn secondary step-fwd-btn">&gt;&gt;</button>
            </div>
            <button class="btn secondary" id="attach-copy-wardrobe">Copy Wardrobe</button>
        </div>
        <div id="tab-bar"></div>
        <div id="control-panels"></div>
        <input type="file" id="attach-character-input" accept=".glb">
        <input type="file" id="attach-asset-input" accept=".glb, .gltf" multiple>
        <input type="file" id="attach-anim-input" accept=".glb, .gltf">
    `;

    const clock = new THREE.Clock();
    let currentMode = 'equipment';
    let mainCharacter = null;
    const sceneObjects = new Map();
    let activeObjectId = null;

    const controlPanelsContainer = document.getElementById('control-panels');
    const tabBarContainer = document.getElementById('tab-bar');
    const gltfLoader = new GLTFLoader();

    function loadGLB(files, isCharacter) {
        if (!files || files.length === 0) return;
        const fileList = Array.from(files);
        fileList.forEach(file => processFile(file, isCharacter && file === fileList[0]));
    }
    
    function processFile(file, isCharacter) {
        const reader = new FileReader();
        reader.onload = (e) => {
            gltfLoader.parse(e.target.result, '', (gltf) => {
                if (isCharacter) resetScene();
                const model = gltf.scene;
                model.name = file.name.replace(/\.[^/.]+$/, "");
                model.userData.fileName = file.name;
                const box = new THREE.Box3().setFromObject(model);
                const size = box.getSize(new THREE.Vector3());
                if (isCharacter) {
                    if (size.y > 0) model.scale.setScalar(1.65 / size.y);
                    box.setFromObject(model);
                    model.position.y -= box.min.y;
                } else {
                    if (size.length() > 0) {
                        const maxDim = Math.max(size.x, size.y, size.z);
                        model.scale.setScalar(0.5 / maxDim);
                        model.position.sub(box.getCenter(new THREE.Vector3()));
                    }
                }
                model.traverse(node => { if (node.isMesh) node.castShadow = true; });
                const objectData = {
                    mesh: model, bones: [], materials: new Map(), bodyParts: [],
                    mixer: null, activeAction: null, isPaused: true,
                };
                model.traverse(node => {
                    if (node.isBone) objectData.bones.push(node.name);
                    if (node.isMesh) {
                        objectData.bodyParts.push({ name: node.name, mesh: node, isVisible: true });
                        if (node.material && !objectData.materials.has(node.material.uuid)) {
                            objectData.materials.set(node.material.uuid, { name: node.material.name || `Material_${objectData.materials.size}`, ref: node.material });
                        }
                    }
                });
                sceneObjects.set(model.uuid, objectData);
                scene.add(model);
                if (isCharacter) mainCharacter = objectData;
                createUIForObject(objectData);
                setActiveObject(model.uuid);
            });
        };
        reader.readAsArrayBuffer(file);
    }
    
    function loadAnimation(file) {
         if (!file || !mainCharacter) { alert("Please load a character model first!"); return; }
        const reader = new FileReader();
        reader.onload = (e) => {
            gltfLoader.parse(e.target.result, '', (gltf) => {
                const clip = gltf.animations[0];
                if (!clip) { alert("This GLB file contains no animations."); return; }
                if (!mainCharacter.mixer) { mainCharacter.mixer = new THREE.AnimationMixer(mainCharacter.mesh); }
                if (mainCharacter.activeAction) mainCharacter.activeAction.stop();
                const action = mainCharacter.mixer.clipAction(clip);
                action.setLoop(THREE.LoopRepeat, Infinity).play();
                mainCharacter.activeAction = action;
                mainCharacter.isPaused = false;
                mainCharacter.mixer.timeScale = 1;
                document.querySelectorAll('.play-pause-btn').forEach(btn => btn.textContent = 'Pause');
                document.querySelectorAll('.anim-controls-container').forEach(el => el.style.display = 'flex');
            });
        };
        reader.readAsArrayBuffer(file);
    }

    function resetScene() {
        sceneObjects.forEach(data => scene.remove(data.mesh));
        sceneObjects.clear();
        mainCharacter = null;
        controlPanelsContainer.innerHTML = '';
        tabBarContainer.innerHTML = '';
        document.querySelectorAll('.anim-controls-container').forEach(el => el.style.display = 'none');
    }

    function createUIForObject(objectData) {
        const tab = document.createElement('button');
        tab.className = 'tab-btn';
        tab.textContent = objectData.mesh.name;
        tab.dataset.id = objectData.mesh.uuid;
        tab.onclick = () => setActiveObject(objectData.mesh.uuid);
        tabBarContainer.appendChild(tab);
        const panel = document.createElement('div');
        panel.className = 'panel';
        panel.dataset.id = objectData.mesh.uuid;
        controlPanelsContainer.appendChild(panel);
        renderPanelContent(objectData);
    }

    function renderPanelContent(objectData) {
        const { mesh, bones, bodyParts } = objectData;
        const panel = document.querySelector(`.panel[data-id="${mesh.uuid}"]`);
        if (!panel) return;
        
        let panelHTML = '';

        if (currentMode === 'wardrobe' && objectData === mainCharacter && bodyParts.length > 0) {
            panelHTML += `<div class="control-group"><h3>Default Clothing</h3>`;
            bodyParts.forEach((part, index) => {
                if (!part.mesh.geometry.boundingSphere || !part.name) return;
                panelHTML += `<div class="wardrobe-item">
                    <label for="part-${mesh.uuid}-${index}">${part.name}</label>
                    <input type="checkbox" id="part-${mesh.uuid}-${index}" data-part-name="${part.name}" ${part.isVisible ? 'checked' : ''}>
                </div>`;
            });
            panelHTML += `</div>`;
        }

        panelHTML += `<div class="control-group">
            <h3>Position</h3>
            ${createSlider('pos-x', 'X', mesh.position.x, -5, 5, 0.01)}
            ${createSlider('pos-y', 'Y', mesh.position.y, -5, 5, 0.01)}
            ${createSlider('pos-z', 'Z', mesh.position.z, -5, 5, 0.01)}
            <h3>Rotation (Degrees)</h3>
            ${createSlider('rot-x', 'X', THREE.MathUtils.radToDeg(mesh.rotation.x), -180, 180, 1)}
            ${createSlider('rot-y', 'Y', THREE.MathUtils.radToDeg(mesh.rotation.y), -180, 180, 1)}
            ${createSlider('rot-z', 'Z', THREE.MathUtils.radToDeg(mesh.rotation.z), -180, 180, 1)}
            <h3>Scale</h3>
            ${createSlider('scale-all', 'S', mesh.scale.x, 0.1, 5, 0.01)}
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
    }
    
    function addEventListenersToPanel(panel, objectData) {
        const { mesh } = objectData;
        panel.querySelectorAll('input[type="range"], input[type="number"]').forEach(input => {
            input.addEventListener('input', () => {
                const getVal = (id) => parseFloat(panel.querySelector(`[id^="${id}-"]`).value);
                mesh.position.set(getVal('pos-x'), getVal('pos-y'), getVal('pos-z'));
                mesh.rotation.set(THREE.MathUtils.degToRad(getVal('rot-x')), THREE.MathUtils.degToRad(getVal('rot-y')), THREE.MathUtils.degToRad(getVal('rot-z')));
                const scale = getVal('scale-all');
                mesh.scale.set(scale, scale, scale);
                if (input.type === 'range') panel.querySelector(`#${input.id.replace(/-range$/, '-num')}`).value = input.value;
                if (input.type === 'number') panel.querySelector(`#${input.id.replace(/-num$/, '-range')}`).value = input.value;
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
        if (currentMode === 'wardrobe' && objectData === mainCharacter) {
            panel.querySelectorAll('.wardrobe-item input[type="checkbox"]').forEach(toggle => {
                toggle.addEventListener('change', (e) => {
                    const partName = e.target.dataset.partName;
                    const part = objectData.bodyParts.find(p => p.name === partName);
                    if (part) { part.isVisible = e.target.checked; part.mesh.visible = part.isVisible; }
                });
            });
        }
    }

    function createSlider(id, label, value, min, max, step) {
         const uniqueId = `${id}-${Math.random().toString(36).substr(2, 9)}`;
         return `<div class="slider-container">
                    <label>${label}</label>
                    <input type="range" id="${uniqueId}-range" min="${min}" max="${max}" step="${step}" value="${value}">
                    <input type="number" id="${uniqueId}-num" value="${value}" step="${step}">
                </div>`;
    }
    
    function setActiveObject(id) {
        activeObjectId = id;
        document.querySelectorAll('.tab-btn, .panel').forEach(el => el.classList.toggle('active', el.dataset.id === id));
        if (activeObjectId) renderPanelContent(sceneObjects.get(activeObjectId));
    }

    function setMode(mode) {
        currentMode = mode;
        document.querySelectorAll('.nav-btn').forEach(b => b.classList.toggle('active', b.dataset.mode === mode));
        document.querySelectorAll('.mode-ui').forEach(u => u.classList.toggle('active', u.id.startsWith(mode)));
        if (activeObjectId) renderPanelContent(sceneObjects.get(activeObjectId));
    }
    
    function copyEquipment() {
        if (!activeObjectId || !sceneObjects.has(activeObjectId)) { alert("Select an asset."); return; }
        const { mesh } = sceneObjects.get(activeObjectId);
        if (!mesh.parent || !mesh.parent.isBone) { alert("Asset must be attached to a bone."); return; }
        const { position: pos, rotation: rot, scale: scl } = mesh;
        const output = `// Transform for ${mesh.name} attached to ${mesh.parent.name}\n` + `object.position.set(${pos.x.toFixed(4)}, ${pos.y.toFixed(4)}, ${pos.z.toFixed(4)});\n` + `object.rotation.set(${rot.x.toFixed(4)}, ${rot.y.toFixed(4)}, ${rot.z.toFixed(4)}); // Radians\n` + `object.scale.set(${scl.x.toFixed(4)}, ${scl.y.toFixed(4)}, ${scl.z.toFixed(4)});`;
        navigator.clipboard.writeText(output).then(() => {
            document.getElementById('attach-copy-equipment').textContent = 'Copied!';
            setTimeout(() => document.getElementById('attach-copy-equipment').textContent = 'Copy Equipment', 1500);
        });
    }
    function copyWardrobe() {
        if (!mainCharacter) { alert("Load a character first."); return; }
        const wardrobeData = {
            hide: mainCharacter.bodyParts.filter(part => !part.isVisible && part.name).map(part => part.name),
            equip: Array.from(sceneObjects.values()).filter(data => data !== mainCharacter).map(({ mesh }) => ({
                file: mesh.userData.fileName,
                attachTo: mesh.parent.isBone ? mesh.parent.name : "scene",
                position: { x: mesh.position.x.toFixed(4), y: mesh.position.y.toFixed(4), z: mesh.position.z.toFixed(4) },
                rotation: { x: mesh.rotation.x.toFixed(4), y: mesh.rotation.y.toFixed(4), z: mesh.rotation.z.toFixed(4) },
                scale: { x: mesh.scale.x.toFixed(4), y: mesh.scale.y.toFixed(4), z: mesh.scale.z.toFixed(4) }
            }))
        };
        navigator.clipboard.writeText(JSON.stringify(wardrobeData, null, 2)).then(() => {
            document.getElementById('attach-copy-wardrobe').textContent = 'Copied!';
            setTimeout(() => document.getElementById('attach-copy-wardrobe').textContent = 'Copy Wardrobe', 1500);
        });
    }
    
    document.querySelectorAll('header .nav-btn').forEach(b => b.addEventListener('click', () => setMode(b.dataset.mode)));

    document.getElementById('attach-load-character').onclick = () => document.getElementById('attach-character-input').click();
    document.getElementById('attach-load-character2').onclick = () => document.getElementById('attach-character-input').click();
    document.getElementById('attach-load-asset').onclick = () => document.getElementById('attach-asset-input').click();
    document.getElementById('attach-load-clothing').onclick = () => document.getElementById('attach-asset-input').click();
    document.getElementById('attach-load-anim').onclick = () => document.getElementById('attach-anim-input').click();
    document.getElementById('attach-character-input').onchange = (e) => loadGLB(e.target.files, true);
    document.getElementById('attach-asset-input').onchange = (e) => loadGLB(e.target.files, false);
    document.getElementById('attach-anim-input').onchange = (e) => loadAnimation(e.target.files[0]);
    document.getElementById('attach-copy-equipment').onclick = copyEquipment;
    document.getElementById('attach-copy-wardrobe').onclick = copyWardrobe;
    
    const setupAnimListeners = (container) => {
        const playPauseBtn = container.querySelector('.play-pause-btn');
        const stepFwdBtn = container.querySelector('.step-fwd-btn');
        const stepBackBtn = container.querySelector('.step-back-btn');
        
        playPauseBtn.addEventListener('click', () => {
            if (!mainCharacter || !mainCharacter.mixer) return;
            mainCharacter.isPaused = !mainCharacter.isPaused;
            mainCharacter.mixer.timeScale = mainCharacter.isPaused ? 0 : 1;
            document.querySelectorAll('.play-pause-btn').forEach(btn => btn.textContent = mainCharacter.isPaused ? 'Play' : 'Pause');
        });
        const step = (amount) => {
            if (!mainCharacter || !mainCharacter.mixer) return;
            if (!mainCharacter.isPaused) {
                mainCharacter.isPaused = true;
                mainCharacter.mixer.timeScale = 0;
                document.querySelectorAll('.play-pause-btn').forEach(btn => btn.textContent = 'Play');
            }
            mainCharacter.mixer.update(amount);
        };
        stepFwdBtn.addEventListener('click', () => step(1/60));
        stepBackBtn.addEventListener('click', () => step(-1/60));
    };
    
    document.querySelectorAll('.anim-controls-container').forEach(setupAnimListeners);
}
