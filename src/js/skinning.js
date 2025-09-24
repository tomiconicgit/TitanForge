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
                    // Using squared distance gives a nicer falloff
                    const weight = 1.0 / (boneInfo.distance ** 2 + 0.0001); 
                    influences.push({ index: boneInfo.index, weight });
                    totalWeight += weight;
                }

                if (totalWeight > 0) {
                    // THIS IS THE CORRECTED PART:
                    // We use setXYZW to write the four values for each vertex.
                    const normalized_influences = influences.map(inf => inf.weight / totalWeight);
                    
                    skinIndex.setX(i, influences[0] ? influences[0].index : 0);
                    skinWeight.setX(i, normalized_influences[0] ? normalized_influences[0] : 0);

                    skinIndex.setY(i, influences[1] ? influences[1].index : 0);
                    skinWeight.setY(i, normalized_influences[1] ? normalized_influences[1] : 0);

                    skinIndex.setZ(i, influences[2] ? influences[2].index : 0);
                    skinWeight.setZ(i, normalized_influences[2] ? normalized_influences[2] : 0);

                    skinIndex.setW(i, influences[3] ? influences[3].index : 0);
                    skinWeight.setW(i, normalized_influences[3] ? normalized_influences[3] : 0);
                }

                if (i > 0 && i % 750 === 0) {
                    const percent = Math.round((i / vertexCount) * 100);
                    await new Promise(resolve => setTimeout(resolve, 0));
                    await onProgress(percent, `Processing vertex ${i.toLocaleString()} / ${vertexCount.toLocaleString()}`);
                }
            }

            geometry.setAttribute('skinIndex', skinIndex);
            geometry.setAttribute('skinWeight', skinWeight);
            
            const newSkinnedMesh = new THREE.SkinnedMesh(geometry, sourceMesh.material);
            newSkinnedMesh.name = sourceMesh.name;

            sourceMesh.matrixWorld.decompose(newSkinnedMesh.position, newSkinnedMesh.quaternion, newSkinnedMesh.scale);
            
            window.Viewer.scene.add(newSkinnedMesh);
            newSkinnedMesh.bind(skeleton);

            meshesToRemove.push(sourceMesh);
        }
        
        meshesToRemove.forEach(mesh => {
            if (mesh.parent) {
                mesh.parent.remove(mesh);
            }
        });
    }

