// tools/rigremoval.js
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { GLTFExporter } from 'three/addons/exporters/GLTFExporter.js';
import { OBJExporter } from 'three/addons/exporters/OBJExporter.js';
import { OBJLoader } from 'three/addons/loaders/OBJLoader.js';

export function init(scene, uiContainer, onBackToDashboard) {
    let currentModel = null;
    let objString = null;
    let originalMaterials = new Map(); // Store materials for re-application

    uiContainer.innerHTML = `
        <div style="display: flex; flex-direction: column; height: 100%;">
            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 1rem; flex-grow: 1;">
                <div class="card">
                    <h2>1. Load Model</h2>
                    <label for="rig-model-input" class="file-label">Load .glb File</label>
                    <input type="file" id="rig-model-input" accept=".glb" hidden>
                    <div id="rig-status-log" class="status-log">Select a rigged GLB file.</div>
                </div>
                <div class="card">
                    <h2>2. Convert</h2>
                    <button id="convert-to-obj-btn" class="btn" disabled>Convert to OBJ</button>
                    <button id="convert-to-glb-btn" class="btn" disabled>Convert to GLB</button>
                    <div id="process-log" style="font-size: 0.8em; text-align: left; background: rgba(0,0,0,0.05); padding: 5px; border-radius: 4px; height: 100px; overflow-y: scroll; display: none;"></div>
                </div>
                <div class="card">
                    <h2>3. Export</h2>
                    <button id="rig-export-btn" class="btn" disabled>Export as .glb</button>
                    <p style="font-size: 0.8em; text-align: center; color: #636366;">*This will be an unrigged model.</p>
                </div>
            </div>
            <button class="btn dashboard" id="dashboard-btn" style="margin-top: auto;">Dashboard</button>
        </div>
    `;

    const statusLog = document.getElementById('rig-status-log');
    const modelInput = document.getElementById('rig-model-input');
    const convertToObjBtn = document.getElementById('convert-to-obj-btn');
    const convertToGlbBtn = document.getElementById('convert-to-glb-btn');
    const exportBtn = document.getElementById('rig-export-btn');
    const dashboardBtn = document.getElementById('dashboard-btn');
    const processLogDiv = document.getElementById('process-log');
    
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
        convertToObjBtn.disabled = true;
        convertToGlbBtn.disabled = true;
        exportBtn.disabled = true;
        processLogDiv.textContent = '';
        processLogDiv.style.display = 'none';
        logStatus("Select a rigged GLB file.");
    };

    const centerAndOrientModel = (model) => {
        const box = new THREE.Box3().setFromObject(model);
        const size = box.getSize(new THREE.Vector3());
        
        // Scale model to a standard size (e.g., 1.65 units in height)
        if (size.y > 0) model.scale.setScalar(1.65 / size.y);

        // Recenter the model to the origin
        const scaledBox = new THREE.Box3().setFromObject(model);
        model.position.y -= scaledBox.min.y;
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

                // Save original materials before conversion
                originalMaterials.clear();
                model.traverse(node => {
                    if (node.isMesh && node.material) {
                        // We store the material indexed by its name
                        originalMaterials.set(node.name, node.material.clone());
                    }
                });

                // Set initial orientation
                model.rotation.set(-Math.PI / 2, 0, Math.PI); 

                // Add model to scene and adjust
                scene.add(model);
                centerAndOrientModel(model);
                currentModel = model;

                convertToObjBtn.disabled = false;
                logStatus("Model loaded. Ready to convert to OBJ.");
            }, (error) => {
                logStatus("Error: Failed to parse GLB file.", 'error');
                console.error(error);
            });
        };
        reader.readAsArrayBuffer(file);
    });

    convertToObjBtn.addEventListener('click', () => {
        if (!currentModel) {
            logStatus("No model loaded.", 'error');
            return;
        }

        logStatus('Converting to OBJ...');
        processLogDiv.style.display = 'block';
        processLogDiv.textContent = '';
        logProcess("Starting OBJ conversion...");
        
        setTimeout(() => {
            try {
                // Ensure the model is in its neutral pose before exporting
                if (currentModel.animations && currentModel.animations.length > 0) {
                    const mixer = new THREE.AnimationMixer(currentModel);
                    mixer.setTime(0);
                    mixer.update(0);
                }
                
                objString = objExporter.parse(currentModel);
                logProcess("OBJ conversion complete.");
                convertToObjBtn.disabled = true;
                convertToGlbBtn.disabled = false;
                logStatus("Conversion to OBJ successful. Ready to convert back to GLB.");
            } catch (e) {
                logProcess("Error during OBJ conversion: " + e.message);
                logStatus("Conversion failed.", 'error');
                console.error(e);
            }
        }, 100);
    });

    convertToGlbBtn.addEventListener('click', () => {
        if (!objString) {
            logStatus("No OBJ data to convert.", 'error');
            return;
        }

        logStatus('Converting to GLB...');
        logProcess("Starting GLB conversion...");

        // Clear the old model from the scene
        if (currentModel) scene.remove(currentModel);

        setTimeout(() => {
            try {
                // Load the OBJ string back into a Three.js scene
                const deRiggedModel = objLoader.parse(objString);
                
                // Re-center and re-orient the de-rigged model
                centerAndOrientModel(deRiggedModel);
                deRiggedModel.rotation.set(0, 0, 0); // Reset rotation after centering

                // Re-apply original materials to the new meshes
                deRiggedModel.traverse(node => {
                    if (node.isMesh) {
                        const originalMaterial = originalMaterials.get(node.name);
                        if (originalMaterial) {
                            node.material = originalMaterial;
                        } else {
                            // Fallback to a default material if none found
                            node.material = new THREE.MeshStandardMaterial({ color: 0x999999 });
                        }
                    }
                });

                currentModel = deRiggedModel;
                scene.add(currentModel);

                logProcess("GLB conversion complete.");
                convertToGlbBtn.disabled = true;
                exportBtn.disabled = false;
                logStatus("Model ready for export.");
            } catch (e) {
                logProcess("Error during GLB conversion: " + e.message);
                logStatus("Conversion failed.", 'error');
                console.error(e);
            }
        }, 100);
    });

    exportBtn.addEventListener('click', () => {
        if (!currentModel) {
            logStatus("No model to export.", 'error');
            return;
        }
        
        logStatus('Exporting file...');
        
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
