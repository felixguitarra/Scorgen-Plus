/// <reference types="vite/client" />

interface Window {
    electronAPI: {
        saveRhythmTemplates: (content: string) => Promise<{ success: boolean; error?: string }>;
        loadRhythmTemplates: () => Promise<{ success: boolean; content?: string; error?: string }>;
    };
}
