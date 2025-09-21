// main.js
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

let scene, camera, renderer, controls;
let activeToolCleanup = null; // MODIFIED: To store the returned cleanup function

const viewerContainer = document.getElementById('viewer-container');
const uiContainer = document.getElementById('ui-container');
const dashboardBtn = document.getElementById('dashboard-btn');
const floatingButtonsContainer = document.getElementById('floating-buttons-container');
const cleanupScreen = document.getElementById('cleanup-screen');
const cleanupLog = document.getElementById('cleanup-log');
const toolLoadingScreen = document.getElementById('tool-loading-screen');
const toolLoadingLog = document.getElementById('tool-loading-log');

const toolModules = {
    rigremoval: () => import('./tools/rigremoval.js'),
    attachmentrig: () => import('./tools/attachmentrig.js'),
};

function init3DViewer() { /* ... function is unchanged ... */
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x1c1c1e);
    scene.fog = new THREE.Fog(0x1c1c1e, 10, 50);
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
    floor.name = 'main_floor';
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

function animate() { /* ... function is unchanged ... */
    requestAnimationFrame(animate);
    controls.update();
    renderer.render(scene, camera);
}

// Loggers and delay function
function logCleanup(message) { cleanupLog.innerHTML += `> ${message}\n`; cleanupLog.scrollTop = cleanupLog.scrollHeight; }
const delay = (ms) => new Promise(res => setTimeout(res, ms));
function logToolLoad(message) { toolLoadingLog.innerHTML += `> ${message}\n`; toolLoadingLog.scrollTop = toolLoadingLog.scrollHeight; }

async function beginCleanupTransition() {
    cleanupScreen.style.display = 'flex';
    cleanupLog.innerHTML = '';
    logCleanup("Starting cleanup...");
    await delay(200);

    if (typeof activeToolCleanup === 'function') {
        const cleanupMessage = activeToolCleanup(); // MODIFIED: Call the stored cleanup function
        logCleanup(cleanupMessage);
        activeToolCleanup = null;
    } else {
        logCleanup("No active tool to clean up.");
    }
    await delay(500);

    const objectsToRemove = scene.children.filter(child => (child.isMesh || child.isGroup || child.isSkinnedMesh || child.isBone) && child.name !== 'main_floor');
    objectsToRemove.forEach(child => scene.remove(child));
    logCleanup(`Removed ${objectsToRemove.length} object(s) from scene.`);
    await delay(500);
    logCleanup("Resetting UI elements...");
    dashboardBtn.style.display = 'none';
    floatingButtonsContainer.style.display = 'none';
    viewerContainer.style.display = 'none';
    await delay(200);
    logCleanup("Cleanup complete. Loading dashboard...");
    await delay(750);
    cleanupScreen.style.display = 'none';
    showMainMenu();
}

function showMainMenu() { /* ... function is unchanged ... */
    uiContainer.innerHTML = `<div class="fade-in" style="display: flex; flex-direction: column; gap: 1rem; padding: 2rem;"><h2>Choose a Tool</h2><button class="btn" id="rigremoval-btn">Rig Removal Tool</button><button class="btn" id="attachmentrig-btn">Attachment Rig Tool</button></div>`;
    document.getElementById('rigremoval-btn').addEventListener('click', () => { beginToolLoadTransition('rigremoval'); });
    document.getElementById('attachmentrig-btn').addEventListener('click', () => { beginToolLoadTransition('attachmentrig'); });
}

async function beginToolLoadTransition(toolName) { /* ... function is unchanged ... */
    toolLoadingScreen.style.display = 'flex';
    toolLoadingLog.innerHTML = '';
    logToolLoad(`Preparing to load: ${toolName}...`);
    await delay(500);
    await loadTool(toolName);
    logToolLoad("Tool loaded successfully!");
    await delay(750);
    toolLoadingScreen.style.display = 'none';
}

async function loadTool(toolName) {
    logToolLoad("Showing main UI components...");
    viewerContainer.style.display = 'block';
    dashboardBtn.style.display = 'block';
    
    try {
        logToolLoad(`Importing '${toolName}.js' module...`);
        const module = await toolModules[toolName]();
        
        logToolLoad("Initializing tool...");
        await delay(250);
        
        // MODIFIED: module.init now returns the cleanup function
        activeToolCleanup = module.init(scene, uiContainer, beginCleanupTransition);
        
    } catch (error) {
        logToolLoad(`ERROR: Failed to load tool. See console for details.`);
        console.error(`Failed to load or initialize tool: ${toolName}`, error);
        uiContainer.innerHTML = `<div style="padding: 2rem; text-align: center;"><p style="color: var(--error-color);">Error loading tool.</p><button class="btn" onclick="location.reload();">Reload</button></div>`;
    }
}

dashboardBtn.addEventListener('click', beginCleanupTransition);

init3DViewer();
showMainMenu();
