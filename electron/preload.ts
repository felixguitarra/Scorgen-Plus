// See the Electron documentation for details on how to use preload scripts:
// https://www.electronjs.org/docs/latest/tutorial/process-model#preload-scripts

// Currently empty as we don't need to expose Node.js APIs to the renderer yet.
// If we need to, we use contextBridge here.
import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('electronAPI', {
    saveRhythmTemplates: (content: string) => ipcRenderer.invoke('save-rhythm-templates', content),
    loadRhythmTemplates: () => ipcRenderer.invoke('load-rhythm-templates')
});
