// src/js/removerig.js - A tool to remove the skeleton from a model.
(function () {
    'use strict';

    // --- Module State ---
    let mainModel = null;

    // UI Elements
    let modal, removeBtn, completeBtn, progressBar, progressFill, statusText;
    
    // 3D Preview Elements
    let previewRenderer, previewScene, previewCamera, previewClone, previewSkeletonHelper, previewRafId;

    // --- UI Injection ---
    function injectUI() {
        const style = document.createElement('style');
        style.textContent = `
            .tf-removerig-modal-overlay {
                position: fixed; inset: 0; background: rgba(0,0,0,0.7);
                backdrop-filter: blur(5px); -webkit-backdrop-filter: blur(5px);
                z-index: 1000; display: flex; align-items: center; justify-content: center;
                opacity: 0; pointer-events: none; transition: opacity 0.3s ease;
            }
            .tf-removerig-modal-overlay.show { opacity: 1; pointer-events: auto; }
            .tf-removerig-modal-content {
                width: min(450px, 90vw); padding: 25px;
                background: rgba(28, 32, 38, 0.95); border-radius: 12px;
                border: 1px solid rgba(255,255,255,0.1);
                box-shadow: 0 8px 30px rgba(0,0,0,0.4);
                display: flex; flex-direction: column; gap: 20px;
                color: #e6eef6;
            }
            .tf-removerig-modal-content .title {
                font-size: 18px; font-weight: 600; text-align: center;
                padding-bottom: 15px; border-bottom: 1px solid rgba(255,255,255,0.1);
            }
            #tf-removerig-preview {
                width: 100%; height: 250px; border-radius: 8px;
                background: #111418; border: 1px solid rgba(255,255,255,0.1);
                overflow: hidden;
            }
            .tf-removerig-progress-area {
                display: none;
                flex-direction: column; gap: 10px;
            }
            .tf-removerig-progress-bar {
                width: 100%; height: 10px; background: rgba(255,255,255,0.1);
                border-radius: 5px; overflow: hidden;
            }
            .tf-removerig-progress-fill {
                width: 0%; height: 100%;
                background: linear-gradient(90deg, #6a11cb 0%, #2575fc 100%);
                transition: width 0.3s ease-out;
            }
            .tf-removerig-status-text { text-align: center; color: #a0a7b0; font-size: 14px; }
            .tf-removerig-modal-content button {
                padding: 12px; font-size: 15px; font-weight: 600;
                border: none; border-radius: 8px; cursor: pointer; color: #fff;
            }
            #tf-removerig-btn { background: linear-gradient(90deg, #c62828, #ff3b30); }
            #tf-removerig-complete-btn { background: #00c853; display: none; }
        `;
        document.head.appendChild(style);

        modal = document.createElement('div');
        modal.className = 'tf-removerig-modal-overlay';
        modal.innerHTML = `
            <div class="tf-removerig-modal-content">
                <div class="title">Remove Rig from Model</div>
                <div id="tf-removerig-preview"></div>
                <div class="tf-removerig-progress-area">
                    <div class="tf-removerig-progress-bar">
                        <div class="tf-removerig-progress-fill"></div>
                    </div>
                    <div class="tf-removerig-status-text">Starting...</div>
                </div>
                <button id="tf-removerig-btn">Remove Rig & T-Pose</button>
                <button id="tf-removerig-complete-btn">Complete</button>
            </div>
        `;
        document.body.appendChild(modal);

        removeBtn = document.getElementById('tf-removerig-btn');
        completeBtn = document.getElementById('tf-removerig-complete-btn');
        progressBar = modal.querySelector('.tf-removerig-progress-area');
        progressFill = modal.querySelector('.tf-removerig-progress-fill');
        statusText = modal.querySelector('.tf-removerig-status-text');
    }
    
    function initPreview() {
        const container = document.getElementById('tf-removerig-preview');
        if (!container || previewRenderer) return;
        const { THREE } = window.Phonebook;
        previewScene = new THREE.Scene();
        previewScene.background = new THREE.Color('#111418');
        previewCamera = new THREE.PerspectiveCamera(50, container.clientWidth / container.clientHeight, 0.1, 100);
        previewScene.add(new THREE.HemisphereLight(0xffffff, 0x8d8d8d, 2.0));
        previewScene.add(new THREE.AmbientLight(0x404040, 1.0));
        previewRenderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
        previewRenderer.setPixelRatio(window.devicePixelRatio);
        previewRenderer.setSize(container.clientWidth, container.clientHeight);
        container.appendChild(previewRenderer.domElement);
    }
    
    function startPreviewAnimation() {
        if (previewRafId) cancelAnimationFrame(previewRafId);
        const animate = () => {
            if (previewClone) previewClone.rotation.y += 0.005;
            previewRenderer.render(previewScene, previewCamera);
            previewRafId = requestAnimationFrame(animate);
        };
        animate();
    }

    function stopPreviewAnimation() {
        if (previewRafId) cancelAnimationFrame(previewRafId);
        previewRafId = null;
    }

    function updatePreview() {
        if (!mainModel) return;
        const { THREE } = window.Phonebook;
        if (previewClone) {
            previewScene.remove(previewClone, previewSkeletonHelper);
            previewSkeletonHelper?.dispose();
        }
        previewClone = mainModel.object.clone();
        const box = new THREE.Box3().setFromObject(previewClone);
        const size = box.getSize(new THREE.Vector3());
        const center = box.getCenter(new THREE.Vector3());
        previewClone.position.sub(center);
        const maxDim = Math.max(size.x, size.y, size.z);
        const fov = previewCamera.fov * (Math.PI / 180);
        const cameraZ = Math.abs(maxDim / 1.5 / Math.tan(fov / 2));
        previewCamera.position.set(0, 0, cameraZ);
        previewCamera.lookAt(0, 0, 0);
        previewScene.add(previewClone);
        previewSkeletonHelper = new THREE.SkeletonHelper(previewClone);
        previewScene.add(previewSkeletonHelper);
        startPreviewAnimation();
    }

    function showModal(visible) {
        modal.classList.toggle('show', visible);
        if (visible) {
            if (!mainModel) {
                alert("No main model loaded. Please load a model first.");
                return showModal(false);
            }
            initPreview();
            updatePreview();
            progressBar.style.display = 'none';
            removeBtn.style.display = 'block';
            completeBtn.style.display = 'none';
        } else {
            stopPreviewAnimation();
        }
    }

    function updateProgress(percent, status) {
        progressFill.style.width = `${percent}%`;
        statusText.textContent = status;
    }
    
    function startConversion() {
        progressBar.style.display = 'flex';
        removeBtn.style.display = 'none';
        
        setTimeout(() => {
            updateProgress(50, 'Converting to static T-pose model...');
            
            // --- FIX: Use the proven T-pose conversion logic ---
            const { THREE } = window.Phonebook;
            const riglessModel = new THREE.Group();
            
            mainModel.object.traverse(child => {
                if (child.isSkinnedMesh) {
                    // Create a new non-skinned mesh using the same geometry and material.
                    // This effectively detaches it from the skeleton, leaving it in the bind pose (T-pose).
                    const staticMesh = new THREE.Mesh(child.geometry, child.material);
                    staticMesh.name = child.name;
                    riglessModel.add(staticMesh);
                } else if (child.isMesh) {
                    // Also clone non-skinned meshes to include them.
                    riglessModel.add(child.clone());
                }
            });

            // Preserve the original model's overall position, rotation, and scale.
            riglessModel.applyMatrix4(mainModel.object.matrixWorld);
            riglessModel.name = `${mainModel.name} (Static)`;
            // --- End Fix ---

            setTimeout(() => {
                updateProgress(75, 'Cleaning up old model...');
                window.Viewer.remove(mainModel.object);
                
                setTimeout(() => {
                    updateProgress(100, 'Process complete!');
                    const newModelData = { ...mainModel, id: `model-${Date.now()}`, name: riglessModel.name, object: riglessModel };
                    App.emit('asset:cleaned', { id: mainModel.id });
                    App.emit('asset:loaded', newModelData);
                    completeBtn.style.display = 'block';
                }, 500);
            }, 500);
        }, 300);
    }
    
    function bootstrap() {
        if (window.RigRemover) return;
        injectUI();
        App.on('asset:loaded', e => { if(e.detail?.isMainModel) mainModel = e.detail; });
        App.on('asset:cleaned', e => { if(mainModel && mainModel.id === e.detail.id) mainModel = null; });
        removeBtn.addEventListener('click', startConversion);
        completeBtn.addEventListener('click', () => showModal(false));
        modal.addEventListener('click', e => { if (e.target === modal) showModal(false); });

        window.RigRemover = { show: () => showModal(true) };
        window.Debug?.log('Rig Remover Module ready.');
    }

    if (window.App?.glVersion) bootstrap();
    else window.App?.on('app:booted', bootstrap);

})();
