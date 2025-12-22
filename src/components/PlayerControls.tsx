import { useState, useEffect, useImperativeHandle, forwardRef } from 'react';
import * as Tone from 'tone';
import { Note as TonalNote } from 'tonal';
import { PPQ, getTicks } from '../engine/RhythmConstants';
import { createAccidentalState, resetMeasureState, getAccidentalOffset } from '../engine/AccidentalTracking';
import { Play, Square } from 'lucide-react';
import styles from './PlayerControls.module.css';
import type { GeneratedNote } from '../engine/MusicGenerator';

interface PlayerControlsProps {
    notes: GeneratedNote[];
    clef?: "treble" | "bass";
    keySignature?: string;
    onPlaybackEnd?: () => void;
    onPlayingChange?: (isPlaying: boolean) => void;
}

export interface PlayerControlsHandle {
    play: () => void;
    stop: () => void;
}

export const PlayerControls = forwardRef<PlayerControlsHandle, PlayerControlsProps>((
    {
        notes,
        clef: _clef = "treble",
        keySignature: _keySignature = "C",
        onPlaybackEnd,
        onPlayingChange
    },
    ref
) => {
    const [isPlaying, setIsPlaying] = useState(false);
    const [tempo, setTempo] = useState(() => parseInt(localStorage.getItem('scorgen-tempo') || '100'));
    const [playNotes, setPlayNotes] = useState(() => localStorage.getItem('scorgen-playNotes') !== 'false');
    const [playMetronome, setPlayMetronome] = useState(() => localStorage.getItem('scorgen-playMetronome') === 'true');

    // Notify parent when playing state changes
    useEffect(() => {
        if (onPlayingChange) {
            onPlayingChange(isPlaying);
        }
    }, [isPlaying, onPlayingChange]);

    useEffect(() => {
        Tone.Transport.bpm.value = tempo;
        localStorage.setItem('scorgen-tempo', tempo.toString());
    }, [tempo]);

    useEffect(() => { localStorage.setItem('scorgen-playNotes', playNotes.toString()); }, [playNotes]);
    useEffect(() => { localStorage.setItem('scorgen-playMetronome', playMetronome.toString()); }, [playMetronome]);

    const handlePlay = async (forcePlay = false) => {
        if (notes.length === 0) return;

        if (isPlaying && !forcePlay) {
            handleStop();
            return;
        }

        if (isPlaying && forcePlay) {
            Tone.Transport.stop();
            Tone.Transport.cancel();
        }

        await Tone.start();

        // Reset Transport
        Tone.Transport.stop();
        Tone.Transport.cancel();
        Tone.Transport.position = 0;

        const synth = new Tone.Synth().toDestination();

        // Metronome
        const click = new Tone.MembraneSynth({
            pitchDecay: 0.008,
            octaves: 2,
            oscillator: { type: 'sine' },
            envelope: { attack: 0.001, decay: 0.3, sustain: 0, release: 0.01 }
        }).toDestination();

        let currentTicks = 0;
        let currentMeasureTicks = 0;
        const accidentalState = createAccidentalState(_keySignature);
        // Removed unused transportTime

        notes.forEach((n) => {
            // Check for measure boundary (PPQ * 4 for 4/4 time)
            if (currentMeasureTicks >= PPQ * 4) {
                resetMeasureState(accidentalState);
                currentMeasureTicks = 0;
            }

            const noteTicks = getTicks(n.duration);
            let toneDur = "8n";

            // Calculate duration string for Tone.js
            if (n.duration.includes('t')) {
                // Triplets
                const base = n.duration.replace('t', '').replace('d', '').replace('r', '');
                // Map 'q' to '4' etc if needed
                let toneBase = base;
                if (base === 'q') toneBase = '4';
                if (base === 'h') toneBase = '2';
                if (base === 'w') toneBase = '1';

                toneDur = toneBase + 'n'; // e.g. "4n"

                // Override for triplets
                if (n.duration.includes('t')) {
                    toneDur = toneBase + 't'; // e.g. "4t"
                }
            } else {
                if (n.duration === "w") toneDur = "1n";
                else if (n.duration === "h") toneDur = "2n";
                else if (n.duration === "q") toneDur = "4n";
                else if (n.duration === "8") toneDur = "8n";
                else if (n.duration === "16") toneDur = "16n";
            }

            // Handle dots for Tone.js duration string
            if (n.duration.includes('d') && !n.duration.includes('t')) {
                toneDur += ".";
            }

            const totalQuarters = currentTicks / PPQ;
            // OFFSET: Add 1 measure (4 beats) for the count-in
            const bars = Math.floor(totalQuarters / 4) + (playMetronome ? 1 : 0);
            const quarters = Math.floor(totalQuarters % 4);
            const sixteenths = (totalQuarters % 1) * 4;
            const timeStr = `${bars}:${quarters}:${sixteenths.toFixed(2)}`;

            const noteKey = n.keys[0];
            if (!noteKey) {
                currentTicks += noteTicks;
                currentMeasureTicks += noteTicks;
                return;
            }

            const parts = noteKey.split('/');
            if (parts.length !== 2) {
                currentTicks += noteTicks;
                currentMeasureTicks += noteTicks;
                return;
            }

            const notePart = parts[0];
            const octave = parts[1];

            // Calculate MIDI pitch with accidental tracking
            // Remove 'n' suffix if present before looking up base note
            const cleanNotePart = notePart.replace(/n$/i, '');
            const baseNote = cleanNotePart.charAt(0).toUpperCase(); // e.g. 'C'

            // Octave adjustment needs to happen before accidental offset
            // But we need the raw note name for Tonal

            const accidentalOffset = getAccidentalOffset(notePart, accidentalState);

            // Calculate base MIDI (natural note in that octave)
            // Note: TonalNote.midi("C4") is 60.
            // We use the base letter + octave to get the "white key" midi, then apply offset.
            let midiNumber = TonalNote.midi(baseNote + octave);

            if (midiNumber === null) {
                console.warn("Invalid midi calculation for:", baseNote + octave);
                currentTicks += noteTicks;
                currentMeasureTicks += noteTicks;
                return;
            }

            midiNumber += accidentalOffset;

            // Apply clef offset if needed (only if visual display shifted it, but usually generated notes are absolute pitch)
            // Assuming generated notes are correct pitch-wise for the clef.

            const isRest = n.duration.includes('r');
            const finalNoteName = isRest ? null : TonalNote.fromMidi(midiNumber);

            if (playNotes && finalNoteName && !isRest) {
                Tone.Transport.schedule((time) => {
                    synth.triggerAttackRelease(finalNoteName, toneDur, time);
                }, timeStr);
            }

            currentTicks += noteTicks;
            currentMeasureTicks += noteTicks;
        });

        const totalTicks = currentTicks; // For stopping logic maybe?

        if (playMetronome) {
            // Pre-count
            for (let beat = 0; beat < 4; beat++) {
                const timeStr = `0:${beat}:0`;
                const isDownbeat = beat === 0;
                const pitch = isDownbeat ? 'G4' : 'E4';

                Tone.Transport.schedule((time) => {
                    click.triggerAttackRelease(pitch, '32n', time, 0.8);
                }, timeStr);
            }

            // Regular metronome
            // Schedule every quarter note (PPQ) until end
            const totalQuarters = Math.ceil(totalTicks / PPQ);

            for (let i = 0; i <= totalQuarters; i++) {
                const currentTick = i * PPQ;
                if (currentTick > totalTicks) break;

                // Add 4 beats (1 bar) for pre-count offset
                const totalBeat = (currentTick / PPQ) + 4;

                const bars2 = Math.floor(totalBeat / 4);
                const quarters2 = Math.floor(totalBeat % 4);
                const timeStr = `${bars2}:${quarters2}:0`;

                // Determine strong/weak beat based on position in measure
                // Assuming 4/4 signature for now
                const beatInBar = i % 4;
                const isDownbeat = beatInBar === 0;
                const pitch = isDownbeat ? 'C3' : 'G2';

                Tone.Transport.schedule((time) => {
                    click.triggerAttackRelease(pitch, '32n', time, 0.5);
                }, timeStr);
            }
        }

        // Schedule end
        const totalEndQrts = (totalTicks / PPQ) + 4; // Add pre-count
        const bars3 = Math.floor(totalEndQrts / 4);
        const quarters3 = Math.floor(totalEndQrts % 4);
        const sixteenths3 = (totalEndQrts % 1) * 4;
        // Add a small buffer to ensure last note plays fully
        const endTimeStr = `${bars3}:${quarters3}:${sixteenths3.toFixed(2)}`;

        Tone.Transport.schedule(() => {
            setIsPlaying(false);
            if (onPlaybackEnd) {
                onPlaybackEnd();
            }
        }, endTimeStr);

        setIsPlaying(true);
        Tone.Transport.start();
    };

    const handleStop = () => {
        Tone.Transport.stop();
        Tone.Transport.cancel();
        setIsPlaying(false);
    };

    // Expose play and stop via ref
    useImperativeHandle(ref, () => ({
        play: () => handlePlay(true),
        stop: () => handleStop()
    }));

    return (
        <div className={styles.playerControls}>
            <div className={styles.playbackSection}>
                <button onClick={() => handlePlay(false)} className={styles.playButton}>
                    {isPlaying ? <Square size={24} /> : <Play size={24} />}
                    {isPlaying ? 'Stop' : 'Play'}
                </button>

                <div className={styles.tempoControl}>
                    <label>Tempo: {tempo} BPM</label>
                    <input
                        type="range"
                        min="40"
                        max="200"
                        value={tempo}
                        onChange={(e) => setTempo(Number(e.target.value))}
                        className={styles.slider}
                    />
                </div>
            </div>

            <div className={styles.options}>
                <label className={styles.checkbox}>
                    <input
                        type="checkbox"
                        checked={playNotes}
                        onChange={(e) => setPlayNotes(e.target.checked)}
                    />
                    <span>Play Notes</span>
                </label>

                <label className={styles.checkbox}>
                    <input
                        type="checkbox"
                        checked={playMetronome}
                        onChange={(e) => setPlayMetronome(e.target.checked)}
                    />
                    <span>Metronome</span>
                </label>
            </div>
        </div>
    );
});

PlayerControls.displayName = 'PlayerControls';
