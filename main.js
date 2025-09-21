// main.js
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

let scene, camera, renderer, controls;
let currentToolModule = null; 
const viewerContainer = document.getElementById('viewer-container');
const uiContainer = document.getElementById('ui-container');
const dashboardBtn = document.getElementById('dashboard-btn');
const floatingButtonsContainer = document.getElementById('floating-buttons-container');

// NEW: Get cleanup screen elements
const cleanupScreen = document.getElementById('cleanup-screen');
const cleanupLog = document.getElementById('cleanup-log');

const toolModules = {
    rigremoval: () => import('./tools/rigremoval.js'),
    attachmentrig: () => import('./tools/attachmentrig.js'),
};

function init3DViewer() {
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

function animate() {
    requestAnimationFrame(animate);
    controls.update();
    renderer.render(scene, camera);
}

// NEW: Helper function for logging to the cleanup screen
function logCleanup(message) {
    cleanupLog.innerHTML += `> ${message}\n`;
    cleanupLog.scrollTop = cleanupLog.scrollHeight;
}

// NEW: Helper function for creating delays
const delay = (ms) => new Promise(res => setTimeout(res, ms));

// NEW: The main cleanup process function
async function beginCleanupTransition() {
    cleanupScreen.style.display = 'flex';
    cleanupLog.innerHTML = '';
    logCleanup("Starting cleanup...");
    await delay(200);

    if (currentToolModule && typeof currentToolModule.cleanup === 'function') {
        const cleanupMessage = currentToolModule.cleanup();
        logCleanup(cleanupMessage);
        currentToolModule = null;
    } else {
        logCleanup("No active tool to clean up.");
    }
    await delay(500);

    const objectsToRemove = scene.children.filter(child => 
        (child.isMesh || child.isGroup || child.isSkinnedMesh || child.isBone) && child.name !== 'main_floor'
    );
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
    showMainMenu(); // Now, we show the main menu
}

// MODIFIED: showMainMenu no longer does the cleanup itself
function showMainMenu() {
    uiContainer.innerHTML = `
        <div class="fade-in" style="display: flex; flex-direction: column; gap: 1rem; padding: 2rem;">
            <h2>Choose a Tool</h2>
            <button class="btn" id="rigremoval-btn">Rig Removal Tool</button>
            <button class="btn" id="attachmentrig-btn">Attachment Rig Tool</button>
        </div>
    `;

    document.getElementById('rigremoval-btn').addEventListener('click', () => {
        loadTool('rigremoval');
    });

    document.getElementById('attachmentrig-btn').addEventListener('click', () => {
        loadTool('attachmentrig');
    });
}

async function loadTool(toolName) {
    viewerContainer.style.display = 'block';
    dashboardBtn.style.display = 'block';
    
    uiContainer.innerHTML = `<div class="fade-in" style="display: flex; justify-content: center; align-items: center; height: 100%;"><p>Loading tool: ${toolName}...</p></div>`;

    try {
        const module = await toolModules[toolName]();
        currentToolModule = module;
        module.init(scene, uiContainer, beginCleanupTransition); // Pass the new function
    } catch (error) {
        console.error(`Failed to load or initialize tool: ${toolName}`, error);
        uiContainer.innerHTML = `<div style="padding: 2rem; text-align: center;"><p style="color: red;">Error loading tool.</p><button class="btn" onclick="location.reload();">Reload</button></div>`;
    }
}

// MODIFIED: The dashboard button now triggers the cleanup transition
dashboardBtn.addEventListener('click', beginCleanupTransition);

init3DViewer();
showMainMenu();
