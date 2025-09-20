// tools/rigremoval.js
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { GLTFExporter } from 'three/addons/exporters/GLTFExporter.js';
import { OBJExporter } from 'three/addons/exporters/OBJExporter.js';
import { OBJLoader } from 'three/addons/loaders/OBJLoader.js';

export function init(scene, uiContainer, onBackToDashboard) {
    let currentModel = null;
    
    uiContainer.innerHTML = `
        <div style="display: flex; flex-direction: column; height: 100%;">
            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 1rem; flex-grow: 1;">
                <div class="card">
                    <h2>1. Load & De-rig</h2>
                    <label for="rig-model-input" class="file-label">Load .glb File</label>
                    <input type="file" id="rig-model-input" accept=".glb" hidden>
                    <div id="rig-status-log" class="status-log">Select a rigged GLB file.</div>
                </div>
                <div class="card">
                    <h2>2. Export</h2>
                    <button id="rig-export-btn" class="btn" disabled>Export as .glb</button>
                    <p style="font-size: 0.8em; text-align: center; color: #636366;">*This will be an unrigged model.</p>
                </div>
            </div>
            <button class="btn dashboard" id="dashboard-btn" style="margin-top: auto;">Dashboard</button>
        </div>
    `;

    const statusLog = document.getElementById('rig-status-log');
    const modelInput = document.getElementById('rig-model-input');
    const exportBtn = document.getElementById('rig-export-btn');
    const dashboardBtn = document.getElementById('dashboard-btn');
    
    const gltfLoader = new GLTFLoader();
    const objExporter = new OBJExporter();
    const objLoader = new OBJLoader();
    const gltfExporter = new GLTFExporter();

    const logStatus = (message, level = 'info') => {
        statusLog.textContent = message;
        statusLog.className = 'status-log';
        if (level === 'error') statusLog.classList.add('error');
    };

    const resetToolState = () => {
        if (currentModel) scene.remove(currentModel);
        currentModel = null;
        exportBtn.disabled = true;
        logStatus("Select a rigged GLB file.");
    };

    const loadAndDeRig = (file) => {
        logStatus(`Loading ${file.name}...`);
        
        const reader = new FileReader();
        reader.onload = (e) => {
            gltfLoader.parse(e.target.result, '', (gltf) => {
                const loadedModel = gltf.scene;
                
                // --- Step 1: Export the loaded GLB to an OBJ string ---
                logStatus('Converting to OBJ to remove rig...');
                const objString = objExporter.parse(loadedModel);
                
                // --- Step 2: Load the OBJ string back into a Three.js scene ---
                logStatus('Re-importing OBJ as a static model...');
                const deRiggedModel = objLoader.parse(objString);

                // Re-apply materials from original model
                const originalMaterials = new Map();
                loadedModel.traverse(node => {
                    if (node.isMesh) {
                        originalMaterials.set(node.name, node.material);
                    }
                });

                deRiggedModel.traverse(node => {
                    if (node.isMesh) {
                        const originalMaterial = originalMaterials.get(node.name);
                        if (originalMaterial) {
                            node.material = originalMaterial;
                        }
                    }
                });
                
                // --- Step 3: Clean up and display the new model ---
                resetToolState(); // Clears any old model
                currentModel = deRiggedModel;
                scene.add(currentModel);

                const box = new THREE.Box3().setFromObject(currentModel);
                const size = box.getSize(new THREE.Vector3());
                if (size.y > 0) currentModel.scale.setScalar(1.65 / size.y);
                const scaledBox = new THREE.Box3().setFromObject(currentModel);
                currentModel.position.y -= scaledBox.min.y;

                exportBtn.disabled = false;
                logStatus("Model de-rigged and ready to export.");

            }, (error) => {
                logStatus("Error: Failed to parse GLB file.", 'error');
                console.error(error);
            });
        };
        reader.readAsArrayBuffer(file);
    };

    modelInput.addEventListener('change', (event) => {
        const file = event.target.files[0];
        if (file) {
            loadAndDeRig(file);
        }
    });

    exportBtn.addEventListener('click', () => {
        if (!currentModel) {
            logStatus("No model to export.", 'error');
            return;
        }

        logStatus('Exporting to GLB...');
        
        gltfExporter.parse(currentModel, (result) => {
            const blob = new Blob([result], { type: 'model/gltf-binary' });
            const link = document.createElement('a');
            link.href = URL.createObjectURL(blob);
            link.download = 'model_static.glb';
            link.click();
            URL.revokeObjectURL(link.href);
            logStatus('Export complete!');
        }, (error) => {
            logStatus('Export failed. See console.', 'error');
            console.error('An error happened during parsing', error);
        }, { binary: true });
    });

    dashboardBtn.addEventListener('click', () => {
        resetToolState();
        onBackToDashboard();
    });
}
