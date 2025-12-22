import { useEffect, useRef, type FC } from 'react';
import { Renderer, Stave, StaveNote, Formatter, Voice, Beam, Dot, Tuplet } from 'vexflow';

interface RhythmPatternPreviewProps {
    pattern: string[];
}

export const RhythmPatternPreview: FC<RhythmPatternPreviewProps> = ({ pattern }) => {
    const containerRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (!containerRef.current) return;

        containerRef.current.innerHTML = '';

        try {
            const renderer = new Renderer(containerRef.current, Renderer.Backends.SVG);

            const noteCount = pattern.length;
            const width = Math.max(100, noteCount * 30 + 30);
            const height = 85;
            renderer.resize(width, height);

            const context = renderer.getContext();
            // Scale down by 10% as requested
            context.scale(0.9, 0.9);

            const stave = new Stave(10, -5, width - 20);
            stave.setContext(context);

            const tuplets: Tuplet[] = [];
            let tripletBuffer: StaveNote[] = [];

            // Convert pattern to VexFlow notes
            const notes: StaveNote[] = pattern.map((duration) => {
                const isRest = duration.endsWith('r');
                const isDotted = duration.includes('d');
                const isTuplet = duration.includes('t');
                const baseDuration = duration.replace('r', '').replace('d', '').replace('t', '');

                let vfDuration = baseDuration;
                if (baseDuration === '8') vfDuration = '8';
                else if (baseDuration === '16') vfDuration = '16';
                else if (baseDuration === 'q') vfDuration = 'q';
                else if (baseDuration === 'h') vfDuration = 'h';
                else if (baseDuration === 'w') vfDuration = 'w';

                const note = new StaveNote({
                    keys: ['a/4'],
                    duration: `${vfDuration}${isRest ? 'r' : ''}`,
                    clef: 'percussion',
                    stemDirection: 1
                });

                if (isTuplet) {
                    const currentTicks = (note as any).getTicks();
                    const newTicks = currentTicks.clone().multiply(2, 3);
                    // Override getTicks for layout
                    (note as any).getTicks = () => newTicks;

                    tripletBuffer.push(note);
                    if (tripletBuffer.length === 3) {
                        const tuplet = new Tuplet(tripletBuffer);
                        tuplets.push(tuplet);
                        tripletBuffer = [];
                    }
                } else {
                    tripletBuffer = [];
                }

                if (isDotted) {
                    const dot = new Dot();
                    note.addModifier(dot, 0);
                }

                return note;
            });

            const voice = new Voice({ numBeats: 4, beatValue: 4 });
            voice.setStrict(false);
            voice.addTickables(notes);

            // Use Beam.generateBeams like ScoreDisplay does, but ignore notes that are already in tuplets logic?
            // Actually, VexFlow tuplet logic might clash with beams if handled twice?
            // Beam.generateBeams works on array of notes. 
            // If they are 'qt', no beams. If '8t', beams.
            const beams = Beam.generateBeams(notes.filter(n => !n.getDuration().includes('q')), {
                beamRests: false,
                beamMiddleOnly: false,
                showStemlets: false
            });

            new Formatter().joinVoices([voice]).format([voice], width - 30);
            voice.draw(context, stave);

            // Draw generated beams
            beams.forEach(beam => beam.setContext(context).draw());

            // Draw tuplets
            tuplets.forEach(t => t.setContext(context).draw());

        } catch (error) {
            console.error('Error rendering rhythm pattern:', error);
            if (containerRef.current) {
                containerRef.current.innerHTML = `<span style="font-family: monospace; font-size: 0.7rem;">${JSON.stringify(pattern)}</span>`;
            }
        }
    }, [pattern]);

    return (
        <div
            ref={containerRef}
            style={{
                width: '100%',
                height: '85px',
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'center',
                transform: 'scale(0.9)',
                transformOrigin: 'center center'
            }}
        />
    );
};
