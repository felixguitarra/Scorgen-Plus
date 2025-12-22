import { Scale, Note } from "tonal";
import { getTicks, PPQ } from './RhythmConstants';
import rhythmTemplates from '../data/rhythmTemplates.json';

export interface WeightedPattern {
  name: string;
  pattern: string[];
  weight: number;
}

export interface MusicParams {
  keys: string[];
  scaleType: string;
  rhythmPatterns: WeightedPattern[];
  clef: "treble" | "bass";
  measureCount: number;
  maxInterval?: number;
  allowRests?: boolean;
  accidentalChance?: number;
  tessituraMin?: number;
  tessituraMax?: number;
}

export interface GeneratedNote {
  keys: string[];
  duration: string;
}

export const AVAILABLE_RHYTHM_PATTERNS: { name: string; pattern: string[] }[] = rhythmTemplates;

export class MusicGenerator {
  static generate(params: MusicParams): { notes: GeneratedNote[], selectedKey: string } {
    const { keys, scaleType, rhythmPatterns, measureCount, clef, maxInterval = 12, accidentalChance = 0, tessituraMin, tessituraMax } = params;

    const selectedKey = keys[Math.floor(Math.random() * keys.length)];
    const scaleName = `${selectedKey} ${scaleType}`;
    const scaleNotes = Scale.get(scaleName).notes;

    let minMidi: number, maxMidi: number;
    if (tessituraMin !== undefined && tessituraMax !== undefined) {
      minMidi = tessituraMin;
      maxMidi = tessituraMax;
    } else {
      minMidi = clef === "treble" ? 60 : 40;
      maxMidi = clef === "treble" ? 81 : 60;
    }

    const scalePitchClasses = new Set(scaleNotes.map(note => {
      const midiNote = Note.midi(note + '4');
      return midiNote !== null ? midiNote % 12 : -1;
    }).filter(pc => pc !== -1));

    const range: { note: string; midi: number }[] = [];
    console.log(`[MusicGenerator] Generating for Key: ${selectedKey}, Scale: ${scaleType}, Clef: ${clef}`);
    console.log(`[MusicGenerator] Range inputs - Min: ${minMidi}, Max: ${maxMidi}`);
    console.log(`[MusicGenerator] Scale notes:`, scaleNotes);

    for (let midi = minMidi; midi <= maxMidi; midi++) {
      const midiNoteName = Note.fromMidi(midi);
      if (!midiNoteName) continue;
      const octave = Note.octave(midiNoteName);
      const pitchClass = midi % 12;

      // Check exact matches or enharmonic equivalents
      const isInScale = scalePitchClasses.has(pitchClass);

      if (isInScale) {
        const scaleNoteName = scaleNotes.find(scaleNote => {
          const scaleMidi = Note.midi(scaleNote + '4');
          return scaleMidi !== null && (scaleMidi % 12) === pitchClass;
        });
        const noteName = scaleNoteName || Note.pitchClass(Note.simplify(midiNoteName));
        range.push({ note: `${noteName}${octave}`, midi });
      }
    }

    console.log(`[MusicGenerator] Generated Range (${range.length} notes):`, range.map(r => r.note).join(', '));

    if (range.length === 0) {
      console.error('❌ CRITICAL: No notes generated in range!');
      console.warn('⚠️ No notes in range for key:', selectedKey);
      // Fallback: use all chromatic notes
      for (let midi = minMidi; midi <= maxMidi; midi++) {
        const noteName = Note.fromMidi(midi);
        if (noteName) {
          const octave = Note.octave(noteName);
          const simplifiedName = Note.simplify(noteName);
          const pitchOnly = Note.pitchClass(simplifiedName);
          range.push({ note: `${pitchOnly}${octave}`, midi });
        }
      }
    }

    const notes: GeneratedNote[] = [];
    let lastMidi: number | null = null;

    // Create a flat selection pool based on weights
    const selectionPool: string[][] = [];
    if (rhythmPatterns && rhythmPatterns.length > 0) {
      rhythmPatterns.forEach(item => {
        for (let i = 0; i < item.weight; i++) {
          selectionPool.push(item.pattern);
        }
      });
    } else {
      // Fallback if no patterns provided
      selectionPool.push(['q']);
    }

    // Generate rhythm
    // Generate rhythm

    // We use 4/4 time signature
    // Track accidental state per measure during generation to insert explicit naturals
    const measureAccidentals = new Map<string, string>(); // 'F' -> '#', 'B' -> 'b', etc.
    const TICKS_PER_MEASURE = PPQ * 4;

    for (let m = 0; m < measureCount; m++) {
      let currentMeasureTicks = 0;
      measureAccidentals.clear(); // Reset for new measure

      let measureAttempts = 0;
      const MAX_MEASURE_ATTEMPTS = 500;

      while (currentMeasureTicks < TICKS_PER_MEASURE) {
        measureAttempts++;
        if (measureAttempts > MAX_MEASURE_ATTEMPTS) {
          console.warn(`[MusicGenerator] Failed to fill measure ${m + 1}, stopping early.`);
          break;
        }

        const pattern = selectionPool[Math.floor(Math.random() * selectionPool.length)];

        // Calculate pattern duration in TICKS
        let patternTicks = 0;
        for (const p of pattern) {
          const t = getTicks(p);
          // console.log(`Debug: ${p} = ${t} ticks`);
          patternTicks += t;
        }

        // Check if pattern fits in remaining measure
        if (currentMeasureTicks + patternTicks <= TICKS_PER_MEASURE) {
          // Generate notes for this pattern
          pattern.forEach(duration => {
            if (duration.endsWith('r')) {
              notes.push({ keys: ["b/4"], duration });
            } else {
              const noteData = this.createNote(range, duration, lastMidi, maxInterval, accidentalChance, scaleNotes);

              // --- INTELLIGENT ACCIDENTAL HANDLING ---
              // Check if we need to enforce a natural sign based on previous accidentals in this measure
              let finalKey = noteData.note.keys[0]; // e.g., "c#/4" or "d/4"
              const parts = finalKey.split('/');
              const noteName = parts[0]; // "c#"
              const octave = parts[1];

              const baseLetter = noteName.charAt(0).toUpperCase();
              const isSharp = noteName.includes('#');
              const isFlat = noteName.includes('b');
              const isNatural = !isSharp && !isFlat;

              // Update context and force natural if needed
              if (isSharp) {
                measureAccidentals.set(baseLetter, '#');
              } else if (isFlat) {
                measureAccidentals.set(baseLetter, 'b');
              } else if (isNatural) {
                // It's a natural note.
                const hasExplicitNatural = noteName.endsWith('n');
                const cleanNoteName = noteName.replace('n', '');

                // Check if we need to force a natural sign due to MEASURE CONTEXT
                if (measureAccidentals.has(baseLetter)) {
                  const prevAccidental = measureAccidentals.get(baseLetter);
                  // If previous was NOT natural (or implies different state), we need n
                  if (prevAccidental !== 'n') {
                    // Only add 'n' if not already present
                    if (!hasExplicitNatural) {
                      finalKey = `${cleanNoteName}n/${octave}`;
                      // Update note keys
                      noteData.note.keys = [finalKey];
                    }
                    // Update state
                    measureAccidentals.set(baseLetter, 'n');
                  }
                } else {
                  // No context in measure yet.
                  // Usually createNote handles Key Signature conflicts by adding 'n'
                  // Just record that we are natural now
                  measureAccidentals.set(baseLetter, 'n');
                }
              }
              notes.push(noteData.note);
              lastMidi = noteData.midi;
            }
          });

          // UPDATE TICKS
          currentMeasureTicks += patternTicks;
          measureAttempts = 0; // Reset attempts on success
        }
      }
    }

    // Commented out old loop logic since we integrated generation into the measure loop
    /*
    rhythmNotes.forEach(rhythmNote => {
       ...
    });
    */

    return { notes, selectedKey };
  }

