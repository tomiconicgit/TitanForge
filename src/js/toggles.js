// src/js/toggles.js - UI for rig, hide, and other viewer toggles.

(function () {
    'use strict';

    let container, button, panel;

    function injectUI() {
        const style = document.createElement('style');
        style.textContent = `
            #tf-toggles-container {
                position: fixed;
                /* --- FINAL POSITIONING --- */
                bottom: 374px;
                left: 16px;
                z-index: 20;
            }
            /* Style this button like the menu button */
            #tf-toggles-button {
                font-size: 14px;
                padding: 5px 21px;
                font-weight: 600;
                border-radius: 20px;
                border: none;
                background: linear-gradient(90deg, #6a11cb 0%, #2575fc 100%);
                color: #fff;
                cursor: pointer;
                box-shadow: 0 4px 15px rgba(0, 0, 0, 0.3);
                transition: all 0.2s ease;
            }
            #tf-toggles-button:hover {
                transform: translateY(-1px);
                box-shadow: 0 6px 20px rgba(0, 0, 0, 0.3);
            }
            /* The floating panel */
            .tf-toggles-panel {
                position: absolute;
                bottom: calc(100% + 8px); /* Position above the button */
                left: 0;
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
                gap: 12px; /* Space between toggle rows */
                opacity: 0;
                transform: translateY(10px); /* Start lower for slide-up effect */
                pointer-events: none;
                transition: opacity 0.2s ease, transform 0.2s ease;
            }
            .tf-toggles-panel.show {
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
                font-size: 14px;
                cursor: pointer;
            }
            /* Generic switch styles, now owned by this module */
            .tf-switch {
                position: relative;
                display: inline-block;
                width: 30px;
                height: 16px;
                flex-shrink: 0;
            }
            .tf-switch input { display: none; }
            .tf-slider {
                position: absolute;
                cursor: pointer;
                inset: 0;
                background-color: rgba(255,255,255,0.2);
                transition: .4s;
                border-radius: 16px;
            }
            .tf-slider:before {
                position: absolute;
                content: "";
                height: 12px;
                width: 12px;
                left: 2px;
                bottom: 2px;
                background-color: white;
                transition: .4s;
                border-radius: 50%;
            }
            input:checked + .tf-slider {
                background-color: #00c853;
            }
            input:checked + .tf-slider:before {
                transform: translateX(14px);
            }
        `;
        document.head.appendChild(style);

        container = document.createElement('div');
        container.id = 'tf-toggles-container';
        container.innerHTML = `
            <button id="tf-toggles-button">Toggles</button>
            <div class="tf-toggles-panel">
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
            </div>
        `;
        document.getElementById('app')?.appendChild(container);

        button = document.getElementById('tf-toggles-button');
        panel = container.querySelector('.tf-toggles-panel');
    }

    function togglePanel(show) {
        panel.classList.toggle('show', show);
    }

    function wireEvents() {
        button.addEventListener('click', (event) => {
            event.stopPropagation();
            togglePanel(!panel.classList.contains('show'));
        });

        // Close panel on outside click
        window.addEventListener('click', () => {
            if (panel.classList.contains('show')) {
                togglePanel(false);
            }
        });

        // Wire up the actual toggles to their logic modules
        const rigCheckbox = document.getElementById('rig-toggle-checkbox');
        const hideCheckbox = document.getElementById('hide-toggle-checkbox');

        rigCheckbox.addEventListener('change', (event) => {
            window.Rig?.setVisible(event.target.checked);
        });

        hideCheckbox.addEventListener('change', (event) => {
            window.Hide?.setVisible(event.target.checked);
        });
    }

    function bootstrap() {
        if (window.Toggles) return;
        injectUI();
        wireEvents();
        window.Toggles = {};
        window.Debug?.log('Toggles UI ready.');
    }

    if (window.App?.glVersion) {
        bootstrap();
    } else {
        window.App?.on('app:booted', bootstrap);
    }
})();
