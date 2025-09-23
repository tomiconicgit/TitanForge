// src/js/menu.js

// ... (keep the code before this line the same)

        menuContainer.innerHTML = `
            <button id="tf-menu-button">Menu</button>
            <div id="tf-menu-card">
                <button data-action="load">Load</button>
                <button data-action="toggles">Toggles</button>
                <button data-action="animation">Animation</button>
                <button data-action="copy">Copy Data</button>
                <button data-action="remove-rig">Remove Rig</button> 
            </div>
        `;
        document.getElementById('app')?.appendChild(menuContainer);
        
// ... (keep the code between these lines the same)

        menuCard.addEventListener('click', (event) => {
            const action = event.target.dataset.action;
            if (!action) return;

            toggleMenu(false);
            
            setTimeout(() => {
                if (action === 'load') {
                    showLoadModal(true);
                } else if (action === 'toggles') {
                    window.Toggles?.show();
                } else if (action === 'animation') {
                    window.TFAnimation?.show();
                } else if (action === 'copy') {
                    window.Copy?.show();
                } else if (action === 'remove-rig') {
                    window.RigRemover?.show();
                }
            }, 300);
        });

// ... (the rest of the file stays the same)
