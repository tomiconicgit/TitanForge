// main.js
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

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

// A dictionary to store the imported tool modules
const toolModules = {
    rigremoval: () => import('./tools/rigremoval.js'),
    attachmentrig: () => import('./tools/attachmentrig.js'),
};

async function switchTool(toolName) {
    if (currentTool === toolName) return;

    // Remove active state from all nav items
    document.querySelectorAll('.nav-item').forEach(item => item.classList.remove('active'));
    // Set active state on the current tool's nav item
    document.querySelector(`.nav-item[data-tool="${toolName}"]`).classList.add('active');

    // Show the tools container
    toolsContainer.style.display = 'flex';

    try {
        // Dynamically import the selected tool
        const { initRigRemovalTool, initAttachmentRigTool } = await toolModules[toolName]();

        // Clear the previous tool's UI
        toolsContainer.innerHTML = '';
        
        // Initialize the new tool
        if (toolName === 'rigremoval') {
            initRigRemovalTool(scene, viewerContainer, currentModel, originalModel);
        } else if (toolName === 'attachmentrig') {
            initAttachmentRigTool(scene, viewerContainer);
        }

        currentTool = toolName;
    } catch (error) {
        console.error(`Failed to load or initialize tool: ${toolName}`, error);
        toolsContainer.innerHTML = '<p>Error loading tool. Please try again.</p>';
    }
}

// Attach event listeners to the navigation bar
document.querySelectorAll('.nav-item').forEach(item => {
    item.addEventListener('click', () => {
        const toolName = item.getAttribute('data-tool');
        switchTool(toolName);
    });
});

init3DViewer();
switchTool('rigremoval');
