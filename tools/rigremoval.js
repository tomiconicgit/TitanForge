import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { GLTFExporter } from 'three/addons/exporters/GLTFExporter.js';

// All the logic from your original PWA is here.
export function initRigRemovalTool(scene, viewerContainer, currentModel, originalModel) {
    const uiContainer = document.getElementById('tools-container');
    uiContainer.innerHTML = `
        <div id="ui-content" style="width: 100%; max-width: 1000px; display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 1rem; margin: 0 auto;">
            <div class="card" style="background-color: var(--panel-bg); border-radius: 12px; padding: 1.25rem; box-shadow: 0 4px 12px var(--shadow-color); display: flex; flex-direction: column; gap: 0.75rem;">
                <h2>1. Load Character</h2>
                <label for="rig-model-input" class="file-label" style="display: block; width: 100%; padding: 0.8rem; border: 1px solid var(--border-color); border-radius: 8px; font-size: 0.9rem; font-weight: 500; text-align: center; cursor: pointer; transition: all 0.2s ease; background-color: #e9e9eb; color: var(--text-color);">Load .glb File</label>
                <input type="file" id="rig-model-input" accept=".glb" hidden>
                <div id="rig-status-log" style="font-size: 0.85rem; text-align: center; color: #636366; padding: 0.5rem; background-color: #e9e9eb; border-radius: 6px; margin-top: auto; transition: all 0.3s ease;">Load a GLB model to start.</div>
            </div>
            <div class="card" style="background-color: var(--panel-bg); border-radius: 12px; padding: 1.25rem; box-shadow: 0 4px 12px var(--shadow-color); display: flex; flex-direction: column; gap: 0.75rem;">
                <h2>2. Load Textures</h2>
                <label for="rig-texture-input" class="file-label disabled" style="display: block; width: 100%; padding: 0.8rem; border: 1px solid var(--border-color); border-radius: 8px; font-size: 0.9rem; font-weight: 500; text-align: center; cursor: pointer; transition: all 0.2s ease; background-color: #e9e9eb; color: #8e8e93; opacity: 0.7;">Load Images</label>
                <input type="file" id="rig-texture-input" accept=".png, .jpg, .jpeg" multiple hidden disabled>
            </div>
            <div class="card" style="background-color: var(--panel-bg); border-radius: 12px; padding: 1.25rem; box-shadow: 0 4px 12px var(--shadow-color); display: flex; flex-direction: column; gap: 0.75rem;">
                <h2>3. Process & Export</h2>
                <button id="rig-process-btn" class="btn" disabled style="display: block; width: 100%; padding: 0.8rem; border: none; border-radius: 8px; font-size: 0.9rem; font-weight: 600; text-align: center; cursor: not-allowed; transition: all 0.2s ease; background-color: #e9e9eb; color: #8e8e93; opacity: 0.7;">Remove Rig & T-Pose</button>
                <button id="rig-export-btn" class="btn" disabled style="display: block; width: 100%; padding: 0.8rem; border: none; border-radius: 8px; font-size: 0.9rem; font-weight: 600; text-align: center; cursor: not-allowed; transition: all 0.2s ease; background-color: #e9e9eb; color: #8e8e93; opacity: 0.7;">Export as .glb</button>
            </div>
        </div>
    `;

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

    const applyTextures = (model, textureFiles) => {
        if (textureFiles.length === 0) return;
        logStatus(`Applying ${textureFiles.length} texture(s)...`);
        const materials = new Set();
        model.traverse(node => {
            if ((node.isMesh || node.isSkinnedMesh) && node.material) {
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
                if(assigned) console.log(`Applied ${file.name}`);
                URL.revokeObjectURL(url);
            });
        });
        logStatus("Textures applied successfully.");
    };
    
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
