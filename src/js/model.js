// src/js/model.js - Handles GLB model loading and processing.

(function () {
    'use strict';

    let fileInput, loadingModal;
    const bus = new EventTarget();

    // --- Helper Functions ---
    const formatBytes = (bytes, decimals = 2) => {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const dm = decimals < 0 ? 0 : decimals;
        const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
    };

    const sanitizeMaterials = (model) => {
        const { THREE } = window.Phonebook;
        model.traverse((child) => {
            if (!child.isMesh || !child.material) return;
            const mats = Array.isArray(child.material) ? child.material : [child.material];
            mats.forEach(mat => {
                if (!mat.transparent) {
                    mat.transparent = false;
                    mat.opacity = 1;
                    mat.alphaTest = 0;
                }
                mat.depthWrite = true;
                mat.depthTest = true;
                mat.side = THREE.FrontSide;
                mat.needsUpdate = true;
            });
        });
    };
    
    function centerAndGroundModel(model) {
        const { THREE } = window.Phonebook;
        const box = new THREE.Box3().setFromObject(model);
        const center = box.getCenter(new THREE.Vector3());

        model.position.x -= center.x;
        model.position.z -= center.z;
        model.position.y -= box.min.y;
    }

    // --- UI Injection ---
    function injectUI() {
        fileInput = document.createElement('input');
        fileInput.type = 'file';
        fileInput.accept = '.glb';
        fileInput.style.display = 'none';
        document.body.appendChild(fileInput);

        const style = document.createElement('style');
        style.textContent = `
            .tf-modal-overlay {
                position: fixed; inset: 0; background: rgba(0,0,0,0.7);
                backdrop-filter: blur(5px); -webkit-backdrop-filter: blur(5px);
                z-index: 1000; display: flex; align-items: center; justify-content: center;
                opacity: 0; pointer-events: none; transition: opacity 0.3s ease;
            }
            .tf-modal-overlay.show { opacity: 1; pointer-events: auto; }
            .tf-loading-modal {
                width: min(400px, 90vw); padding: 25px;
                background: rgba(28, 32, 38, 0.9); border-radius: 12px;
                border: 1px solid rgba(255,255,255,0.1);
                box-shadow: 0 8px 30px rgba(0,0,0,0.4);
                display: flex; flex-direction: column; gap: 15px;
            }
            .tf-loading-modal .title { font-size: 18px; font-weight: 600; text-align: center; }
            .tf-loading-modal .progress-bar {
                width: 100%; height: 10px; background: rgba(255,255,255,0.1);
                border-radius: 5px; overflow: hidden;
            }
            .tf-loading-modal .progress-fill {
                width: 0%; height: 100%;
                background: linear-gradient(90deg, #6a11cb 0%, #2575fc 100%);
                transition: width 0.2s ease-out;
            }
            .tf-loading-modal .status-text { text-align: center; color: #a0a7b0; font-size: 14px; }
            .tf-loading-modal .complete-btn {
                margin-top: 10px; padding: 10px 20px; font-size: 15px; font-weight: 600;
                border-radius: 20px; border: none; background: #00c853; color: #fff;
                cursor: pointer; display: none; /* Hidden by default */
            }
        `;
        document.head.appendChild(style);

        loadingModal = document.createElement('div');
        loadingModal.className = 'tf-modal-overlay';
        loadingModal.innerHTML = `
            <div class="tf-loading-modal">
                <div class="title">Loading Model</div>
                <div class="progress-bar"><div class="progress-fill"></div></div>
                <div class="status-text">Waiting for file...</div>
                <button class="complete-btn">Complete</button>
            </div>
        `;
        document.body.appendChild(loadingModal);
    }
    
    function showLoadingModal(visible) {
        loadingModal.classList.toggle('show', visible);
    }

    function updateModalProgress(percent, status) {
        const fill = loadingModal.querySelector('.progress-fill');
        const text = loadingModal.querySelector('.status-text');
        if (fill) fill.style.width = `${percent}%`;
        if (text) text.textContent = status;
    }

    function showCompleteButton() {
        const btn = loadingModal.querySelector('.complete-btn');
        btn.style.display = 'block';
        btn.onclick = () => showLoadingModal(false);
    }

    function loadFromFile(file) {
        const { GLTFLoader, THREE } = window.Phonebook;
        const reader = new FileReader();
        
        reader.onload = (e) => {
            updateModalProgress(25, 'Parsing file...');
            const loader = new GLTFLoader();
            loader.parse(e.target.result, '', (gltf) => {
                updateModalProgress(90, 'Processing scene...');
                const model = gltf.scene;
                let vertexCount = 0;
                let triangleCount = 0;

                sanitizeMaterials(model);
                
                // --- MODIFICATION START ---
                // Correctly detect position by checking the center of the model's bounding box.
                const box = new THREE.Box3().setFromObject(model);
                const center = box.getCenter(new THREE.Vector3());
                const hasPosition = center.lengthSq() > 0.0001; // Use bounding box center

                if (!hasPosition || confirm('This model has a saved position. Do you want to auto-center it at the origin?\n\n(Click OK to center, or Cancel to keep its position).')) {
                    centerAndGroundModel(model);
                }
                // --- MODIFICATION END ---

                model.traverse(obj => {
                    if (obj.isMesh) {
                        obj.castShadow = true;
                        obj.receiveShadow = true;
                        if (obj.geometry) {
                            vertexCount += obj.geometry.attributes.position.count;
                            if (obj.geometry.index) {
                                triangleCount += obj.geometry.index.count / 3;
                            } else {
                                triangleCount += obj.geometry.attributes.position.count / 3;
                            }
                        }
                    }
                });
                
                window.Viewer.add(model);
                updateModalProgress(100, 'Model loaded successfully!');
                showCompleteButton();
                
                const modelData = {
                    id: `model-${Date.now()}`,
                    name: file.name,
                    fileType: 'GLB',
                    vertices: vertexCount,
                    polygons: Math.floor(triangleCount),
                    fileSize: formatBytes(file.size),
                    object: model,
                    isMainModel: true
                };
                
                App.emit('asset:loaded', modelData);

            }, (error) => {
                console.error('GLTF Parsing Error:', error);
                updateModalProgress(100, `Error: ${error.message || 'Could not parse file'}`);
                loadingModal.querySelector('.progress-fill').style.background = '#ff3b30';
                showCompleteButton();
            });
        };
        
        reader.onprogress = (e) => {
            if (e.lengthComputable) {
                const percent = (e.loaded / e.total) * 20;
                updateModalProgress(percent, 'Reading file...');
            }
        };

        reader.readAsArrayBuffer(file);
    }

    function bootstrap() {
        if (window.ModelManager) return;
        injectUI();
        fileInput.addEventListener('change', (event) => {
            const file = event.target.files[0];
            if (file) {
                showLoadingModal(true);
                updateModalProgress(0, 'Preparing to load...');
                setTimeout(() => loadFromFile(file), 300);
            }
            fileInput.value = '';
        });
        window.ModelManager = {
            load: () => fileInput.click(),
        };
        window.Debug?.log('Model Manager ready.');
    }

    if (window.App?.glVersion) {
        bootstrap();
    } else {
        window.App?.on('app:booted', bootstrap);
    }
})();