  private static createNote(range: { note: string; midi: number }[], duration: string, lastMidi: number | null, maxInterval: number, accidentalChance: number, scaleNotes: string[]): { note: GeneratedNote, midi: number } {
    let selectedNote = lastMidi === null ? range[Math.floor(Math.random() * range.length)] : (() => {
      const valid = range.filter(n => Math.abs(n.midi - lastMidi) <= maxInterval);
      if (valid.length === 0) return range[Math.floor(Math.random() * range.length)];
      const diff = valid.filter(n => n.midi !== lastMidi);
      return diff.length > 0 && Math.random() < 0.8 ? diff[Math.floor(Math.random() * diff.length)] : valid[Math.floor(Math.random() * valid.length)];
    })();

    let finalMidi = selectedNote.midi;
    let appliedAccidental = false;
    let accidentalDirection = 0;

    if (Math.random() * 100 < accidentalChance) {
      accidentalDirection = Math.random() < 0.5 ? -1 : 1;
      finalMidi += accidentalDirection;
      appliedAccidental = true;
    }

    let vfKey: string;
    if (appliedAccidental) {
      const finalOctave = Math.floor(finalMidi / 12) - 1;
      const finalPitchClass = finalMidi % 12;

      const finalNoteInScale = scaleNotes.find(scaleNote => {
        const scaleMidi = Note.midi(scaleNote + '4');
        return scaleMidi !== null && (scaleMidi % 12) === finalPitchClass;
      });

      if (finalNoteInScale) {
        vfKey = `${finalNoteInScale.toLowerCase()}/${finalOctave}`;
      } else {
        // The note is chromatic (not in scale).
        // Let's get its standard name from MIDI
        const standardName = Note.fromMidi(finalMidi); // e.g. "C#4", "Db4", "F4"
        if (!standardName) {
          // Fallback
          vfKey = `b/${finalOctave}`;
        } else {
          const simplified = Note.simplify(standardName); // "C#4"
          let letter = simplified.charAt(0);
          let accidental = simplified.includes('#') ? '#' : simplified.includes('b') ? 'b' : '';

          // Check for ENHARMONIC spelling preference based on Key Signature?
          // For now, let's trust Note.fromMidi, but force 'n' if it's natural

          const isNatural = accidental === '';

          if (isNatural) {
            // It is a natural note (e.g. G).
            // Does the scale have an altered version of this letter? (e.g. key has G# or Gb)
            const scaleHasAlteration = scaleNotes.some(s => s.startsWith(letter) && (s.includes('#') || s.includes('b')));

            if (scaleHasAlteration) {
              accidental = 'n'; // Force natural sign (Gn)
            }
          }

          vfKey = `${letter.toLowerCase()}${accidental}/${finalOctave}`;
        }
      }
    } else {
      const [noteName, octaveStr] = selectedNote.note.split(/(?=\d)/);
      vfKey = `${noteName.toLowerCase()}/${octaveStr}`;
    }

    return { note: { keys: [vfKey], duration }, midi: finalMidi };
  }
}
