// Helper functions for accidental state tracking in playback

export interface AccidentalState {
    measureState: Map<string, number>;
    keyAccidentals: Record<string, number>;
}

// Key signature to accidentals mapping
const KEY_SIGNATURE_MAP: Record<string, Record<string, number>> = {
    'C': {},
    'G': { 'F': 1 },
    'D': { 'F': 1, 'C': 1 },
    'A': { 'F': 1, 'C': 1, 'G': 1 },
    'E': { 'F': 1, 'C': 1, 'G': 1, 'D': 1 },
    'B': { 'F': 1, 'C': 1, 'G': 1, 'D': 1, 'A': 1 },
    'F#': { 'F': 1, 'C': 1, 'G': 1, 'D': 1, 'A': 1, 'E': 1 },
    'F': { 'B': -1 },
    'Bb': { 'B': -1, 'E': -1 },
    'Eb': { 'B': -1, 'E': -1, 'A': -1 },
    'Ab': { 'B': -1, 'E': -1, 'A': -1, 'D': -1 },
    'Db': { 'B': -1, 'E': -1, 'A': -1, 'D': -1, 'G': -1 },
};

export function createAccidentalState(keySignature: string): AccidentalState {
    return {
        measureState: new Map<string, number>(),
        keyAccidentals: KEY_SIGNATURE_MAP[keySignature] || {}
    };
}

export function resetMeasureState(state: AccidentalState): void {
    state.measureState.clear();
}

export function getAccidentalOffset(
    notePart: string,
    state: AccidentalState
): number {
    const baseLetter = notePart.charAt(0).toUpperCase();
    let accidentalOffset = 0;

    // Check if this note's accidental is part of the key signature
    const keyHasThisAccidental = state.keyAccidentals[baseLetter] !== undefined;

    // Check for explicit accidental in the note
    // Order matters: check natural first, then sharp, then flat
    if (notePart.endsWith('n') || notePart.includes('n')) {
        // Natural sign - ALWAYS an explicit accidental (cancels key signature)
        accidentalOffset = 0;
        state.measureState.set(baseLetter, 0);
    } else if (notePart.includes('#')) {
        // Sharp - check if it's from key signature or explicit
        if (keyHasThisAccidental && state.keyAccidentals[baseLetter] === 1) {
            // This sharp is from the key signature
            // But check measure state first - it might have been overridden
            if (state.measureState.has(baseLetter)) {
                accidentalOffset = state.measureState.get(baseLetter)!;
            } else {
                accidentalOffset = 1;
            }
        } else {
            // Explicit sharp (not in key)
            accidentalOffset = 1;
            state.measureState.set(baseLetter, 1);
        }
    } else if (notePart.length > 1 && notePart.charAt(1) === 'b') {
        // Flat - check if it's from key signature or explicit
        if (keyHasThisAccidental && state.keyAccidentals[baseLetter] === -1) {
            // This flat is from the key signature
            // But check measure state first - it might have been overridden
            if (state.measureState.has(baseLetter)) {
                accidentalOffset = state.measureState.get(baseLetter)!;
            } else {
                accidentalOffset = -1;
            }
        } else {
            // Explicit flat (not in key)
            accidentalOffset = -1;
            state.measureState.set(baseLetter, -1);
        }
    } else {
        // No explicit accidental - check measure state, then key signature
        if (state.measureState.has(baseLetter)) {
            accidentalOffset = state.measureState.get(baseLetter)!;
        } else if (state.keyAccidentals[baseLetter] !== undefined) {
            accidentalOffset = state.keyAccidentals[baseLetter];
        }
    }

    return accidentalOffset;
}
