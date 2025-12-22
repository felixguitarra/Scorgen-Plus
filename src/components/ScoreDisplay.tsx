import { useEffect, useRef } from 'react';
import { Renderer, Stave, Formatter, Voice, StaveNote, Beam, Dot, Accidental, Tuplet } from 'vexflow';
import { Scale, Note } from 'tonal';
import styles from './ScoreDisplay.module.css';
import type { GeneratedNote } from '../engine/MusicGenerator';
import { getTicks, PPQ } from '../engine/RhythmConstants';

interface ScoreDisplayProps {
  notes: GeneratedNote[];
  clef?: "treble" | "bass";
  keySignature?: string;
  timeSignature?: string;
}

export const ScoreDisplay: React.FC<ScoreDisplayProps> = ({
  notes,
  clef = "treble",
  keySignature = "C",
  timeSignature = "4/4"
}) => {
  const containerRef = useRef<HTMLDivElement>(null);

  const getKeySignatureAccidentals = (key: string): number => {
    const sharps = ['G', 'D', 'A', 'E', 'B', 'F#', 'C#'];
    const flats = ['F', 'Bb', 'Eb', 'Ab', 'Db', 'Gb', 'Cb'];

    if (key === 'C') return 0;

    const sharpIndex = sharps.indexOf(key);
    if (sharpIndex !== -1) return sharpIndex + 1;

    const flatIndex = flats.indexOf(key);
    if (flatIndex !== -1) return flatIndex + 1;

    return 0;
  };

  useEffect(() => {
    if (!containerRef.current || notes.length === 0) return;

    containerRef.current.innerHTML = '';

    const renderer = new Renderer(containerRef.current, Renderer.Backends.SVG);
    renderer.resize(1100, 600);
    const context = renderer.getContext();

    // Get scale notes for the key signature
    const scaleNotes = Scale.get(`${keySignature} major`).notes;

    const measures: GeneratedNote[][] = [];
    let currentMeasure: GeneratedNote[] = [];

    // Use standard PPQ ticks for precise measure calculation
    const TICKS_PER_MEASURE = PPQ * 4;
    let currentTicks = 0;

    notes.forEach(note => {
      let ticks = getTicks(note.duration);

      // Handle overflow or exact fit
      if (currentTicks + ticks > TICKS_PER_MEASURE) {
        if (currentMeasure.length > 0) {
          measures.push(currentMeasure);
        }
        currentMeasure = [note];
        currentTicks = ticks;
      } else {
        currentMeasure.push(note);
        currentTicks += ticks;

        if (currentTicks >= TICKS_PER_MEASURE) {
          measures.push(currentMeasure);
          currentMeasure = [];
          currentTicks = 0;
        }
      }
    });

    if (currentMeasure.length > 0) {
      measures.push(currentMeasure);
    }

    const measuresPerLine = 4;
    const lineHeight = 140;
    const startX = 10;
    const startY = 40;
    const totalLineWidth = 1080;

    try {
      for (let lineIndex = 0; lineIndex < Math.ceil(measures.length / measuresPerLine); lineIndex++) {
        const lineMeasures = measures.slice(lineIndex * measuresPerLine, (lineIndex + 1) * measuresPerLine);
        const isFirstLine = lineIndex === 0;
        const yPosition = startY + (lineIndex * lineHeight);

        const voices: Voice[] = [];
        const allBeams: Beam[][] = [];
        const allTuplets: Tuplet[][] = [];
        const staves: Stave[] = [];
        const reservedSpaces: number[] = [];

        lineMeasures.forEach((measureNotes, posInLine) => {
          const isFirstInLine = posInLine === 0;

          let reserved = 15;
          if (isFirstInLine) {
            reserved = 55;
            if (isFirstLine) {
              reserved = 80;
              const keyAccidentals = getKeySignatureAccidentals(keySignature);
              if (keyAccidentals > 0) {
                reserved += 15 + (keyAccidentals * 10);
              }
            }
          }
          reservedSpaces.push(reserved);

          const tempStave = new Stave(0, yPosition, 200);

          if (isFirstInLine) {
            tempStave.addClef(clef);
            if (isFirstLine) {
              tempStave.addTimeSignature(timeSignature);
              tempStave.addKeySignature(keySignature);
            }
          }

          staves.push(tempStave);

          // Track accidentals within this measure
          const measureAccidentals = new Map<string, string>();

          const staveNotes = measureNotes.map(note => {
            let noteKeys = note.keys;

            if (note.duration.endsWith('r') && clef === 'bass') {
              noteKeys = ['d/3'];
            }

            const staveNote = new StaveNote({
              keys: noteKeys,
              duration: note.duration.replace('d', '').replace('t', ''),
              clef: clef,
              dots: note.duration.includes('d') ? 1 : 0
            });

            // FIX TUPLET TICKS: Manual adjustment for VexFlow rendering
            if (note.duration.includes('t')) {
              // Apply 2/3 ratio to ticks so VexFlow formats them correctly in time
              // setTicks doesn't exist, so we modify the property directly.
              // We use getTicks() to get the Fraction, multiply it, and assign it back.
              const currentTicks = (staveNote as any).getTicks();
              const newTicks = currentTicks.clone().multiply(2, 3);

              // Nuclear option: Override the method on this instance
              staveNote.getTicks = () => newTicks;
            }

            if (note.duration.includes('d')) {
              staveNote.addModifier(new Dot(), 0);
            }

            // Apply accidentals intelligently
            noteKeys.forEach((key, index) => {
              // Skip rests
              if (key.startsWith('b/')) {
                return;
              }

              // Parse the note
              const parts = key.split('/');
              if (parts.length !== 2) return;

              const notePart = parts[0]; // e.g., "c#" or "db" or "fn"
              // Remove 'n' suffix before calculating pitch class to avoid empty string for 'bn', 'cn', etc.
              const noteForPitchClass = notePart.replace(/n$/i, '');
              const pitchClass = Note.pitchClass(Note.simplify(noteForPitchClass + '4'));

              // Check for explicit natural sign from generator
              const hasNatural = notePart.endsWith('n');
              const hasSharp = notePart.includes('#');
              const hasFlat = notePart.length > 1 && notePart[1] === 'b' && !hasNatural;

              // Check if this EXACT note (with its accidental) is in the key signature
              const noteWithAccidentalInKey = scaleNotes.some(n => {
                const normalizedScaleNote = Note.simplify(n);
                const normalizedCurrentNote = Note.simplify(notePart.replace('n', ''));
                return normalizedScaleNote === normalizedCurrentNote;
              });

              let accidentalType: string | null = null;

              if (hasNatural) {
                // Explicit natural sign (bequadro) from generator
                if (measureAccidentals.get(pitchClass) !== 'n') {
                  accidentalType = 'n';
                  measureAccidentals.set(pitchClass, 'n');
                }
              } else if (hasSharp) {
                // Only show # if not in key signature and not already shown in measure
                if (!noteWithAccidentalInKey && measureAccidentals.get(pitchClass) !== '#') {
                  accidentalType = '#';
                  measureAccidentals.set(pitchClass, '#');
                } else if (noteWithAccidentalInKey) {
                  // Track key signature accidentals even if not displayed
                  measureAccidentals.set(pitchClass, '#');
                }
              } else if (hasFlat) {
                // Only show b if not in key signature and not already shown in measure
                if (!noteWithAccidentalInKey && measureAccidentals.get(pitchClass) !== 'b') {
                  accidentalType = 'b';
                  measureAccidentals.set(pitchClass, 'b');
                } else if (noteWithAccidentalInKey) {
                  // Track key signature accidentals even if not displayed
                  measureAccidentals.set(pitchClass, 'b');
                }
              } else {
                // Natural note - check if it needs a natural sign (bequadro)
                const keyHasAlteredVersion = scaleNotes.some(n => {
                  const scaleNotePitch = Note.pitchClass(n);
                  return scaleNotePitch === pitchClass && (n.includes('#') || n.includes('b'));
                });

                if (keyHasAlteredVersion && measureAccidentals.get(pitchClass) !== 'n') {
                  accidentalType = 'n';
                  measureAccidentals.set(pitchClass, 'n');
                }
              }

              // Apply the accidental if needed
              if (accidentalType) {
                staveNote.addModifier(new Accidental(accidentalType), index);
              }
            });

            // Tuplet Handling
            // We need to group notes into triplets if they have 't' in duration
            // But here 'notes' is the array of generated notes for the whole measure?
            // YES. `notes` is currentMeasure.notes.

            // Actually, simply adding the StaveNote is enough for the voice ticking,
            // BUT for visual displaying the bracket nicely, we need Vex.Flow.Tuplet.
            // However, since we process map note-by-note here, we can't easily group them inside this map.

            // STRATEGY: 
            // 1. Let the map finish creating all staveNotes.
            // 2. Afterwards, iterate noteData array again to find triplet groups and create VexFlow Tuplets.

            return staveNote;
          });

          // --- TUPLET CREATION LOGIC ---
          // Iterate through the generated notes and corresponding staveNotes to bind triplets
          const measureTuplets: Tuplet[] = [];
          let tripletBuffer: StaveNote[] = [];

          measureNotes.forEach((noteData, index) => {
            if (noteData.duration.includes('t')) {
              if (staveNotes[index]) {
                tripletBuffer.push(staveNotes[index]);
              }

              // If we have 3 notes, make a tuplet
              if (tripletBuffer.length === 3) {
                measureTuplets.push(new Tuplet(tripletBuffer));
                tripletBuffer = [];
              }
            } else {
              // Reset if we encounter a non-triplet note (broken triplet?)
              // Although our generator usually guarantees groups of 3
              tripletBuffer = [];
            }
          });
          allTuplets.push(measureTuplets);


          const voice = new Voice({ numBeats: 4, beatValue: 4 });
          voice.setStrict(false);
          voice.addTickables(staveNotes);
          voices.push(voice);

          // We need to verify if we need to add tuplets to the Context or if VexFlow handles it via the voice/draw
          // VexFlow 3/4 requires drawing tuplets explicitly.
          // We will store them in a list to draw later.
          // We'll attach them to the voice or beam list conceptually for drawing phase.

          // Actually, we usually push tuplets to a separate array to draw them in the final loop
          // We need to define allTuplets array outside


          const beams = Beam.generateBeams(staveNotes, {
            beamRests: false,
            beamMiddleOnly: false,
            showStemlets: false
          });
          allBeams.push(beams);
        });

        // --- ELASTIC LAYOUT LOGIC ---
        // 1. Calculate total reserved space (clefs, keys, time signatures)
        const totalReservedWidth = reservedSpaces.reduce((sum, space) => sum + space, 0);

        // 2. Calculate available space for ACTUAL music notes
        // We use a safe padding (20px total padding)
        const availableForMusic = totalLineWidth - totalReservedWidth - 20;

        // 3. Measure minimum required width for each measure's music
        const formatter = new Formatter();
        const minMusicWidths = voices.map(voice => {
          // VexFlow calculates how much space notes need minimally
          return formatter.joinVoices([voice]).preCalculateMinTotalWidth([voice]);
        });

        const totalMinMusicWidth = minMusicWidths.reduce((sum, w) => sum + w, 0);

        // 4. Distribute available space proportionally
        const widths = lineMeasures.map((_, i) => {
          const reserved = reservedSpaces[i];
          const minMusic = minMusicWidths[i];

          // If totalMinMusicWidth is 0 (empty measures), distribute equally
          const proportion = totalMinMusicWidth > 0
            ? minMusic / totalMinMusicWidth
            : 1 / lineMeasures.length;

          // Final width = Reserved Item Space + Proportional Music Space
          // We ensure at least minMusic space so it doesn't cramp if line is too short
          const allocatedMusicWidth = availableForMusic * proportion;

          // Ensure measure isn't smaller than its content + reserve
          // But strict constraints to totalLineWidth usually overrides this
          return reserved + allocatedMusicWidth;
        });

        let currentX = startX;
        voices.forEach((voice, i) => {
          const stave = staves[i];
          const width = widths[i]; // Elastic width

          stave.setX(currentX);
          stave.setWidth(width);
          stave.setContext(context).draw();

          // Calculate space for notes: Total width - key/clef/time reservation
          // Use a safe padding
          const musicSpace = width - reservedSpaces[i] - 10;

          const voiceFormatter = new Formatter();
          // Align rests prevents weird jumping
          if (voice.getTickables().length > 0) {
            voiceFormatter.joinVoices([voice]).format([voice], Math.max(50, musicSpace));
          }

          voice.draw(context, stave);

          currentX += width;
        });

        allBeams.forEach(beams => {
          beams.forEach(b => b.setContext(context).draw());
        });

        allTuplets.forEach(tuplets => {
          tuplets.forEach(t => t.setContext(context).draw());
        });
      }
    } catch (e) {
      console.error(e);
    }
  }, [notes, clef, keySignature, timeSignature]);

  return <div ref={containerRef} className={styles.container} />;
};
