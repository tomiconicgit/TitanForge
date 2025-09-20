// main.js
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { GLTFExporter } from 'three/addons/exporters/GLTFExporter.js';

// --- Shared 3D Scene and State ---
let scene, camera, renderer, controls;
let currentModel = null;
let originalModel = null;
let currentTool = null;
const viewerContainer = document.getElementById('viewer-container');
const toolsContainer = document.getElementById('tools-container');

function init3DViewer() {
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0xf0f0f0);
    scene.fog = new THREE.Fog(0xf0f0f0, 10, 50);
    camera = new THREE.PerspectiveCamera(50, viewerContainer.clientWidth / viewerContainer.clientHeight, 0.1, 1000);
    camera.position.set(0, 1.6, 3.5);

    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.setSize(viewerContainer.clientWidth, viewerContainer.clientHeight);
    renderer.shadowMap.enabled = true;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1;
    viewerContainer.appendChild(renderer.domElement);
    
    scene.add(new THREE.HemisphereLight(0xffffff, 0x444444, 2));
    const dirLight = new THREE.DirectionalLight(0xffffff, 2);
    dirLight.position.set(3, 10, 10);
    dirLight.castShadow = true;
    scene.add(dirLight);
    
    const floor = new THREE.Mesh( new THREE.PlaneGeometry(100, 100), new THREE.MeshStandardMaterial({ color: 0x999999, depthWrite: false }) );
    floor.rotation.x = -Math.PI / 2;
    floor.receiveShadow = true;
    scene.add(floor);

    controls = new OrbitControls(camera, renderer.domElement);
    controls.target.set(0, 1, 0);
    controls.enableDamping = true;
    controls.maxPolarAngle = Math.PI / 2;
    controls.update();
    
    const resizeObserver = new ResizeObserver(entries => {
        const { width, height } = entries[0].contentRect;
        camera.aspect = width / height; camera.updateProjectionMatrix();
        renderer.setSize(width, height);
    });
    resizeObserver.observe(viewerContainer);

    animate();
}

function animate() {
    requestAnimationFrame(animate);
    controls.update();
    renderer.render(scene, camera);
}

// --- Tool Definitions ---
const tools = {};

// `RigRemoval` Tool
tools.rigremoval = {
    ui: `
        <div id="ui-content" style="display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 1rem;">
            <div class="card">
                <h2>1. Load Character</h2>
                <label for="rig-model-input" class="file-label">Load .glb File</label>
                <input type="file" id="rig-model-input" accept=".glb" hidden>
                <div id="rig-status-log">Load a GLB model to start.</div>
            </div>
            <div class="card">
                <h2>2. Load Textures</h2>
                <label for="rig-texture-input" class="file-label disabled">Load Images</label>
                <input type="file" id="rig-texture-input" accept=".png, .jpg, .jpeg" multiple hidden disabled>
            </div>
            <div class="card">
                <h2>3. Process & Export</h2>
                <button id="rig-process-btn" class="btn" disabled>Remove Rig & T-Pose</button>
                <button id="rig-export-btn" class="btn" disabled>Export as .glb</button>
            </div>
        </div>
    `,
    init: () => {
        const statusLog = document.getElementById('rig-status-log');
        const modelInput = document.getElementById('rig-model-input');
        const textureInput = document.getElementById('rig-texture-input');
        const processBtn = document.getElementById('rig-process-btn');
        const exportBtn = document.getElementById('rig-export-btn');
        const textureLabel = document.querySelector('label[for="rig-texture-input"]');

        const logStatus = (message, level = 'info') => {
            statusLog.textContent = message;
            statusLog.className = 'status-log';
            if (level === 'error') statusLog.classList.add('error');
        };

        const textureLoader = new THREE.TextureLoader();
        const gltfLoader = new GLTFLoader();
        const textureMap = {
            _albedo: 'map', _color: 'map', _diffuse: 'map', _basecolor: 'map',
            _normal: 'normalMap', _n: 'normalMap', _roughness: 'roughnessMap',
            _rough: 'roughnessMap', _metallic: 'metalnessMap', _metal: 'metalnessMap',
            _ao: 'aoMap', _emissive: 'emissiveMap'
        };

        const applyTextures = (model, textureFiles) => { /* ... (Your existing logic) ... */ };
        
        const resetScene = () => {
            if (currentModel) scene.remove(currentModel);
            currentModel = null; originalModel = null;
            textureInput.disabled = true;
            textureLabel.classList.add('disabled');
            processBtn.disabled = true;
            exportBtn.disabled = true;
        };

        modelInput.addEventListener('change', (event) => {
            const file = event.target.files[0];
            if (!file) return;
            resetScene();
            logStatus(`Loading model: ${file.name}`);
            
            const reader = new FileReader();
            reader.onload = (e) => {
                gltfLoader.parse(e.target.result, '', (gltf) => {
                    const model = gltf.scene;
                    const box = new THREE.Box3().setFromObject(model);
                    const size = box.getSize(new THREE.Vector3());
                    if (size.y > 0) model.scale.setScalar(1.65 / size.y);
                    const scaledBox = new THREE.Box3().setFromObject(model);
                    model.position.y -= scaledBox.min.y;
                    model.traverse(node => { if (node.isMesh) node.castShadow = true; });
                    
                    originalModel = model;
                    currentModel = model;
                    scene.add(model);
                    processBtn.disabled = false;
                    textureInput.disabled = false;
                    textureLabel.classList.remove('disabled');
                    logStatus("Model loaded. You can now load textures.");
                }, (error) => {
                    logStatus("Error: Failed to parse GLB file.", 'error');
                    console.error(error);
                });
            };
            reader.readAsArrayBuffer(file);
        });

        textureInput.addEventListener('change', (event) => {
            if (!currentModel) return;
            const files = Array.from(event.target.files);
            if (files.length > 0) applyTextures(currentModel, files);
        });
        
        processBtn.addEventListener('click', () => {
            if (!originalModel) return;
            logStatus('Processing: Removing rig...');
            const staticModel = new THREE.Group();
            originalModel.traverse(child => {
                if (child.isSkinnedMesh) staticModel.add(new THREE.Mesh(child.geometry, child.material.clone()));
                else if (child.isMesh) staticModel.add(child.clone());
            });
            staticModel.applyMatrix4(originalModel.matrixWorld);
            scene.remove(currentModel);
            currentModel = staticModel;
            scene.add(currentModel);
            logStatus('Rig removed. Ready to export.');
            exportBtn.disabled = false;
            processBtn.disabled = true;
        });

        exportBtn.addEventListener('click', () => {
            if (!currentModel) return;
            logStatus('Exporting to GLB...');
            new GLTFExporter().parse(currentModel, result => {
                const blob = new Blob([result], { type: 'model/gltf-binary' });
                const link = document.createElement('a');
                link.href = URL.createObjectURL(blob);
                link.download = 'model_static.glb';
                link.click();
                URL.revokeObjectURL(link.href);
                logStatus('Export complete!');
            }, error => {
                logStatus('Export failed. See console.', 'error');
                console.error('An error happened during parsing', error);
            });
        });
    }
};

