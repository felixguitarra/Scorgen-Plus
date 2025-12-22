import React, { useState, useEffect } from 'react';
import styles from './TemplateEditor.module.css';
import rhythmTemplates from '../data/rhythmTemplates.json';

interface TemplateEditorProps {
    isOpen: boolean;
    onClose: () => void;
    onSave: () => void;
}

export const TemplateEditor: React.FC<TemplateEditorProps> = ({ isOpen, onClose, onSave }) => {
    const [editorContent, setEditorContent] = useState('');
    const [error, setError] = useState<string | null>(null);
    const [isSaving, setIsSaving] = useState(false);

    // Convert JSON to Custom Format
    const serializeToCustomFormat = (data: typeof rhythmTemplates) => {
        return data.map(item => {
            const patternStr = item.pattern.join(',');
            return `"${item.name}": ${patternStr}`;
        }).join('\n');
    };

    // Parse Custom Format to JSON
    const parseCustomFormat = (text: string) => {
        const lines = text.split('\n').filter(line => line.trim() !== '');
        const newTemplates: typeof rhythmTemplates = [];

        lines.forEach((line, index) => {
            // Expected format: "Name": p,a,t,t,e,r,n * weight
            // Regex to capture parts
            const match = line.match(/"([^"]+)":\s*([a-zA-Z0-9,]+)(?:\s*\*\s*(\d+))?/);

            if (!match) {
                throw new Error(`Syntax error on line ${index + 1}: Expected "Name": pattern`);
            }

            const name = match[1];
            const patternRaw = match[2];
            // const weight = match[3] ? parseInt(match[3], 10) : 3; // Capture weight if we decide to use it

            const pattern = patternRaw.split(',').map(p => p.trim());

            // Validate pattern elements
            const validDurations = ['w', 'h', 'q', '8', '16', 'wr', 'hr', 'qr', '8r', '16r', 'wd', 'hd', 'qd', '8d', '16d'];
            pattern.forEach(p => {
                if (!validDurations.includes(p)) {
                    throw new Error(`Invalid duration "${p}" on line ${index + 1}`);
                }
            });

            newTemplates.push({ name, pattern });
        });

        return newTemplates;
    };

    useEffect(() => {
        if (isOpen) {
            setEditorContent(serializeToCustomFormat(rhythmTemplates));
            setError(null);
        }
    }, [isOpen]);

    const handleSave = async () => {
        try {
            setIsSaving(true);
            setError(null);

            const parsed = parseCustomFormat(editorContent);
            const jsonString = JSON.stringify(parsed, null, 2);

            // Save via Electron IPC
            if (window.electronAPI) {
                const result = await window.electronAPI.saveRhythmTemplates(jsonString);

                if (!result.success) {
                    throw new Error(result.error || 'Failed to save');
                }
            } else {
                console.warn('Electron API not available. Changes will not be saved to disk.');
                // Simulate save for browser testing
                await new Promise(resolve => setTimeout(resolve, 500));
            }

            onSave();
            onClose();
        } catch (err) {
            setError((err as Error).message);
        } finally {
            setIsSaving(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div className={styles.overlay}>
            <div className={styles.modal}>
                <div className={styles.header}>
                    <h3>Edit Rhythm Templates</h3>
                    <button className={styles.closeButton} onClick={onClose}>×</button>
                </div>

                <div className={styles.content}>
                    <p className={styles.helpText}>
                        Format: <code>"Name": duration,duration...</code><br />
                        Example: <code>"Quarter Notes": q,q,q,q</code><br />
                        Valid durations: w, h, q, 8, 16 (add 'r' for rest, 'd' for dotted)
                    </p>

                    <textarea
                        className={styles.editor}
                        value={editorContent}
                        onChange={(e) => setEditorContent(e.target.value)}
                        spellCheck={false}
                        placeholder='"My Pattern": q,8,8'
                    />

                    {error && <div className={styles.error}>{error}</div>}
                </div>

                <div className={styles.footer}>
                    <button className={styles.cancelButton} onClick={onClose}>Cancel</button>
                    <button
                        className={styles.saveButton}
                        onClick={handleSave}
                        disabled={isSaving}
                    >
                        {isSaving ? 'Saving...' : 'Save Changes'}
                    </button>
                </div>
            </div>
        </div>
    );
};
