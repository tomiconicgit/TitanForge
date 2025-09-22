// src/js/animation.js - Handles loading and controlling animations for the main model.
(function () {
    'use strict';

    // --- Module State ---
    let mainModel = null;
    let clock, mixer, action;

    let modal, panel, fileInput;
    let showPanelBtn, loadAnimBtn;
    let loopToggle, timeScrubContainer;

    let rafId = null; // To control the animation update loop

    // --- UI Injection ---
    function injectUI() {
        const style = document.createElement('style');
        style.textContent = `
            /* Floating Animation Control Panel - styled like toggles.js */
            #tf-animation-panel {
                position: fixed;
                bottom: 383px; /* Matches toggles.js */
                left: 16px;
                z-index: 24; /* Just below toggles panel */
                min-width: 220px;
                background: rgba(28, 32, 38, 0.9);
                backdrop-filter: blur(10px); -webkit-backdrop-filter: blur(10px);
                border-radius: 8px;
                border: 1px solid rgba(255, 255, 255, 0.1);
                box-shadow: 0 8px 25px rgba(0, 0, 0, 0.4);
                padding: 0; /* No padding on container */
                display: none; /* Hidden by default */
                flex-direction: column;
                opacity: 0;
                transform: translateY(10px);
                transition: opacity 0.2s ease, transform 0.2s ease;
            }
            #tf-animation-panel.show {
                display: flex;
                opacity: 1;
                transform: translateY(0);
            }
            #tf-animation-panel .panel-header {
                display: flex; justify-content: space-between; align-items: center;
                padding: 8px 12px;
                border-bottom: 1px solid rgba(255,255,255,0.1);
                font-size: 14px; font-weight: 600;
            }
            #tf-animation-panel .panel-header .minimize-btn {
                background: none; border: none; color: #a0a7b0;
                font-size: 20px; cursor: pointer; padding: 0 5px;
            }
            #tf-animation-panel .panel-content {
                padding: 12px; display: flex; flex-direction: column; gap: 15px;
            }
            .tf-anim-scrub-controls {
                display: flex; gap: 10px;
            }
            .tf-anim-scrub-controls button {
                flex: 1; background: rgba(255,255,255,0.1); border: none;
                color: #fff; padding: 8px; border-radius: 5px; cursor: pointer;
            }
            #tf-anim-clear-btn {
                 background: #c62828; border: none; color: #fff;
                 padding: 8px; border-radius: 5px; cursor: pointer; font-weight: 600;
            }
        `;
        document.head.appendChild(style);

        // 1. Initial Modal (triggered from menu)
        modal = document.createElement('div');
        modal.className = 'tf-modal-overlay';
        modal.innerHTML = `
            <div class="tf-load-modal-content">
                <button id="tf-anim-load-btn">Load Animation</button>
                <button id="tf-anim-show-panel-btn" disabled>Show Panel</button>
            </div>
        `;
        document.body.appendChild(modal);

        // 2. Floating Control Panel
        panel = document.createElement('div');
        panel.id = 'tf-animation-panel';
        panel.innerHTML = `
            <div class="panel-header">
                <span>Animation Controls</span>
                <button class="minimize-btn" title="Minimize">&minus;</button>
            </div>
            <div class="panel-content">
                <div class="tf-toggle-row">
                    <label for="anim-loop-checkbox">Loop Animation</label>
                    <label class="tf-switch">
                        <input type="checkbox" id="anim-loop-checkbox" checked>
                        <span class="tf-slider"></span>
                    </label>
                </div>
                <div class="tf-anim-scrub-controls" style="display:none;">
                    <button data-time="-0.5">&laquo; 0.5s</button>
                    <button data-time="0.5">0.5s &raquo;</button>
                </div>
                <button id="tf-anim-clear-btn">Clear Animation</button>
            </div>
        `;
        document.getElementById('app')?.appendChild(panel);

        // 3. Hidden File Input
        fileInput = document.createElement('input');
        fileInput.type = 'file';
        fileInput.accept = '.glb';
        fileInput.style.display = 'none';
        document.body.appendChild(fileInput);

        // --- Element References ---
        showPanelBtn = modal.querySelector('#tf-anim-show-panel-btn');
        loadAnimBtn = modal.querySelector('#tf-anim-load-btn');
        loopToggle = panel.querySelector('#anim-loop-checkbox');
        timeScrubContainer = panel.querySelector('.tf-anim-scrub-controls');
    }

    // --- Animation Core ---
    function animate() {
        if (mixer) {
            mixer.update(clock.getDelta());
        }
        rafId = requestAnimationFrame(animate);
    }

    function startAnimationLoop() {
        if (rafId === null) {
            clock = new window.Phonebook.THREE.Clock();
            animate();
        }
    }

    function stopAnimationLoop() {
        if (rafId !== null) {
            cancelAnimationFrame(rafId);
            rafId = null;
        }
    }
    
    function clearAnimation() {
        if (!action) return;
        action.stop();
        mixer = null;
        action = null;
        stopAnimationLoop();
        showPanel(false);
        showPanelBtn.disabled = true;
        // Restore model to its default pose (T-pose)
        if(mainModel) mainModel.object.pose();
    }

    function loadAnimation(file) {
        if (!mainModel) {
            alert('A main model must be loaded before loading an animation.');
            return;
        }
        
        clearAnimation(); // Clear any existing animation first

        const { GLTFLoader, THREE } = window.Phonebook;
        const reader = new FileReader();
        
        reader.onload = (e) => {
            new GLTFLoader().parse(e.target.result, '', (gltf) => {
                const animClip = gltf.animations[0];
                if (!animClip) {
                    alert('Error: No animation found in the provided file.');
                    return;
                }

                mixer = new THREE.AnimationMixer(mainModel.object);
                action = mixer.clipAction(animClip);
                action.setLoop(THREE.LoopRepeat).play();
                
                startAnimationLoop();
                showPanel(true);
                showPanelBtn.disabled = false;
                loopToggle.checked = true; // Default to looping
                timeScrubContainer.style.display = 'none';

            }, (error) => {
                console.error('Animation GLTF Parse Error:', error);
                alert('Could not load the animation file.');
            });
        };
        reader.readAsArrayBuffer(file);
    }
    
    // --- UI Control ---
    function showModal(visible) { modal.classList.toggle('show', visible); }
    function showPanel(visible) { panel.classList.toggle('show', visible); }
    
    function scrubTime(deltaTime) {
        if (action && action.paused) {
            const newTime = Math.max(0, action.time + deltaTime);
            action.time = newTime % action.getClip().duration;
            mixer.update(0); // Update pose without advancing time
        }
    }

    // --- Bootstrap & Event Wiring ---
    function bootstrap() {
        if (window.Animation) return;
        
        injectUI();

        // Listen for main model asset
        App.on('asset:loaded', e => { if(e.detail?.isMainModel) mainModel = e.detail; });
        App.on('asset:cleaned', e => {
            if(mainModel && mainModel.id === e.detail.id) {
                mainModel = null;
                clearAnimation();
            }
        });
        
        // Modal buttons
        loadAnimBtn.addEventListener('click', () => {
            showModal(false);
            fileInput.click();
        });
        showPanelBtn.addEventListener('click', () => {
            showModal(false);
            showPanel(true);
        });
        modal.addEventListener('click', e => { if(e.target === modal) showModal(false); });
        
        // File input
        fileInput.addEventListener('change', e => {
            const file = e.target.files[0];
            if (file) loadAnimation(file);
            fileInput.value = ''; // Reset
        });

        // Floating panel controls
        panel.querySelector('.minimize-btn').addEventListener('click', () => showPanel(false));
        panel.querySelector('#tf-anim-clear-btn').addEventListener('click', clearAnimation);
        
        loopToggle.addEventListener('change', e => {
            if (!action) return;
            const isPlaying = e.target.checked;
            action.paused = !isPlaying;
            timeScrubContainer.style.display = isPlaying ? 'none' : 'flex';
        });

        timeScrubContainer.addEventListener('click', e => {
            const time = e.target.dataset.time;
            if (time) scrubTime(parseFloat(time));
        });

        window.Animation = {
            show: () => showModal(true)
        };
        
        window.Debug?.log('Animation Module ready.');
    }

    if (window.App?.glVersion) bootstrap();
    else window.App?.on('app:booted', bootstrap);
})();
