// src/js/skinning.js - Applies automatic skin weights to an asset.
(function () {
    'use strict';

    // --- Module State ---
    let mainModel = null;
    let skinningModal, statusText, confirmBtn, cancelBtn;
    let activeAssetForSkinning = null;

    // --- UI Injection ---
    function injectUI() {
        skinningModal = document.createElement('div');
        skinningModal.className = 'tf-modal-overlay';
        skinningModal.innerHTML = `
            <div class="tf-loading-modal" style="gap: 20px;"> <div class="title">Apply Automatic Skinning</div>
                <div id="tf-skinning-status" class="status-text">
                    This will convert the meshes in the asset to be deformed by the main model's skeleton.
                    <br/><br/>
                    <strong>Important:</strong> Use the Transform controls to position the asset correctly over the main model's body *before* applying.
                </div>
                <div class="progress-bar" style="display: none;"><div class="progress-fill"></div></div>
                <div class="tf-skinning-actions" style="display: flex; gap: 10px; margin-top: 10px;">
                    <button id="tf-skinning-cancel" style="flex:1; padding: 10px; border-radius: 8px; border: none; background: #555; color: #fff; cursor: pointer; font-weight: 600;">Cancel</button>
                    <button id="tf-skinning-confirm" style="flex:1; padding: 10px; border-radius: 8px; border: none; background: #2575fc; color: #fff; cursor: pointer; font-weight: 600;">Confirm & Apply</button>
                </div>
            </div>
        `;
        document.body.appendChild(skinningModal);

        statusText = skinningModal.querySelector('#tf-skinning-status');
        confirmBtn = skinningModal.querySelector('#tf-skinning-confirm');
        cancelBtn = skinningModal.querySelector('#tf-skinning-cancel');

        confirmBtn.addEventListener('click', runSkinningProcess);
        cancelBtn.addEventListener('click', () => setModalVisible(false));
    }

    function setModalVisible(visible) {
        skinningModal.classList.toggle('show', visible);
        if (visible) {
            // Reset modal state
            statusText.innerHTML = `This will convert the meshes in the asset to be deformed by the main model's skeleton.<br/><br/><strong>Important:</strong> Use the Transform controls to position the asset correctly over the main model's body *before* applying.`;
            skinningModal.querySelector('.progress-bar').style.display = 'none';
            confirmBtn.style.display = 'inline-block';
            confirmBtn.disabled = false;
            cancelBtn.textContent = 'Cancel';
        }
    }
    
    const updateProgress = (percent, status) => {
        const bar = skinningModal.querySelector('.progress-bar');
        const fill = bar.querySelector('.progress-fill');
        bar.style.display = 'block';
        fill.style.width = `${percent}%`;
        statusText.textContent = status;
    };

    /**
     * The core skinning algorithm. Iterates through vertices of a target object,
     * finds the closest bones from a skeleton, calculates weights, and converts
     * the geometry to be compatible with a SkinnedMesh.
     * @param {THREE.Object3D} targetObject - The clothing/asset to skin.
     * @param {THREE.Skeleton} skeleton - The skeleton from the main model.
     * @param {function} onProgress - Callback for progress updates.
     */
    async function applyAutomaticSkinning(targetObject, skeleton, onProgress) {
        const { THREE } = window.Phonebook;
        const meshesToSkin = [];
        targetObject.traverse(child => { if (child.isMesh) meshesToSkin.push(child); });

        const bones = skeleton.bones;
        const bonePositions = bones.map(bone => bone.getWorldPosition(new THREE.Vector3()));
        const maxInfluences = 4; // Standard for most real-time engines

        for (const sourceMesh of meshesToSkin) {
            await onProgress(0, `Processing mesh: ${sourceMesh.name || 'Unnamed Mesh'}`);
            
            sourceMesh.updateWorldMatrix(true, false); // Ensure matrixWorld is current

            const geometry = sourceMesh.geometry.clone(); // Work on a clone to be safe
            const position = geometry.attributes.position;
            const vertexCount = position.count;

            const skinIndex = new THREE.BufferAttribute(new Uint16Array(vertexCount * maxInfluences), maxInfluences);
            const skinWeight = new THREE.BufferAttribute(new Float32Array(vertexCount * maxInfluences), maxInfluences);

            const vertex = new THREE.Vector3();

            for (let i = 0; i < vertexCount; i++) {
                vertex.fromBufferAttribute(position, i);
                vertex.applyMatrix4(sourceMesh.matrixWorld); // Bring vertex to world space

                const boneDistances = [];
                for (let j = 0; j < bones.length; j++) {
                    boneDistances.push({
                        index: j,
                        distance: vertex.distanceTo(bonePositions[j])
                    });
                }

                boneDistances.sort((a, b) => a.distance - b.distance);
                
                let totalWeight = 0;
                const influences = [];
                for(let k = 0; k < maxInfluences; k++) {
                    const boneInfo = boneDistances[k];
                    const weight = 1.0 / (boneInfo.distance + 0.0001); // Inverse distance weighting
                    influences.push({ index: boneInfo.index, weight });
                    totalWeight += weight;
                }

                // Normalize weights so they sum to 1.0
                for (let k = 0; k < maxInfluences; k++) {
                    const influence = influences[k];
                    skinIndex.setX(i, influence ? influence.index : 0);
                    skinWeight.setX(i, influence ? influence.weight / totalWeight : 0);
                }

                if (i % 750 === 0) { // Yield to main thread to prevent freezing
                    const percent = (i / vertexCount) * 100;
                    await new Promise(resolve => setTimeout(resolve, 0));
                    await onProgress(percent, `Processing vertex ${i.toLocaleString()} / ${vertexCount.toLocaleString()}`);
                }
            }

            geometry.setAttribute('skinIndex', skinIndex);
            geometry.setAttribute('skinWeight', skinWeight);

            // Replace the original mesh with a new SkinnedMesh
            const newSkinnedMesh = new THREE.SkinnedMesh(geometry, sourceMesh.material);
            newSkinnedMesh.bind(skeleton);
            
            // The new SkinnedMesh should not be parented to a single bone.
            // We move it to the scene root, preserving its world transform.
            window.Viewer.scene.attach(newSkinnedMesh);
            
            // Remove the original static mesh from its parent
            sourceMesh.parent.remove(sourceMesh);
        }
    }

    async function runSkinningProcess() {
        if (!activeAssetForSkinning || !mainModel) return;

        confirmBtn.disabled = true;
        cancelBtn.textContent = 'Working...';
        
        try {
            const bones = [];
            mainModel.object.traverse(node => { if (node.isBone) bones.push(node); });
            if (bones.length === 0) throw new Error("Main model has no bones in its skeleton.");
            
            const skeleton = new window.Phonebook.THREE.Skeleton(bones);
            
            await applyAutomaticSkinning(activeAssetForSkinning.object, skeleton, updateProgress);
            
            await updateProgress(100, 'Skinning complete!');
            App.emit('asset:updated', { id: activeAssetForSkinning.id });
            
            // Detach the original object group if it's now empty, then clean it
            const originalObject = activeAssetForSkinning.object;
            if(originalObject.children.length === 0) {
                 window.Cleaner.clean(activeAssetForSkinning);
            }
            
        } catch (error) {
            console.error("Skinning failed:", error);
            await updateProgress(100, `Error: ${error.message}`);
            skinningModal.querySelector('.progress-fill').style.background = '#ff3b30';
        } finally {
            cancelBtn.textContent = 'Close';
            confirmBtn.style.display = 'none';
            activeAssetForSkinning = null;
        }
    }

    function bootstrap() {
        if (window.Skinning) return;
        injectUI();
        
        App.on('asset:loaded', e => { if (e.detail?.isMainModel) mainModel = e.detail; });
        App.on('asset:cleaned', e => { if (mainModel && mainModel.id === e.detail.id) mainModel = null; });
        
        window.Skinning = {
            open: (asset) => {
                if (!mainModel) {
                    alert("A main model with a rig must be loaded first.");
                    return;
                }
                if (!asset || asset.isMainModel) {
                    alert("Cannot skin the main model or a non-existent asset.");
                    return;
                }
                activeAssetForSkinning = asset;
                setModalVisible(true);
            }
        };
        
        window.Debug?.log('Skinning Module ready.');
    }

    if (window.App?.glVersion) bootstrap();
    else window.App?.on('app:booted', bootstrap);

})();
