// tools/rigremoval.js
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { GLTFExporter } from 'three/addons/exporters/GLTFExporter.js';
import { OBJExporter } from 'three/addons/exporters/OBJExporter.js';
import { OBJLoader } from 'three/addons/loaders/OBJLoader.js';

export function init(scene, uiContainer, onBackToDashboard) {
    let currentModel = null;
    let objString = null;
    let originalMaterials = new Map();

    uiContainer.innerHTML = `
        <div class="fade-in" style="display: flex; flex-direction: column; height: 100%;">
            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 1rem; flex-grow: 1;">
                <div class="card">
                    <h2>1. Load Model</h2>
                    <label for="rig-model-input" class="file-label">Load .glb File</label>
                    <input type="file" id="rig-model-input" accept=".glb" hidden>
                    <div id="rig-status-log" class="status-log">Select a rigged GLB file.</div>
                </div>
                <div class="card">
                    <h2>2. Process</h2>
                    <button id="remove-rig-btn" class="btn" disabled>Remove Rig</button>
                    <div id="process-log" style="font-size: 0.8em; text-align: left; background: rgba(0,0,0,0.05); padding: 5px; border-radius: 4px; height: 100px; overflow-y: scroll; display: none;"></div>
                </div>
                <div class="card">
                    <h2>3. Export</h2>
                    <button id="export-glb-btn" class="btn" disabled>Export as .glb</button>
                    <p style="font-size: 0.8em; text-align: center; color: var(--secondary-text-color);">*This will be an unrigged model.</p>
                </div>
            </div>
            <button class="btn dashboard" id="dashboard-btn" style="margin-top: auto;">Dashboard</button>
        </div>
        
        <div id="rig-removed-modal" style="display: none; position: fixed; z-index: 10; left: 0; top: 0; width: 100%; height: 100%; overflow: auto; background-color: rgba(0,0,0,0.4);">
            <div style="background-color: #fefefe; margin: 15% auto; padding: 20px; border: 1px solid #888; width: 80%; max-width: 400px; text-align: center; border-radius: 10px;">
                <p style="font-size: 1.2em; font-weight: bold; margin-bottom: 20px;">Rig Removed!</p>
                <button id="complete-btn" class="btn">Complete</button>
            </div>
        </div>
        
        <div id="preparing-download-modal" style="display: none; position: fixed; z-index: 10; left: 0; top: 0; width: 100%; height: 100%; overflow: auto; background-color: rgba(0,0,0,0.4);">
            <div style="background-color: #fefefe; margin: 15% auto; padding: 20px; border: 1px solid #888; width: 80%; max-width: 400px; text-align: center; border-radius: 10px;">
                <p style="font-size: 1.2em; font-weight: bold; margin-bottom: 20px;">Preparing Download...</p>
                <div id="download-spinner" style="border: 4px solid #f3f3f3; border-top: 4px solid #3498db; border-radius: 50%; width: 40px; height: 40px; animation: spin 2s linear infinite; margin: 0 auto;"></div>
                <style> @keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } } </style>
            </div>
        </div>
    `;

    const statusLog = document.getElementById('rig-status-log');
    const modelInput = document.getElementById('rig-model-input');
    const removeRigBtn = document.getElementById('remove-rig-btn');
    const exportGlbBtn = document.getElementById('export-glb-btn');
    const dashboardBtn = document.getElementById('dashboard-btn');
    const processLogDiv = document.getElementById('process-log');
    const rigRemovedModal = document.getElementById('rig-removed-modal');
    const completeBtn = document.getElementById('complete-btn');
    const preparingDownloadModal = document.getElementById('preparing-download-modal');

    const gltfLoader = new GLTFLoader();
    const objExporter = new OBJExporter();
    const objLoader = new OBJLoader();
    const gltfExporter = new GLTFExporter();

    const logStatus = (message, level = 'info') => {
        statusLog.textContent = message;
        statusLog.className = 'status-log';
        if (level === 'error') statusLog.classList.add('error');
    };

    const logProcess = (message) => {
        processLogDiv.style.display = 'block';
        const line = document.createElement('div');
        line.textContent = `[${new Date().toLocaleTimeString()}] ${message}`;
        processLogDiv.appendChild(line);
        processLogDiv.scrollTop = processLogDiv.scrollHeight;
    };
    
    const resetToolState = () => {
        if (currentModel) scene.remove(currentModel);
        currentModel = null;
        objString = null;
        originalMaterials.clear();
        removeRigBtn.disabled = true;
        exportGlbBtn.disabled = true;
        processLogDiv.textContent = '';
        processLogDiv.style.display = 'none';
        logStatus("Select a rigged GLB file.");
    };

    const centerAndOrientModel = (model) => {
        const box = new THREE.Box3().setFromObject(model);
        const size = box.getSize(new THREE.Vector3());
        
        if (size.y > 0) model.scale.setScalar(1.65 / size.y);

        const scaledBox = new THREE.Box3().setFromObject(model);
        model.position.y -= scaledBox.min.y;
    };

    const convertToGlb = () => {
        if (!objString) {
            logStatus("No OBJ data to convert.", 'error');
            return;
        }

        logStatus('Rebuilding model...');
        logProcess("Starting GLB conversion...");

        if (currentModel) scene.remove(currentModel);

        setTimeout(() => {
            try {
                const deRiggedModel = objLoader.parse(objString);
                
                centerAndOrientModel(deRiggedModel);
                deRiggedModel.rotation.set(0, 0, 0);

                deRiggedModel.traverse(node => {
                    if (node.isMesh) {
                        const originalMaterial = originalMaterials.get(node.name);
                        if (originalMaterial) {
                            node.material = originalMaterial;
                        } else {
                            node.material = new THREE.MeshStandardMaterial({ color: 0x999999 });
                        }
                    }
                });

                currentModel = deRiggedModel;
                scene.add(currentModel);

                logProcess("GLB conversion complete.");
                exportGlbBtn.disabled = false;
                logStatus("Model ready for export.");
            } catch (e) {
                logProcess("Error during GLB conversion: " + e.message);
                logStatus("Conversion failed.", 'error');
                console.error(e);
            }
        }, 100);
    };

    modelInput.addEventListener('change', (event) => {
        const file = event.target.files[0];
        if (!file) return;
        resetToolState();
        logStatus(`Loading model: ${file.name}`);
        const reader = new FileReader();
        reader.onload = (e) => {
            gltfLoader.parse(e.target.result, '', (gltf) => {
                const model = gltf.scene;

                originalMaterials.clear();
                model.traverse(node => {
                    if (node.isMesh && node.material) {
                        originalMaterials.set(node.name, node.material.clone());
                    }
                });

                scene.children.slice().forEach(child => {
                    if (child.type === 'Mesh' || child.type === 'Group' || child.type === 'SkinnedMesh') {
                        scene.remove(child);
                    }
                });
                scene.add(model);
                
                model.rotation.set(-Math.PI / 2, 0, Math.PI); 
                centerAndOrientModel(model);
                currentModel = model;

                removeRigBtn.disabled = false;
                logStatus("Model loaded. Ready to remove rig.");
            }, (error) => {
                logStatus("Error: Failed to parse GLB file.", 'error');
                console.error(error);
            });
        };
        reader.readAsArrayBuffer(file);
    });

    removeRigBtn.addEventListener('click', () => {
        if (!currentModel) {
            logStatus("No model loaded.", 'error');
            return;
        }

        logStatus('Removing rig...');
        processLogDiv.style.display = 'block';
        processLogDiv.textContent = '';
        logProcess("Starting rig removal process...");
        
        setTimeout(() => {
            try {
                if (currentModel.animations && currentModel.animations.length > 0) {
                    const mixer = new THREE.AnimationMixer(currentModel);
                    mixer.setTime(0);
                    mixer.update(0);
                }
                
                objString = objExporter.parse(currentModel);
                logProcess("Rig removal complete.");
                removeRigBtn.disabled = true;
                logStatus("Rig removed. Press 'Complete' to finalize the model.");
                rigRemovedModal.style.display = 'block';
            } catch (e) {
                logProcess("Error during rig removal: " + e.message);
                logStatus("Rig removal failed.", 'error');
                console.error(e);
            }
        }, 100);
    });

    completeBtn.addEventListener('click', () => {
        rigRemovedModal.style.display = 'none';
        convertToGlb();
    });

    exportGlbBtn.addEventListener('click', () => {
        if (!currentModel) {
            logStatus("No model to export.", 'error');
            return;
        }
        
        preparingDownloadModal.style.display = 'block';

        setTimeout(() => {
            gltfExporter.parse(currentModel, (result) => {
                const blob = new Blob([result], { type: 'model/gltf-binary' });
                const link = document.createElement('a');
                link.href = URL.createObjectURL(blob);
                link.download = 'model_static.glb';
                link.click();
                URL.revokeObjectURL(link.href);
                logStatus('Export complete!');
                preparingDownloadModal.style.display = 'none';
            }, (error) => {
                logStatus('Export failed. See console.', 'error');
                console.error('An error happened during parsing', error);
                preparingDownloadModal.style.display = 'none';
            }, { binary: true });
        }, 500);
    });

    dashboardBtn.addEventListener('click', () => {
        resetToolState();
        onBackToDashboard();
    });
}
