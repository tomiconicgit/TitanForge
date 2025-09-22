// src/js/asset.js - Handles GLB asset loading and processing.

(function () {
    'use strict';

    let fileInput, loadingModal;

    // --- Helper Functions ---
    const formatBytes = (bytes, decimals = 2) => {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const dm = decimals < 0 ? 0 : decimals;
        const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
    };

    // --- UI Injection ---
    function injectUI() {
        // A separate file input is needed for this module
        fileInput = document.createElement('input');
        fileInput.type = 'file';
        fileInput.accept = '.glb';
        fileInput.style.display = 'none';
        document.body.appendChild(fileInput);

        // A separate modal is also needed to avoid conflicts
        loadingModal = document.createElement('div');
        loadingModal.className = 'tf-modal-overlay'; // Reusing styles from model.js
        loadingModal.innerHTML = `
            <div class="tf-loading-modal">
                <div class="title">Loading Asset</div>
                <div class="progress-bar"><div class="progress-fill"></div></div>
                <div class="status-text">Waiting for file...</div>
                <button class="complete-btn">Complete</button>
            </div>
        `;
        document.body.appendChild(loadingModal);
    }
    
    // --- Modal Control ---
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

    // --- Asset Loading Logic ---
    function loadFromFile(file) {
        const { GLTFLoader } = window.Phonebook;
        const reader = new FileReader();
        
        reader.onload = (e) => {
            updateModalProgress(25, 'Parsing file...');
            const loader = new GLTFLoader();
            loader.parse(e.target.result, '', (gltf) => {
                // On Success
                updateModalProgress(90, 'Processing scene...');
                const asset = gltf.scene;
                let vertexCount = 0;
                let triangleCount = 0;

                asset.traverse(obj => {
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
                
                window.Viewer.add(asset);
                updateModalProgress(100, 'Asset loaded successfully!');
                showCompleteButton();
                
                const assetData = {
                    id: `asset-${Date.now()}`,
                    name: file.name,
                    fileType: 'GLB',
                    vertices: vertexCount,
                    polygons: Math.floor(triangleCount),
                    fileSize: formatBytes(file.size),
                    object: asset
                };
                
                // Notify other modules that an asset has been added
                App.emit('asset:loaded', assetData);

            }, (error) => {
                // On Error
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

    // --- Bootstrap and Public API ---
    function bootstrap() {
        if (window.AssetManager) return;

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

        window.AssetManager = {
            load: () => fileInput.click(),
        };

        window.Debug?.log('Asset Manager ready.');
    }

    if (window.App?.glVersion) {
        bootstrap();
    } else {
        window.App?.on('app:booted', bootstrap);
    }
})();
