import { app, BrowserWindow, ipcMain } from 'electron';
import path from 'path';
import { fileURLToPath } from 'url';
import { createRequire } from 'module';
import fs from 'fs';

const require = createRequire(import.meta.url);
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Handle creating/removing shortcuts on Windows when installing/uninstalling.
if (require('electron-squirrel-startup')) {
    app.quit();
}

const createWindow = () => {
    // Create the browser window.
    const mainWindow = new BrowserWindow({
        width: 1200,
        height: 800,
        webPreferences: {
            preload: path.join(__dirname, 'preload.js'),
            nodeIntegration: false,
            contextIsolation: true,
        },
    });

    // In production, load the index.html from the dist folder.
    // In development, load from the Vite dev server.
    if (process.env.NODE_ENV === 'development') {
        mainWindow.loadURL('http://localhost:5173');
        mainWindow.webContents.openDevTools();
    } else {
        mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
    }

    mainWindow.setMenuBarVisibility(false);
};

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
app.whenReady().then(() => {
    createWindow();

    app.on('activate', () => {
        // On OS X it's common to re-create a window in the app when the
        // dock icon is clicked and there are no other windows open.
        if (BrowserWindow.getAllWindows().length === 0) {
            createWindow();
        }
    });
});

// Quit when all windows are closed, except on macOS.
app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit();
    }
});

// IPC Handler for saving rhythm templates
ipcMain.handle('save-rhythm-templates', async (event, content) => {
    try {
        let filePath: string;

        if (process.env.NODE_ENV === 'development') {
            // In development, save to the source file
            filePath = path.join(__dirname, '../src/data/rhythmTemplates.json');
        } else {
            // In production, save to user data directory
            const userDataPath = app.getPath('userData');
            const dataDir = path.join(userDataPath, 'data');

            // Ensure the data directory exists
            await fs.promises.mkdir(dataDir, { recursive: true });

            filePath = path.join(dataDir, 'rhythmTemplates.json');

            // If file doesn't exist, copy default from resources
            if (!fs.existsSync(filePath)) {
                const defaultPath = path.join(process.resourcesPath, 'rhythmTemplates.json');
                if (fs.existsSync(defaultPath)) {
                    await fs.promises.copyFile(defaultPath, filePath);
                }
            }
        }

        await fs.promises.writeFile(filePath, content, 'utf-8');
        console.log('✅ Rhythm templates saved to:', filePath);
        return { success: true };
    } catch (error) {
        console.error('❌ Failed to save rhythm templates:', error);
        return { success: false, error: (error as Error).message };
    }
});

// IPC Handler for loading rhythm templates
ipcMain.handle('load-rhythm-templates', async () => {
    try {
        let filePath: string;

        if (process.env.NODE_ENV === 'development') {
            // In development, load from source
            filePath = path.join(__dirname, '../src/data/rhythmTemplates.json');
        } else {
            // In production, load from user data directory
            const userDataPath = app.getPath('userData');
            const dataDir = path.join(userDataPath, 'data');
            filePath = path.join(dataDir, 'rhythmTemplates.json');

            // If file doesn't exist, copy default from resources
            if (!fs.existsSync(filePath)) {
                await fs.promises.mkdir(dataDir, { recursive: true });
                const defaultPath = path.join(process.resourcesPath, 'rhythmTemplates.json');
                if (fs.existsSync(defaultPath)) {
                    await fs.promises.copyFile(defaultPath, filePath);
                }
            }
        }

        const content = await fs.promises.readFile(filePath, 'utf-8');
        console.log('✅ Rhythm templates loaded from:', filePath);
        return { success: true, content };
    } catch (error) {
        console.error('❌ Failed to load rhythm templates:', error);
        return { success: false, error: (error as Error).message };
    }
});
