// Usa require em vez de import para compatibilidade total no Linux/WSL
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electron', {
    saveRhythmTemplates: (content: string) => ipcRenderer.invoke('save-rhythm-templates', content),
    loadRhythmTemplates: () => ipcRenderer.invoke('load-rhythm-templates'),
});