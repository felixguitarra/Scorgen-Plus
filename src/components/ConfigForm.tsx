import { useState, useEffect, useRef, type FC, type FormEvent } from 'react';
import { Note } from 'tonal';
import styles from './ConfigForm.module.css';
import { type MusicParams, AVAILABLE_RHYTHM_PATTERNS as STATIC_TEMPLATES, type WeightedPattern } from '../engine/MusicGenerator';
import { RhythmPatternPreview } from './RhythmPatternPreview';
import { TemplateEditor } from './TemplateEditor';

interface ConfigFormProps {
    onStart: (params: MusicParams) => void;
}

interface PatternState {
    enabled: boolean;
    weight: number;
}

export const ConfigForm: FC<ConfigFormProps> = ({ onStart }) => {
    const allKeys = ["C", "G", "D", "A", "E", "B", "F#", "Db", "Ab", "Eb", "Bb", "F"];

    // Dynamic template loading
    const [availablePatterns, setAvailablePatterns] = useState<{ name: string; pattern: string[] }[]>(STATIC_TEMPLATES);

    const [selectedKeys, setSelectedKeys] = useState<string[]>(() => {
        const saved = localStorage.getItem('scorgen-keys');
        return saved ? JSON.parse(saved) : ["C"];
    });

    // Rhythm Patterns State
    const [patternStates, setPatternStates] = useState<Record<string, PatternState>>(() => {
        const saved = localStorage.getItem('scorgen-rhythm-patterns');
        if (saved) return JSON.parse(saved);

        // Default: Enable simple patterns with medium weight
        const defaults: Record<string, PatternState> = {};
        STATIC_TEMPLATES.forEach(p => {
            const isSimple = p.name === "Quarter" || p.name === "Two 8ths";
            defaults[p.name] = {
                enabled: isSimple,
                weight: isSimple ? 5 : 3
            };
        });
        return defaults;
    });

    // Load templates dynamically via IPC (production) or use static (dev/browser)
    useEffect(() => {
        const loadTemplates = async () => {
            if (window.electronAPI) {
                try {
                    const result = await window.electronAPI.loadRhythmTemplates();
                    if (result.success && result.content) {
                        const templates = JSON.parse(result.content);
                        setAvailablePatterns(templates);
                        console.log('✅ Loaded templates dynamically:', templates.length, 'patterns');
                    }
                } catch (error) {
                    console.error('Failed to load templates dynamically:', error);
                }
            }
        };
        loadTemplates();
    }, []);

    const [clef, setClef] = useState<MusicParams['clef']>(
        () => (localStorage.getItem('scorgen-clef') as MusicParams['clef']) || "treble"
    );

    const [maxInterval, setMaxInterval] = useState(() =>
        parseInt(localStorage.getItem('scorgen-maxInterval') || '5')
    );

    const [accidentalChance, setAccidentalChance] = useState(() =>
        parseInt(localStorage.getItem('scorgen-accidentalChance') || '0')
    );

    const [tessituraMin, setTessituraMin] = useState(() => {
        const saved = localStorage.getItem('scorgen-tessituraMin');
        if (saved) return parseInt(saved);
        const defaultClef = (localStorage.getItem('scorgen-clef') as MusicParams['clef']) || "treble";
        return defaultClef === 'treble' ? 60 : 40;
    });

    const [tessituraMax, setTessituraMax] = useState(() => {
        const saved = localStorage.getItem('scorgen-tessituraMax');
        if (saved) return parseInt(saved);
        const defaultClef = (localStorage.getItem('scorgen-clef') as MusicParams['clef']) || "treble";
        return defaultClef === 'treble' ? 81 : 60;
    });

    const initialClef = useRef(clef);

    // Update tessitura ONLY when user changes clef (not on mount)
    useEffect(() => {
        // If clef changed from initial value
        if (clef !== initialClef.current) {
            initialClef.current = clef;

            // User changed clef - update to defaults
            if (clef === 'treble') {
                setTessituraMin(60); // C4
                setTessituraMax(81); // A5
            } else {
                setTessituraMin(40); // E2
                setTessituraMax(60); // C4
            }
        }
    }, [clef]);

    // Persistence
    useEffect(() => { localStorage.setItem('scorgen-keys', JSON.stringify(selectedKeys)); }, [selectedKeys]);
    useEffect(() => { localStorage.setItem('scorgen-rhythm-patterns', JSON.stringify(patternStates)); }, [patternStates]);
    useEffect(() => { localStorage.setItem('scorgen-clef', clef); }, [clef]);
    useEffect(() => { localStorage.setItem('scorgen-maxInterval', maxInterval.toString()); }, [maxInterval]);
    useEffect(() => { localStorage.setItem('scorgen-accidentalChance', accidentalChance.toString()); }, [accidentalChance]);
    useEffect(() => { localStorage.setItem('scorgen-tessituraMin', tessituraMin.toString()); }, [tessituraMin]);
    useEffect(() => { localStorage.setItem('scorgen-tessituraMax', tessituraMax.toString()); }, [tessituraMax]);

    const handleKeyToggle = (key: string) => {
        setSelectedKeys(prev => {
            if (prev.includes(key)) {
                if (prev.length === 1) return prev;
                return prev.filter(k => k !== key);
            } else {
                return [...prev, key];
            }
        });
    };

    const handlePatternToggle = (name: string) => {
        setPatternStates(prev => ({
            ...prev,
            [name]: { ...prev[name], enabled: !prev[name]?.enabled }
        }));
    };

    const handleWeightChange = (name: string, weight: number) => {
        setPatternStates(prev => ({
            ...prev,
            [name]: { ...prev[name], weight }
        }));
    };

    const handleSubmit = (e: FormEvent) => {
        e.preventDefault();

        // Convert UI accidental chance (0-100) to actual chance (0-50%)
        const actualAccidentalChance = (accidentalChance / 100) * 50;

        // Build weighted patterns list
        const rhythmPatterns: WeightedPattern[] = [];
        availablePatterns.forEach(p => {
            const state = patternStates[p.name];
            if (state?.enabled) {
                rhythmPatterns.push({
                    name: p.name,
                    pattern: p.pattern,
                    weight: state.weight
                });
            }
        });

        // Fallback if no patterns selected
        if (rhythmPatterns.length === 0) {
            rhythmPatterns.push({ name: "Quarter", pattern: ["q"], weight: 1 });
        }

        console.log('🎵 ConfigForm submitting:', {
            rhythmPatterns,
            accidentalChance_UI: accidentalChance,
            accidentalChance_actual: actualAccidentalChance
        });

        onStart({
            keys: selectedKeys,
            scaleType: "major",
            rhythmPatterns,
            clef,
            measureCount: 16,
            maxInterval,
            accidentalChance: actualAccidentalChance,
            tessituraMin,
            tessituraMax
        });
    };

    const getMidiNoteName = (midi: number): string => {
        const note = Note.fromMidi(midi);
        return note || '';
    };

    const [isEditorOpen, setIsEditorOpen] = useState(false);

    const handleTemplatesSaved = () => {
        // Reload to fetch new templates
        window.location.reload();
    };

    return (
        <div className={styles.container}>
            <TemplateEditor
                isOpen={isEditorOpen}
                onClose={() => setIsEditorOpen(false)}
                onSave={handleTemplatesSaved}
            />
            <h2 className={styles.title}>Setup Practice</h2>
            <form onSubmit={handleSubmit}>
                <div className={styles.formGroup}>
                    <label className={styles.label}>Keys (Major) - Select one or more</label>
                    <div className={styles.keysGrid}>
                        {allKeys.map(k => (
                            <div
                                key={k}
                                className={`${styles.keyItem} ${selectedKeys.includes(k) ? styles.keyItemSelected : ''}`}
                                onClick={() => handleKeyToggle(k)}
                            >
                                {k}
                            </div>
                        ))}
                    </div>
                </div>

                <div className={styles.formGroup}>
                    <div className={styles.labelRow}>
                        <label className={styles.label}>Rhythm Patterns</label>
                        <button
                            type="button"
                            className={styles.iconButton}
                            onClick={() => setIsEditorOpen(true)}
                            title="Edit Rhythm Templates"
                        >
                            ⚙️
                        </button>
                    </div>
                    <div className={styles.rhythmGrid}>
                        {availablePatterns.map(p => {
                            const state = patternStates[p.name] || { enabled: false, weight: 3 };

                            return (
                                <div
                                    key={p.name}
                                    className={`${styles.rhythmItem} ${state.enabled ? styles.rhythmItemSelected : ''}`}
                                    onClick={() => handlePatternToggle(p.name)}
                                    title={p.name}
                                >
                                    <RhythmPatternPreview pattern={p.pattern} />
                                    <div
                                        className={styles.weightBars}
                                        style={{ opacity: state.enabled ? 1 : 0.3 }}
                                        onClick={(e) => {
                                            if (!state.enabled) return;
                                            e.stopPropagation();
                                            const newWeight = (state.weight % 5) + 1;
                                            handleWeightChange(p.name, newWeight);
                                        }}
                                    >
                                        {[1, 2, 3, 4, 5].map(level => (
                                            <div
                                                key={level}
                                                className={`${styles.weightBar} ${level <= state.weight ? styles.weightBarActive : ''}`}
                                            />
                                        ))}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>

                <div className={styles.formGroup}>
                    <label className={styles.label}>Clef</label>
                    <select className={styles.select} value={clef} onChange={(e) => setClef(e.target.value as any)}>
                        <option value="treble">Treble</option>
                        <option value="bass">Bass</option>
                    </select>
                </div>

                <div className={styles.formGroup}>
                    <label className={styles.label}>Tessitura Range</label>
                    <div className={styles.tessituraSlider}>
                        <div className={styles.rangeValues}>
                            <span>Min: {getMidiNoteName(tessituraMin)}</span>
                            <span>Max: {getMidiNoteName(tessituraMax)}</span>
                        </div>
                        <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
                            <input
                                type="range"
                                className={styles.slider}
                                min="21"
                                max="108"
                                value={tessituraMin}
                                onChange={(e) => setTessituraMin(Math.min(Number(e.target.value), tessituraMax - 1))}
                            />
                            <input
                                type="range"
                                className={styles.slider}
                                min="21"
                                max="108"
                                value={tessituraMax}
                                onChange={(e) => setTessituraMax(Math.max(Number(e.target.value), tessituraMin + 1))}
                            />
                        </div>
                    </div>
                </div>

                <div className={styles.formGroup}>
                    <label className={styles.label}>Max Interval: {maxInterval} semitones</label>
                    <input type="range" className={styles.slider} min="1" max="24" value={maxInterval} onChange={(e) => setMaxInterval(Number(e.target.value))} />
                </div>

                <div className={styles.formGroup}>
                    <label className={styles.label}>Accidental Chance: {accidentalChance}%</label>
                    <input type="range" className={styles.slider} min="0" max="100" value={accidentalChance} onChange={(e) => setAccidentalChance(Number(e.target.value))} />
                </div>

                <button type="submit" className={styles.button}>Start Practice</button>
            </form >
        </div >
    );
};
