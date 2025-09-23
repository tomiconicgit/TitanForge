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
                <button id="tf-removerig-btn">Remove Rig</button>
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
    
    // --- FIX: New robust model baking function ---
    function bakeModel(sourceObject) {
        const { THREE } = window.Phonebook;
        const bakedGroup = new THREE.Group();
        
        sourceObject.updateWorldMatrix(true, true);

        sourceObject.traverse(child => {
            if (child.isSkinnedMesh) {
                const newGeometry = new THREE.BufferGeometry();
                const pos = child.geometry.attributes.position;
                const normal = child.geometry.attributes.normal;
                const uv = child.geometry.attributes.uv;

                const finalPos = new Float32Array(pos.count * 3);
                const finalNormal = new Float32Array(normal.count * 3);
                
                const tempPos = new THREE.Vector3();
                const tempNormal = new THREE.Vector3();
                const skinMatrix = new THREE.Matrix4();

                for (let i = 0; i < pos.count; i++) {
                    child.getVertexPosition(i, tempPos);
                    tempPos.applyMatrix4(child.matrixWorld);
                    tempPos.toArray(finalPos, i * 3);

                    // Transform normals
                    const skinIndex = child.geometry.attributes.skinIndex;
                    const skinWeight = child.geometry.attributes.skinWeight;
                    const skeleton = child.skeleton;
                    
                    skinMatrix.fromElements(0,0,0,0, 0,0,0,0, 0,0,0,0, 0,0,0,0);
                    
                    for (let j = 0; j < 4; j++) {
                        const boneIndex = skinIndex.getComponent(i, j);
                        const weight = skinWeight.getComponent(i, j);
                        const bone = skeleton.bones[boneIndex];
                        if (bone && weight > 0) {
                           const boneMatrix = skeleton.boneMatrices[boneIndex];
                           const tempMatrix = new THREE.Matrix4().fromArray(boneMatrix);
                           skinMatrix.add(tempMatrix.multiplyScalar(weight));
                        }
                    }
                    tempNormal.fromBufferAttribute(normal, i).applyMatrix3(new THREE.NormalMatrix().getNormalMatrix(skinMatrix));
                    tempNormal.toArray(finalNormal, i * 3);
                }

                newGeometry.setAttribute('position', new THREE.BufferAttribute(finalPos, 3));
                newGeometry.setAttribute('normal', new THREE.BufferAttribute(finalNormal, 3));
                if (uv) {
                    newGeometry.setAttribute('uv', uv); // UVs don't change
                }
                newGeometry.setIndex(child.geometry.index);

                const newMesh = new THREE.Mesh(newGeometry, child.material);
                newMesh.name = child.name;
                bakedGroup.add(newMesh);
            } else if (child.isMesh && !child.isSkinnedMesh) {
                 // For regular meshes, just clone and apply world matrix
                const newMesh = child.clone();
                newMesh.applyMatrix4(child.matrixWorld);
                bakedGroup.add(newMesh);
            }
        });
        return bakedGroup;
    }

    function startConversion() {
        progressBar.style.display = 'flex';
        removeBtn.style.display = 'none';
        
        setTimeout(() => {
            updateProgress(50, 'Baking model geometry...');
            const riglessModel = bakeModel(mainModel.object);
            riglessModel.name = `${mainModel.name} (Rig Removed)`;
            
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
