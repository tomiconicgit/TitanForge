// src/js/animation.js - Handles loading and controlling animations for the main model.
(function () {
    'use strict';

    // --- Module State ---
    let mainModel = null;
    let clock, mixer, action;
    let rafId = null; // To control the animation update loop

    // UI Elements
    let modal, panel, fileInput;
    let loadAnimationBtn, showPanelBtn;
    let closePanelBtn, clearAnimationBtn;
    let playToggle, scrubContainer, scrubForwardBtn, scrubBackwardBtn;

    // --- UI Injection ---
    function injectUI() {
        const style = document.createElement('style');
        style.textContent = `
            /* --- Self-Contained Modal Styles --- */
            .tf-anim-modal-overlay {
                position: fixed; inset: 0; background: rgba(0,0,0,0.7);
                backdrop-filter: blur(5px); -webkit-backdrop-filter: blur(5px);
                z-index: 1000; display: flex; align-items: center; justify-content: center;
                opacity: 0; pointer-events: none; transition: opacity 0.3s ease;
            }
            .tf-anim-modal-overlay.show { opacity: 1; pointer-events: auto; }

            .tf-anim-modal-content {
                display: flex; flex-direction: column; gap: 15px;
                width: min(300px, 80vw); padding: 25px;
                background: rgba(28, 32, 38, 0.9); border-radius: 12px;
                border: 1px solid rgba(255,255,255,0.1);
            }
            .tf-anim-modal-content button {
                width: 100%; padding: 10px 12px; font-size: 15px; font-weight: 600;
                border: none; border-radius: 5px; color: #e6eef6; cursor: pointer;
                background-color: rgba(255, 255, 255, 0.1);
                transition: background-color 0.2s ease;
            }
            .tf-anim-modal-content button:hover { background-color: rgba(255, 255, 255, 0.15); }
            .tf-anim-modal-content button:disabled {
                color: #777; cursor: not-allowed; background-color: rgba(255, 255, 255, 0.05);
            }

            /* --- Self-Contained Floating Panel Styles (like toggles.js) --- */
            #tf-animation-panel {
                position: fixed;
                bottom: 383px;
                left: 16px;
                z-index: 25;
                min-width: 220px;
                background: rgba(28, 32, 38, 0.9);
                backdrop-filter: blur(10px); -webkit-backdrop-filter: blur(10px);
                border-radius: 8px;
                border: 1px solid rgba(255, 255, 255, 0.1);
                box-shadow: 0 8px 25px rgba(0, 0, 0, 0.4);
                display: none; /* Hidden by default */
                flex-direction: column;
                opacity: 0;
                transform: translateY(10px);
                pointer-events: none;
                transition: opacity 0.2s ease, transform 0.2s ease;
            }
            #tf-animation-panel.show {
                display: flex;
                opacity: 1;
                transform: translateY(0);
                pointer-events: auto;
            }
            #tf-animation-panel .panel-header {
                display: flex; justify-content: space-between; align-items: center;
                padding: 8px 12px;
                border-bottom: 1px solid rgba(255,255,255,0.1);
                font-size: 14px; font-weight: 600;
            }
            #tf-animation-panel .panel-header .close-btn {
                background: none; border: none; color: #a0a7b0;
                font-size: 20px; cursor: pointer; padding: 0 5px;
            }
            #tf-animation-panel .panel-content {
                padding: 12px; display: flex; flex-direction: column; gap: 15px;
            }
            .tf-anim-scrub-controls {
                display: none; /* Hidden when playing */
                gap: 10px;
            }
            .tf-anim-scrub-controls.show {
                display: flex;
            }
            .tf-anim-scrub-controls button {
                flex: 1; background: rgba(255,255,255,0.1); border: none;
                color: #fff; padding: 8px; border-radius: 5px; cursor: pointer;
            }
            #tf-anim-clear-btn {
                 background: #c62828; border: none; color: #fff;
                 padding: 8px; border-radius: 5px; cursor: pointer; font-weight: 600;
            }

            /* --- Self-Contained Toggle Switch Styles --- */
            .tf-toggle-row {
                display: flex; align-items: center; justify-content: space-between;
                color: #e6eef6; font-size: 15px;
            }
            .tf-switch {
                position: relative; display: inline-block;
                width: 30px; height: 16px; flex-shrink: 0;
            }
            .tf-switch input { display: none; }
            .tf-slider {
                position: absolute; cursor: pointer; inset: 0;
                background-color: rgba(255,255,255,0.2);
                transition: .4s; border-radius: 16px;
            }
            .tf-slider:before {
                position: absolute; content: "";
                height: 12px; width: 12px;
                left: 2px; bottom: 2px;
                background-color: white;
                transition: .4s; border-radius: 50%;
            }
            input:checked + .tf-slider { background-color: #00c853; }
            input:checked + .tf-slider:before { transform: translateX(14px); }
        `;
        document.head.appendChild(style);

        // 1. Initial Modal (triggered from menu)
        modal = document.createElement('div');
        modal.className = 'tf-anim-modal-overlay';
        modal.innerHTML = `
            <div class="tf-anim-modal-content">
                <button id="tf-anim-load-btn">Load Animation</button>
                <button id="tf-anim-show-panel-btn" disabled>Show Control Panel</button>
            </div>
        `;
        document.body.appendChild(modal);

        // 2. Floating Control Panel
        panel = document.createElement('div');
        panel.id = 'tf-animation-panel';
        panel.innerHTML = `
            <div class="panel-header">
                <span>Animation Controls</span>
                <button class="close-btn" title="Close Panel">&times;</button>
            </div>
            <div class="panel-content">
                <div class="tf-toggle-row">
                    <label for="anim-play-checkbox">Play Animation</label>
                    <label class="tf-switch">
                        <input type="checkbox" id="anim-play-checkbox">
                        <span class="tf-slider"></span>
                    </label>
                </div>
                <div class="tf-anim-scrub-controls">
                    <button id="tf-anim-scrub-bwd" title="Move back 0.5s">&laquo; 0.5s</button>
                    <button id="tf-anim-scrub-fwd" title="Move forward 0.5s">0.5s &raquo;</button>
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
        loadAnimationBtn = document.getElementById('tf-anim-load-btn');
        showPanelBtn = document.getElementById('tf-anim-show-panel-btn');
        closePanelBtn = panel.querySelector('.close-btn');
        clearAnimationBtn = document.getElementById('tf-anim-clear-btn');
        playToggle = document.getElementById('anim-play-checkbox');
        scrubContainer = panel.querySelector('.tf-anim-scrub-controls');
        scrubForwardBtn = document.getElementById('tf-anim-scrub-fwd');
        scrubBackwardBtn = document.getElementById('tf-anim-scrub-bwd');
    }

    // --- UI Control ---
    function showModal(visible) { modal.classList.toggle('show', visible); }
    function showPanel(visible) { panel.classList.toggle('show', visible); }

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
        if (!mixer) return;
        
        mixer.stopAllAction();
        mixer.uncacheRoot(mixer.getRoot()); // Clean up memory
        mixer = null;
        action = null;

        stopAnimationLoop();
        showPanel(false);
        showPanelBtn.disabled = true;

        window.Debug?.log('Animation cleared.');
    }

    function loadAnimation(file) {
        if (!mainModel) {
            alert('A main model must be loaded before adding an animation.');
            return;
        }
        
        clearAnimation(); // Clear any existing animation first

        const { GLTFLoader, THREE } = window.Phonebook;
        const reader = new FileReader();
        
        reader.onload = (e) => {
            new GLTFLoader().parse(e.target.result, '', (gltf) => {
                const animClip = gltf.animations[0];
                if (!animClip) {
                    alert('Error: No animation found in the provided GLB file.');
                    return;
                }

                mixer = new THREE.AnimationMixer(mainModel.object);
                action = mixer.clipAction(animClip);
                action.setLoop(THREE.LoopRepeat).play();
                
                startAnimationLoop();

                // Update UI
                playToggle.checked = true;
                scrubContainer.classList.remove('show');
                showPanelBtn.disabled = false;
                showPanel(true);
                window.Debug?.log(`Loaded animation: ${animClip.name}`);

            }, (error) => {
                console.error('Animation GLTF Parse Error:', error);
                alert('Could not parse the animation file.');
            });
        };
        reader.readAsArrayBuffer(file);
    }
    
    function scrubTime(deltaTime) {
        if (!action || !mixer || !action.paused) return;
        const newTime = Math.max(0, action.time + deltaTime);
        action.time = newTime % action.getClip().duration;
        mixer.update(0); // Update pose without advancing time
    }

    // --- Bootstrap & Event Wiring ---
    function bootstrap() {
        if (window.Animation) return;
        
        injectUI();

        // Listen for main model loading/unloading
        App.on('asset:loaded', e => { if(e.detail?.isMainModel) mainModel = e.detail; });
        App.on('asset:cleaned', e => {
            if(mainModel && mainModel.id === e.detail.id) {
                mainModel = null;
                clearAnimation();
            }
        });
        
        // --- Modal Events ---
        loadAnimationBtn.addEventListener('click', () => {
            showModal(false);
            fileInput.click();
        });
        showPanelBtn.addEventListener('click', () => {
            showModal(false);
            showPanel(true);
        });
        modal.addEventListener('click', e => {
            if (e.target === modal) showModal(false); // Close on backdrop click
        });
        fileInput.addEventListener('change', e => {
            const file = e.target.files[0];
            if (file) loadAnimation(file);
            fileInput.value = ''; // Reset for next time
        });

        // --- Panel Events ---
        closePanelBtn.addEventListener('click', () => showPanel(false));
        clearAnimationBtn.addEventListener('click', clearAnimation);
        playToggle.addEventListener('change', e => {
            if (!action) return;
            const isPlaying = e.target.checked;
            action.paused = !isPlaying;
            scrubContainer.classList.toggle('show', !isPlaying);
        });
        scrubForwardBtn.addEventListener('click', () => scrubTime(0.5));
        scrubBackwardBtn.addEventListener('click', () => scrubTime(-0.5));

        // Expose public API for the menu button
        window.Animation = {
            show: () => showModal(true)
        };
        
        window.Debug?.log('Animation Module ready.');
    }

    // Initialize module after the main app is ready
    if (window.App?.glVersion) bootstrap();
    else window.App?.on('app:booted', bootstrap);

})();
