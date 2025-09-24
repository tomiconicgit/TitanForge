    async function applyAutomaticSkinning(targetObject, skeleton, onProgress) {
        const { THREE } = window.Phonebook;
        const meshesToSkin = [];
        targetObject.traverse(child => { if (child.isMesh) meshesToSkin.push(child); });

        const bones = skeleton.bones;
        // Ensure the skeleton is in its bind pose before getting bone positions
        skeleton.pose(); 
        const bonePositions = bones.map(bone => bone.getWorldPosition(new THREE.Vector3()));
        const maxInfluences = 4;

        const meshesToRemove = [];

        for (const sourceMesh of meshesToSkin) {
            await onProgress(0, `Processing mesh: ${sourceMesh.name || 'Unnamed Mesh'}`);
            
            sourceMesh.updateWorldMatrix(true, false);

            const geometry = sourceMesh.geometry.clone();
            const position = geometry.attributes.position;
            const vertexCount = position.count;

            const skinIndex = new THREE.BufferAttribute(new Uint16Array(vertexCount * maxInfluences), maxInfluences);
            const skinWeight = new THREE.BufferAttribute(new Float32Array(vertexCount * maxInfluences), maxInfluences);

            const vertex = new THREE.Vector3();

            for (let i = 0; i < vertexCount; i++) {
                vertex.fromBufferAttribute(position, i);
                vertex.applyMatrix4(sourceMesh.matrixWorld);

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
                    if (!boneInfo) continue;
                    const weight = 1.0 / (boneInfo.distance ** 2 + 0.0001);
                    influences.push({ index: boneInfo.index, weight });
                    totalWeight += weight;
                }

                if (totalWeight > 0) {
                    for (let k = 0; k < maxInfluences; k++) {
                        const influence = influences[k];
                        skinIndex.setX(i * maxInfluences + k, influence ? influence.index : 0);
                        skinWeight.setX(i * maxInfluences + k, influence ? influence.weight / totalWeight : 0);
                    }
                }

                if (i > 0 && i % 750 === 0) {
                    const percent = (i / vertexCount) * 100;
                    await new Promise(resolve => setTimeout(resolve, 0));
                    await onProgress(percent, `Processing vertex ${i.toLocaleString()} / ${vertexCount.toLocaleString()}`);
                }
            }

            geometry.setAttribute('skinIndex', skinIndex);
            geometry.setAttribute('skinWeight', skinWeight);
            
            const newSkinnedMesh = new THREE.SkinnedMesh(geometry, sourceMesh.material);
            newSkinnedMesh.name = sourceMesh.name;

            // THIS IS THE KEY FIX FOR POSITIONING:
            // Decompose the original mesh's world matrix into the new mesh's local transform.
            sourceMesh.matrixWorld.decompose(newSkinnedMesh.position, newSkinnedMesh.quaternion, newSkinnedMesh.scale);
            
            window.Viewer.scene.add(newSkinnedMesh);
            newSkinnedMesh.bind(skeleton);
            
            // Mark the old mesh for removal
            meshesToRemove.push(sourceMesh);
        }
        
        // Clean up old meshes outside the loop
        meshesToRemove.forEach(mesh => {
            if (mesh.parent) {
                mesh.parent.remove(mesh);
            }
        });
    }
