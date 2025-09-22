// src/js/menu.js - Main dropdown menu for the viewer

(function () {
    'use strict';

    let menuContainer, menuButton, dropdown;
    const bus = new EventTarget();

    function injectUI() {
        const style = document.createElement('style');
        style.textContent = `
            #tf-menu-container {
                position: fixed;
                top: 16px;
                left: 16px;
                z-index: 20;
            }
            #tf-menu-button {
                padding: 10px 20px;
                font-size: 15px;
                font-weight: 600;
                border-radius: 20px;
                border: none;
                background: linear-gradient(90deg, #6a11cb 0%, #2575fc 100%);
                color: #fff;
                cursor: pointer;
                box-shadow: 0 4px 15px rgba(0, 0, 0, 0.3);
                transition: all 0.2s ease;
            }
            #tf-menu-button:hover {
                transform: translateY(-1px);
                box-shadow: 0 6px 20px rgba(0, 0, 0, 0.3);
            }
            .tf-menu-dropdown {
                position: absolute;
                top: calc(100% + 8px);
                left: 0;
                min-width: 180px;
                background: rgba(28, 32, 38, 0.9);
                backdrop-filter: blur(10px);
                -webkit-backdrop-filter: blur(10px);
                border-radius: 8px;
                border: 1px solid rgba(255, 255, 255, 0.1);
                box-shadow: 0 8px 25px rgba(0, 0, 0, 0.4);
                padding: 6px;
                opacity: 0;
                transform: translateY(-10px);
                pointer-events: none;
                transition: opacity 0.2s ease, transform 0.2s ease;
            }
            .tf-menu-dropdown.show {
                opacity: 1;
                transform: translateY(0);
                pointer-events: auto;
            }
            .tf-menu-item {
                display: block;
                width: 100%;
                background: none;
                border: none;
                color: #e6eef6;
                text-align: left;
                padding: 10px 12px;
                border-radius: 5px;
                cursor: pointer;
                font-size: 14px;
                border-bottom: 1px solid rgba(255, 255, 255, 0.08);
            }
             .tf-menu-item:last-child {
                border-bottom: none;
            }
            .tf-menu-item:hover {
                background-color: rgba(255, 255, 255, 0.1);
            }
        `;
        document.head.appendChild(style);

        menuContainer = document.createElement('div');
        menuContainer.id = 'tf-menu-container';
        menuContainer.innerHTML = `
            <button id="tf-menu-button">Menu</button>
            <div class="tf-menu-dropdown">
                <button class="tf-menu-item" data-action="load-model">Load Model</button>
                <button class="tf-menu-item" data-action="load-asset">Load Asset</button>
                <button class="tf-menu-item" data-action="export-glb">Export GLB</button>
                <button class="tf-menu-item" data-action="copy-data">Copy Data</button>
            </div>
        `;
        document.getElementById('app')?.appendChild(menuContainer);
        
        menuButton = document.getElementById('tf-menu-button');
        dropdown = menuContainer.querySelector('.tf-menu-dropdown');
    }

    function toggleMenu(show) {
        dropdown.classList.toggle('show', show);
    }

    function wireEvents() {
        menuButton.addEventListener('click', (event) => {
            event.stopPropagation();
            toggleMenu(!dropdown.classList.contains('show'));
        });

        dropdown.addEventListener('click', (event) => {
            const target = event.target;
            if (target.matches('.tf-menu-item')) {
                const action = target.dataset.action;
                
                // **UPDATED LOGIC HERE**
                if (action === 'load-model') {
                    window.ModelManager?.load();
                } else {
                    bus.dispatchEvent(new CustomEvent('action', { detail: { action } }));
                    console.log(`Menu action: ${action}`);
                }

                toggleMenu(false);
            }
        });

        window.addEventListener('click', () => {
            if (dropdown.classList.contains('show')) {
                toggleMenu(false);
            }
        });
    }

    function bootstrap() {
        if (window.Menu) return;

        injectUI();
        wireEvents();

        window.Menu = {
            on: (type, fn) => bus.addEventListener(type, fn),
        };

        window.App?.emit('menu:ready');
        window.Debug?.log('Menu UI ready.');
    }

    if (window.App?.glVersion) {
        bootstrap();
    } else {
        window.App?.on('app:booted', bootstrap);
    }

})();
