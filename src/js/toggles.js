// src/js/toggles.js - UI for rig, hide, and other viewer toggles.

(function () {
    'use strict';

    let panel;

    function injectUI() {
        const style = document.createElement('style');
        style.textContent = `
            #tf-toggles-panel {
                position: fixed;
                bottom: 383px;
                left: 16px;
                z-index: 25;
                min-width: 180px;
                background: rgba(28, 32, 38, 0.9);
                backdrop-filter: blur(10px);
                -webkit-backdrop-filter: blur(10px);
                border-radius: 8px;
                border: 1px solid rgba(255, 255, 255, 0.1);
                box-shadow: 0 8px 25px rgba(0, 0, 0, 0.4);
                padding: 10px 12px;
                display: flex;
                flex-direction: column;
                gap: 12px;
                opacity: 0;
                transform: translateY(10px);
                pointer-events: none;
                transition: opacity 0.2s ease, transform 0.2s ease;
            }
            #tf-toggles-panel.show {
                opacity: 1;
                transform: translateY(0);
                pointer-events: auto;
            }
            .tf-toggle-row {
                display: flex;
                align-items: center;
                justify-content: space-between;
            }
            .tf-toggle-row label {
                color: #e6eef6;
                font-size: 15px;
                cursor: pointer;
                padding: 0;
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

        panel = document.createElement('div');
        panel.id = 'tf-toggles-panel';
        panel.innerHTML = `
            <div class="tf-toggle-row">
                <label for="rig-toggle-checkbox">Show Rig</label>
                <label class="tf-switch">
                    <input type="checkbox" id="rig-toggle-checkbox">
                    <span class="tf-slider"></span>
                </label>
            </div>
            <div class="tf-toggle-row">
                <label for="hide-toggle-checkbox">Hide Model</label>
                <label class="tf-switch">
                    <input type="checkbox" id="hide-toggle-checkbox">
                    <span class="tf-slider"></span>
                </label>
            </div>
        `;
        document.getElementById('app')?.appendChild(panel);
    }

    function togglePanel(show) { panel.classList.toggle('show', show); }

    function wireEvents() {
        // Prevent pointer events inside the panel from bubbling up to the window.
        panel.addEventListener('pointerdown', e => e.stopPropagation());
        
        // Close the panel if a pointer event occurs anywhere else.
        window.addEventListener('pointerdown', () => { 
            if (panel.classList.contains('show')) {
                togglePanel(false);
            }
        });

        // Checkbox logic remains the same.
        panel.querySelector('#rig-toggle-checkbox').addEventListener('change', e => window.Rig?.setVisible(e.target.checked));
        panel.querySelector('#hide-toggle-checkbox').addEventListener('change', e => window.Hide?.setVisible(e.target.checked));
    }

    function bootstrap() {
        if (window.Toggles) return;
        injectUI();
        wireEvents();
        window.Toggles = {
            show: () => togglePanel(true),
            hide: () => togglePanel(false),
            toggle: () => togglePanel(!panel.classList.contains('show')),
        };
        window.Debug?.log('Toggles Panel ready.');
    }

    if (window.App?.glVersion) bootstrap();
    else window.App?.on('app:booted', bootstrap);
})();
