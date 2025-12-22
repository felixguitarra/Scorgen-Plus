import { useState, useEffect, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { MusicGenerator, type MusicParams, type GeneratedNote } from '../engine/MusicGenerator';
import { ScoreDisplay } from '../components/ScoreDisplay';
import { PlayerControls } from '../components/PlayerControls';
import { ArrowLeft, RefreshCw } from 'lucide-react';

export const Practice: React.FC = () => {
    const location = useLocation();
    const navigate = useNavigate();
    const params = location.state?.params as MusicParams;
    const [notes, setNotes] = useState<GeneratedNote[]>([]);
    const [selectedKey, setSelectedKey] = useState<string>('C');
    const [autoplay, setAutoplay] = useState(() => localStorage.getItem('scorgen-autoplay') === 'true');
    const [autoGenerate, setAutoGenerate] = useState(() => localStorage.getItem('scorgen-autoGenerate') === 'true');
    const [generationCount, setGenerationCount] = useState(0);
    const playerControlsRef = useRef<{ play: () => void; stop: () => void }>(null);

    // Session timer state with persistence
    const [sessionTime, setSessionTime] = useState(() => {
        const saved = localStorage.getItem('scorgen-sessionTime');
        return saved ? parseInt(saved) : 0;
    });
    const [exerciseCount, setExerciseCount] = useState(() => {
        const saved = localStorage.getItem('scorgen-exerciseCount');
        return saved ? parseInt(saved) : 0;
    });
    const [isPlaying, setIsPlaying] = useState(false);

    // Use refs to always get current values in callbacks
    const autoplayRef = useRef(autoplay);
    const autoGenerateRef = useRef(autoGenerate);

    useEffect(() => { autoplayRef.current = autoplay; }, [autoplay]);
    useEffect(() => { autoGenerateRef.current = autoGenerate; }, [autoGenerate]);

    // Persist session stats
    useEffect(() => { localStorage.setItem('scorgen-sessionTime', sessionTime.toString()); }, [sessionTime]);
    useEffect(() => { localStorage.setItem('scorgen-exerciseCount', exerciseCount.toString()); }, [exerciseCount]);

    // Timer - increment session time while playing
    useEffect(() => {
        let interval: number | null = null;

        if (isPlaying) {
            interval = setInterval(() => {
                setSessionTime(prev => prev + 1);
            }, 1000);
        }

        return () => {
            if (interval) clearInterval(interval);
        };
    }, [isPlaying]);

    const generate = () => {
        // Stop any active playback before generating new notes
        if (playerControlsRef.current) {
            playerControlsRef.current.stop();
        }

        const result = MusicGenerator.generate(params);
        setNotes(result.notes);
        setSelectedKey(result.selectedKey);
        setGenerationCount(prev => prev + 1);
        setExerciseCount(prev => prev + 1);
    };

    const handlePlaybackEnd = () => {
        if (autoGenerateRef.current && autoplayRef.current) {
            generate();
        }
    };

    const handlePlayingChange = (playing: boolean) => {
        setIsPlaying(playing);
    };

    const handleResetSession = () => {
        setSessionTime(0);
        setExerciseCount(0);
    };

    const handleBackToSetup = () => {
        // Stop playback before navigating
        if (playerControlsRef.current) {
            playerControlsRef.current.stop();
        }
        navigate('/');
    };

    // Format time as HH:MM:SS
    const formatTime = (seconds: number) => {
        const hours = Math.floor(seconds / 3600);
        const mins = Math.floor((seconds % 3600) / 60);
        const secs = seconds % 60;
        return `${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    };

    // Autoplay when generation count changes (except first mount)
    useEffect(() => {
        if (generationCount === 0) return;

        if (autoplayRef.current && playerControlsRef.current && notes.length > 0) {
            const timer = setTimeout(() => {
                playerControlsRef.current?.play();
            }, 200);

            return () => clearTimeout(timer);
        }
    }, [generationCount, notes.length]);

    useEffect(() => {
        if (!params) {
            navigate('/');
            return;
        }
        generate();

        // Spacebar keyboard shortcut
        const handleKeyPress = (e: KeyboardEvent) => {
            if (e.code === 'Space' && e.target === document.body) {
                e.preventDefault();
                generate();
            }
        };

        document.addEventListener('keydown', handleKeyPress);
        return () => document.removeEventListener('keydown', handleKeyPress);
    }, [params]);

    // Persist settings
    useEffect(() => { localStorage.setItem('scorgen-autoplay', autoplay.toString()); }, [autoplay]);
    useEffect(() => { localStorage.setItem('scorgen-autoGenerate', autoGenerate.toString()); }, [autoGenerate]);

    if (!params) return null;

    return (
        <div style={{
            minHeight: '100vh',
            padding: '2rem',
            background: '#111827',
            color: 'white',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center'
        }}>
            <div style={{ width: '100%', maxWidth: '1100px' }}>
                {/* Top bar with Back button and Session Timer */}
                <div style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    marginBottom: '1rem'
                }}>
                    <button
                        onClick={handleBackToSetup}
                        style={{
                            background: 'none',
                            border: 'none',
                            color: '#9ca3af',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.5rem',
                            fontSize: '1rem'
                        }}
                    >
                        <ArrowLeft size={20} /> Back to Setup
                    </button>

                    {/* Session Timer */}
                    <div style={{
                        color: '#9ca3af',
                        fontSize: '1rem',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.75rem'
                    }}>
                        <span>[Time: {formatTime(sessionTime)}]</span>
                        <span>|</span>
                        <span>[Exercises: {exerciseCount}]</span>
                        <span>|</span>
                        <button
                            onClick={handleResetSession}
                            style={{
                                background: 'none',
                                border: 'none',
                                color: '#9ca3af',
                                cursor: 'pointer',
                                fontSize: '1rem',
                                textDecoration: 'underline'
                            }}
                        >
                            Reset
                        </button>
                    </div>
                </div>

                <h1 style={{
                    textAlign: 'center',
                    marginBottom: '2rem',
                    background: 'linear-gradient(to right, #a78bfa, #f472b6)',
                    WebkitBackgroundClip: 'text',
                    WebkitTextFillColor: 'transparent',
                    fontSize: '2.5rem'
                }}>
                    {selectedKey} {params.scaleType}
                </h1>

                <ScoreDisplay notes={notes} clef={params.clef} keySignature={selectedKey} />

                {/* REDESIGNED CONTROLS SECTION */}
                <div style={{
                    marginTop: '2rem',
                    padding: '1.5rem',
                    background: 'rgba(31, 41, 55, 0.5)',
                    borderRadius: '16px',
                    border: '1px solid #374151'
                }}>
                    {/* Top row: PlayerControls */}
                    <PlayerControls
                        ref={playerControlsRef}
                        notes={notes}
                        clef={params.clef}
                        keySignature={selectedKey}
                        onPlaybackEnd={handlePlaybackEnd}
                        onPlayingChange={handlePlayingChange}
                    />

                    {/* Bottom row: Checkboxes + Generate button */}
                    <div style={{
                        marginTop: '1.5rem',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        gap: '1rem'
                    }}>
                        {/* Autoplay Checkboxes */}
                        <div style={{
                            display: 'flex',
                            gap: '2rem'
                        }}>
                            <label style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '0.5rem',
                                cursor: 'pointer',
                                fontSize: '0.95rem'
                            }}>
                                <input
                                    type="checkbox"
                                    checked={autoplay}
                                    onChange={(e) => setAutoplay(e.target.checked)}
                                    style={{ cursor: 'pointer', width: '18px', height: '18px' }}
                                />
                                <span>▶️ Autoplay</span>
                            </label>

                            <label style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '0.5rem',
                                cursor: autoplay ? 'pointer' : 'not-allowed',
                                fontSize: '0.95rem',
                                opacity: autoplay ? 1 : 0.5
                            }}>
                                <input
                                    type="checkbox"
                                    checked={autoGenerate}
                                    onChange={(e) => setAutoGenerate(e.target.checked)}
                                    disabled={!autoplay}
                                    style={{
                                        cursor: autoplay ? 'pointer' : 'not-allowed',
                                        width: '18px',
                                        height: '18px'
                                    }}
                                />
                                <span>🔄 Auto-generate Next</span>
                            </label>
                        </div>

                        {/* Generate Button */}
                        <button
                            onClick={generate}
                            style={{
                                padding: '0.75rem 1.5rem',
                                background: 'linear-gradient(to right, #3b82f6, #2563eb)',
                                color: 'white',
                                border: 'none',
                                borderRadius: '50px',
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '0.5rem',
                                fontSize: '1rem',
                                fontWeight: 'bold',
                                boxShadow: '0 4px 15px rgba(37, 99, 235, 0.3)',
                                transition: 'transform 0.2s',
                                whiteSpace: 'nowrap'
                            }}
                            onMouseEnter={(e) => e.currentTarget.style.transform = 'translateY(-2px)'}
                            onMouseLeave={(e) => e.currentTarget.style.transform = 'translateY(0)'}
                        >
                            <RefreshCw size={18} /> Generate (Space)
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};
