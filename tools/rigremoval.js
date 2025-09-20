// tools/rigremoval.js
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { GLTFExporter } from 'three/addons/exporters/GLTFExporter.js';

export function init(scene, uiContainer, onBackToDashboard) {
    let currentModel = null;
    let originalModel = null;

    uiContainer.innerHTML = `
        <div style="display: flex; flex-direction: column; height: 100%;">
            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 1rem; flex-grow: 1;">
                <div class="card">
                    <h2>1. Load Character</h2>
                    <label for="rig-model-input" class="file-label">Load .glb File</label>
                    <input type="file" id="rig-model-input" accept=".glb" hidden>
                    <div id="rig-status-log" class="status-log">Load a GLB model to start.</div>
                </div>
                <div class="card">
                    <h2>2. Load Textures</h2>
                    <label for="rig-texture-input" class="file-label disabled">Load Images</label>
                    <input type="file" id="rig-texture-input" accept=".png, .jpg, .jpeg" multiple hidden disabled>
                </div>
                <div class="card">
                    <h2>3. Export</h2>
                    <button id="rig-export-btn" class="btn" disabled>Export as .glb</button>
                </div>
            </div>
            <button class="btn dashboard" id="dashboard-btn" style="margin-top: auto;">Dashboard</button>
        </div>
    `;

    const statusLog = document.getElementById('rig-status-log');
    const modelInput = document.getElementById('rig-model-input');
    const textureInput = document.getElementById('rig-texture-input');
    const exportBtn = document.getElementById('rig-export-btn');
    const textureLabel = document.querySelector('label[for="rig-texture-input"]');
    const dashboardBtn = document.getElementById('dashboard-btn');
    const gltfLoader = new GLTFLoader();
    const textureLoader = new THREE.TextureLoader();

    const logStatus = (message, level = 'info') => {
        statusLog.textContent = message;
        statusLog.className = 'status-log';
        if (level === 'error') statusLog.classList.add('error');
    };

    const resetToolState = () => {
        if (currentModel) scene.remove(currentModel);
        currentModel = null;
        originalModel = null;
        textureInput.disabled = true;
        textureLabel.classList.add('disabled');
        exportBtn.disabled = true;
        logStatus("Load a GLB model to start.");
    };

    const textureMap = {
        _albedo: 'map', _color: 'map', _diffuse: 'map', _basecolor: 'map',
        _normal: 'normalMap', _n: 'normalMap', _roughness: 'roughnessMap',
        _rough: 'roughnessMap', _metallic: 'metalnessMap', _metal: 'metalnessMap',
        _ao: 'aoMap', _emissive: 'emissiveMap'
    };

    const applyTextures = (model, textureFiles) => {
        if (textureFiles.length === 0) return;
        logStatus(`Applying ${textureFiles.length} texture(s)...`);
        const materials = new Set();
        model.traverse(node => {
            if (node.isMesh && node.material) {
                materials.add(node.material);
            }
        });
        textureFiles.forEach(file => {
            const url = URL.createObjectURL(file);
            textureLoader.load(url, (texture) => {
                texture.flipY = false;
                const fileName = file.name.toLowerCase();
                let assigned = false;
                for (const suffix in textureMap) {
                    if (fileName.includes(suffix)) {
                        const mapType = textureMap[suffix];
                        if (mapType === 'map' || mapType === 'emissiveMap') texture.encoding = THREE.sRGBEncoding;
                        materials.forEach(material => {
                            if (material.hasOwnProperty(mapType)) {
                                material[mapType] = texture;
                                material.needsUpdate = true;
                                assigned = true;
                            }
                        });
                        break;
                    }
                }
                if (assigned) console.log(`Applied ${file.name}`);
                URL.revokeObjectURL(url);
            });
        });
        logStatus("Textures applied successfully.");
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

                // Create a new, clean model group to hold the de-rigged meshes
                const staticModel = new THREE.Group();

                // Traverse the original model and process its meshes
                model.traverse(node => {
                    if (node.isSkinnedMesh) {
                        // Extract the geometry and material
                        const geometry = node.geometry;
                        const material = node.material.clone();
                        
                        // Create a new standard Mesh
                        const newMesh = new THREE.Mesh(geometry, material);

                        // Copy the world transformation to preserve its original location in T-pose
                        const worldPosition = new THREE.Vector3();
                        const worldQuaternion = new THREE.Quaternion();
                        const worldScale = new THREE.Vector3();
                        node.matrixWorld.decompose(worldPosition, worldQuaternion, worldScale);
                        
                        newMesh.position.copy(worldPosition);
                        newMesh.quaternion.copy(worldQuaternion);
                        newMesh.scale.copy(worldScale);
                        
                        // Add the new mesh to the static group
                        staticModel.add(newMesh);
                    } else if (node.isMesh && !node.isSkinnedMesh) {
                        // If it's a regular mesh, just clone it and add it
                        staticModel.add(node.clone());
                    }
                });
                
                // Set the model for the scene and export
                currentModel = staticModel;
                scene.add(currentModel);

                const box = new THREE.Box3().setFromObject(currentModel);
                const size = box.getSize(new THREE.Vector3());
                if (size.y > 0) currentModel.scale.setScalar(1.65 / size.y);
                const scaledBox = new THREE.Box3().setFromObject(currentModel);
                currentModel.position.y -= scaledBox.min.y;
                currentModel.traverse(node => {
                    if (node.isMesh) {
                        node.castShadow = true;
                    }
                });

                exportBtn.disabled = false;
                textureInput.disabled = false;
                textureLabel.classList.remove('disabled');
                logStatus("Model loaded and de-rigged. You can now load textures or export.");
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

    exportBtn.addEventListener('click', () => {
        if (!currentModel) return;
        logStatus('Exporting to GLB...');
        
        const exporter = new GLTFExporter();
        const options = {
            binary: true
        };
        
        exporter.parse(currentModel, (result) => {
            if (result instanceof ArrayBuffer) {
                const blob = new Blob([result], { type: 'model/gltf-binary' });
                const link = document.createElement('a');
                link.href = URL.createObjectURL(blob);
                link.download = 'model_static.glb';
                link.click();
                URL.revokeObjectURL(link.href);
                logStatus('Export complete!');
            } else {
                logStatus('Export failed: Invalid result format.', 'error');
                console.error('GLTFExporter result is not an ArrayBuffer.');
            }
        }, (error) => {
            logStatus('Export failed. See console.', 'error');
            console.error('An error happened during parsing', error);
        }, options);
    });

    dashboardBtn.addEventListener('click', () => {
        resetToolState();
        onBackToDashboard();
    });
}
