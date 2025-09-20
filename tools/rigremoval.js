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
    let isProcessing = false;
    let exportFileName = 'model_static.glb'; // Default filename

    uiContainer.innerHTML = `
        <div id="rig-removal-ui-container" style="display: flex; flex-direction: column; height: 100%; justify-content: flex-end;">
            <div id="export-panel" class="card" style="display: none; padding: 1rem; text-align: center;">
                <button id="rename-btn" class="btn" style="width: 100%; margin-bottom: 1rem;">Rename File</button>
                <button id="export-glb-btn" class="btn" style="width: 100%;">Export as .glb</button>
            </div>
            <button id="back-to-dashboard-btn" class="btn dashboard" style="width: 100%; margin-top: 1rem;">Dashboard</button>
        </div>

        <div id="main-modal" class="modal-bg" style="display: none;">
            <div class="modal-content" id="modal-content"></div>
        </div>
        
        <div id="rename-modal" class="modal-bg" style="display: none;">
            <div class="modal-content">
                <h2 class="modal-title">Rename File</h2>
                <input type="text" id="filename-input" placeholder="Enter new filename" style="padding: 10px; border-radius: 8px; border: 1px solid var(--border-color); background: var(--panel-bg); color: var(--text-color);">
                <div style="display: flex; gap: 10px;">
                    <button id="confirm-rename-btn" class="btn">Confirm</button>
                    <button id="cancel-rename-btn" class="btn dashboard">Cancel</button>
                </div>
            </div>
        </div>
    `;

    const exportPanel = document.getElementById('export-panel');
    const exportGlbBtn = document.getElementById('export-glb-btn');
    const renameBtn = document.getElementById('rename-btn');
    const backToDashboardBtn = document.getElementById('back-to-dashboard-btn');
    const mainModal = document.getElementById('main-modal');
    const modalContent = document.getElementById('modal-content');
    const renameModal = document.getElementById('rename-modal');
    const filenameInput = document.getElementById('filename-input');
    const confirmRenameBtn = document.getElementById('confirm-rename-btn');
    const cancelRenameBtn = document.getElementById('cancel-rename-btn');

    // Add modal-specific styles dynamically
    const style = document.createElement('style');
    style.innerHTML = `
        .modal-bg {
            position: fixed;
            z-index: 100;
            left: 0; top: 0;
            width: 100%; height: 100%;
            background-color: rgba(0,0,0,0.4);
            display: flex;
            align-items: center;
            justify-content: center;
        }
        .modal-content {
            background: var(--panel-bg);
            border-radius: 24px;
            padding: 30px;
            width: 90%;
            max-width: 400px;
            text-align: center;
            box-shadow: 0 10px 30px rgba(0,0,0,0.5);
            backdrop-filter: blur(40px);
            -webkit-backdrop-filter: blur(40px);
            display: flex;
            flex-direction: column;
            gap: 1.5rem;
            transform: scale(0.9);
            opacity: 0;
            animation: modal-fade-in 0.3s forwards;
        }
        .modal-title {
            font-size: 1.5rem;
            font-weight: 600;
        }
        .modal-loader {
            border: 4px solid var(--border-color);
            border-top: 4px solid var(--primary-color);
            border-radius: 50%;
            width: 40px;
            height: 40px;
            animation: spin 1s linear infinite;
            margin: 0 auto;
        }
        @keyframes modal-fade-in {
            to { transform: scale(1); opacity: 1; }
        }
        @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
        }
    `;
    document.head.appendChild(style);

    const gltfLoader = new GLTFLoader();
    const objExporter = new OBJExporter();
    const objLoader = new OBJLoader();
    const gltfExporter = new GLTFExporter();

    const showModal = (contentHTML) => {
        modalContent.innerHTML = contentHTML;
        mainModal.style.display = 'flex';
    };

    const hideModal = () => {
        mainModal.style.display = 'none';
        modalContent.innerHTML = '';
    };

    const showRenameModal = () => {
        filenameInput.value = exportFileName.replace('.glb', '');
        renameModal.style.display = 'flex';
    };

    const hideRenameModal = () => {
        renameModal.style.display = 'none';
    };
    
    const resetToolState = () => {
        if (currentModel) scene.remove(currentModel);
        currentModel = null;
        objString = null;
        originalMaterials.clear();
        exportPanel.style.display = 'none';
        hideModal();
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

    // Event Listeners
    backToDashboardBtn.addEventListener('click', () => {
        resetToolState();
        onBackToDashboard();
    });

    renameBtn.addEventListener('click', showRenameModal);

    confirmRenameBtn.addEventListener('click', () => {
        const newName = filenameInput.value.trim();
        if (newName) {
            exportFileName = newName.endsWith('.glb') ? newName : `${newName}.glb`;
        } else {
            exportFileName = 'model_static.glb';
        }
        hideRenameModal();
    });

    cancelRenameBtn.addEventListener('click', hideRenameModal);

    exportGlbBtn.addEventListener('click', () => {
        if (!currentModel) return;
        
        showModal(`
            <h2 class="modal-title">Preparing Download</h2>
            <div class="modal-loader"></div>
        `);

        setTimeout(() => {
            gltfExporter.parse(currentModel, (result) => {
                const blob = new Blob([result], { type: 'model/gltf-binary' });
                const link = document.createElement('a');
                link.href = URL.createObjectURL(blob);
                link.download = exportFileName;
                link.click();
                URL.revokeObjectURL(link.href);
                logStatus('Export complete!');
                hideModal();
            }, (error) => {
                showModal(`
                    <h2 class="modal-title" style="color: var(--error-color);">Export Failed</h2>
                    <p>An error occurred during export. See the console for details.</p>
                    <button class="btn" id="error-close-btn">Close</button>
                `);
                document.getElementById('error-close-btn').addEventListener('click', hideModal);
                console.error('An error happened during parsing', error);
            }, { binary: true });
        }, 500);
    });

    const initLoadModal = () => {
        showModal(`
            <h2 class="modal-title">Load GLB</h2>
            <p>Choose a GLB file to remove its skeletal rig.</p>
            <label for="rig-model-input" class="btn">Choose File</label>
            <input type="file" id="rig-model-input" accept=".glb" hidden>
            <button class="btn dashboard" id="cancel-load-btn">Dashboard</button>
        `);
    
        document.getElementById('rig-model-input').addEventListener('change', (event) => {
            const file = event.target.files[0];
            if (file) {
                loadGLBAndShowProcess(file);
            } else {
                hideModal();
            }
        });
    
        document.getElementById('cancel-load-btn').addEventListener('click', () => {
            hideModal();
            onBackToDashboard();
        });
    };

    const loadGLBAndShowProcess = (file) => {
        showModal(`
            <h2 class="modal-title">Loading Model</h2>
            <p>Processing file: ${file.name}</p>
            <div class="modal-loader"></div>
        `);
        
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

                hideModal();
                showProcessModal();
            }, (error) => {
                showModal(`
                    <h2 class="modal-title" style="color: var(--error-color);">Error</h2>
                    <p>Failed to parse GLB file. Check the console for details.</p>
                    <button class="btn" onclick="location.reload()">Reload</button>
                `);
                console.error(error);
            });
        };
        reader.readAsArrayBuffer(file);
    };

    const showProcessModal = () => {
        showModal(`
            <h2 class="modal-title">Model Loaded</h2>
            <p>Your model is ready. What would you like to do?</p>
            <button class="btn" id="remove-rig-btn">Remove Rig</button>
            <button class="btn dashboard" id="cancel-process-btn">Dashboard</button>
        `);
        document.getElementById('remove-rig-btn').addEventListener('click', removeRig);
        document.getElementById('cancel-process-btn').addEventListener('click', () => {
            resetToolState();
            onBackToDashboard();
        });
    };

    const removeRig = () => {
        if (isProcessing) return;
        isProcessing = true;
        showModal(`
            <h2 class="modal-title">Removing Rig</h2>
            <p>This may take a moment...</p>
            <div class="modal-loader"></div>
        `);
        setTimeout(() => {
            try {
                if (currentModel.animations && currentModel.animations.length > 0) {
                    const mixer = new THREE.AnimationMixer(currentModel);
                    mixer.setTime(0);
                    mixer.update(0);
                }
                objString = objExporter.parse(currentModel);
                isProcessing = false;
                completeProcess();
            } catch (e) {
                isProcessing = false;
                showModal(`
                    <h2 class="modal-title" style="color: var(--error-color);">Error</h2>
                    <p>Rig removal failed: ${e.message}</p>
                    <button class="btn" id="error-close-btn">Close</button>
                `);
                document.getElementById('error-close-btn').addEventListener('click', () => {
                    hideModal();
                });
                console.error(e);
            }
        }, 500);
    };
    
    const completeProcess = () => {
        showModal(`
            <h2 class="modal-title">Rig Removed!</h2>
            <p>The model is now de-rigged and ready to be exported.</p>
            <button class="btn" id="complete-btn">Complete</button>
        `);
        document.getElementById('complete-btn').addEventListener('click', finalizeModel);
    };

    const finalizeModel = () => {
        hideModal();
        if (currentModel) scene.remove(currentModel);
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
        exportPanel.style.display = 'flex';
    };

    initLoadModal();
}