// `AttachmentRig` Tool
tools.attachmentrig = {
    ui: `
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
    `,
    init: () => {
        const clock = new THREE.Clock();
        let currentMode = 'equipment';
        let mainCharacter = null;
        const sceneObjects = new Map();
        let activeObjectId = null;

        const controlPanelsContainer = document.getElementById('control-panels');
        const tabBarContainer = document.getElementById('tab-bar');
        const gltfLoader = new GLTFLoader();

        function loadGLB(files, isCharacter) { /* ... (Your existing logic) ... */ }
        function processFile(file, isCharacter) { /* ... (Your existing logic) ... */ }
        function loadAnimation(file) { /* ... (Your existing logic) ... */ }
        function resetScene() { /* ... (Your existing logic) ... */ }
        function createUIForObject(objectData) { /* ... (Your existing logic) ... */ }
        function renderPanelContent(objectData) { /* ... (Your existing logic) ... */ }
        function addEventListenersToPanel(panel, objectData) { /* ... (Your existing logic) ... */ }
        function createSlider(id, label, value, min, max, step) { /* ... (Your existing logic) ... */ }
        function setActiveObject(id) { /* ... (Your existing logic) ... */ }
        function setMode(mode) { /* ... (Your existing logic) ... */ }
        function copyEquipment() { /* ... (Your existing logic) ... */ }
        function copyWardrobe() { /* ... (Your existing logic) ... */ }
        
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
    }
};

// Compressor Tool (Placeholder)
tools.compressor = {
    ui: `
        <div id="ui-content" style="display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100%;">
            <div class="card">
                <h2>Draco Compression</h2>
                <p>This tool will be available soon.</p>
                <button class="btn" disabled>Compress with Draco</button>
            </div>
        </div>
    `,
    init: () => {}
};

// --- Main App Logic ---
function switchTool(toolName) {
    if (currentTool === toolName) return;

    toolsContainer.innerHTML = '';
    document.querySelectorAll('.nav-item').forEach(item => item.classList.remove('active'));
    document.querySelector(`.nav-item[data-tool="${toolName}"]`).classList.add('active');

    toolsContainer.style.display = 'flex';
    const tool = tools[toolName];
    toolsContainer.innerHTML = tool.ui;
    tool.init();
    currentTool = toolName;
}

document.querySelectorAll('.nav-item').forEach(item => {
    item.addEventListener('click', () => {
        const toolName = item.getAttribute('data-tool');
        switchTool(toolName);
    });
});

init3DViewer();
switchTool('rigremoval');
