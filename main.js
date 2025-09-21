// main.js
const appContainer = document.getElementById('app-container');

const toolModules = {
    rigremoval: () => import('./tools/rigremoval.js'),
    attachmentrig: () => import('./tools/attachmentrig.js'),
};

function showMainMenu() {
    appContainer.innerHTML = `
        <div class="fade-in" style="display: flex; flex-direction: column; gap: 1rem; padding: 2rem;">
            <h2>Choose a Tool</h2>
            <button class="btn" id="rigremoval-btn">Rig Removal Tool</button>
            <button class="btn" id="attachmentrig-btn">Attachment Rig Tool</button>
        </div>
    `;

    document.getElementById('rigremoval-btn').addEventListener('click', () => {
        loadTool('rigremoval');
    });

    document.getElementById('attachmentrig-btn').addEventListener('click', () => {
        loadTool('attachmentrig');
    });
}

async function loadTool(toolName) {
    appContainer.innerHTML = `
        <div class="fade-in" style="display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100%;">
            <p>Loading tool: ${toolName}...</p>
        </div>
    `;

    try {
        const module = await toolModules[toolName]();
        module.init(appContainer, showMainMenu);

    } catch (error) {
        console.error(`Failed to load or initialize tool: ${toolName}`, error);
        appContainer.innerHTML = `
            <div style="padding: 2rem; text-align: center;">
                <p style="color: red;">Error loading tool. Please try again.</p>
                <button class="btn" onclick="location.reload();">Reload</button>
            </div>
        `;
    }
}

showMainMenu();
