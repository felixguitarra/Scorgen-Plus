# INSTRUÇÕES DE RECUPERAÇÃO - ACIDENTES E TERCINAS

Este documento contém todo o código e lógica que foram implementados nas sessões de 05/12 e 06/12, recuperados da memória do assistente.

## 1. Módulo de Rastreamento de Acidentes (NOVO ARQUIVO)

Crie o arquivo: `src/engine/AccidentalTracking.ts`

```typescript
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
```

## 2. Integração no `src/components/PlayerControls.tsx`

Estas são as mudanças para fazer o playback respeitar os acidentes:

1.  **Imports:**
    ```typescript
    import { createAccidentalState, resetMeasureState, getAccidentalOffset } from '../engine/AccidentalTracking';
    ```

2.  **Variáveis de Estado (dentro de handlePlay):**
    ```typescript
    let currentMeasureTicks = 0;
    const accidentalState = createAccidentalState(keySignature);
    ```

3.  **Lógica no loop de notas:**
    Sempre que `currentMeasureTicks` atingir 1920 (fim do compasso 4/4 com PPQ novo):
    ```typescript
    resetMeasureState(accidentalState);
    currentMeasureTicks = 0;
    ```
    
    Ao pular notas (pausas/erros), lembre-se de incrementar `currentMeasureTicks`.

4.  **Cálculo do MIDI:**
    Substituir lógica antiga por:
    ```typescript
    const accidentalOffset = getAccidentalOffset(noteKey.split('/')[0], accidentalState);
    const midiNumber = TonalNote.midi(normalizedNote + octave) + accidentalOffset; // Ajuste conforme sua lógica de oitava
    ```
    *Nota: A lógica exata de `getAccidentalOffset` já retorna o valor correto (-1, 0, 1) baseado no estado.*

## 3. Correção Visual no `src/components/ScoreDisplay.tsx`

Para corrigir o bug dos bequadros que não apareciam:

1.  **Cálculo do PitchClass (Correção Crítica):**
    ```typescript
    const notePart = parts[0];
    // Remove 'n' suffix before calculating pitch class
    const noteForPitchClass = notePart.replace(/n$/i, '');
    const pitchClass = Note.pitchClass(Note.simplify(noteForPitchClass + '4'));
    ```

2.  **Rastreamento Visual:**
    Certifique-se que acidentes da armadura também atualizem o `measureAccidentals` (o Map local do ScoreDisplay), mesmo que não desenhem o acidente na tela. Isso garante que bequadros futuros saibam que precisam aparecer.

```typescript
if (noteWithAccidentalInKey) {
  // Track it even if not displaying, so naturals work correctly
  measureAccidentals.set(pitchClass, '#'); // ou 'b' dependendo do caso
}
```

## 4. Sobre Tercinas e PPQ

1.  **PPQ:** Havíamos padronizado o PPQ em **480** (padrão da indústria) para lidar melhor com divisões complexas.
2.  **Remoção de Sextinas:** As sextinas (`16t`) foram removidas do `rhythmTemplates.json` porque estavam instáveis visualmente, mas as tercinas (`8t`) foram mantidas e funcionavam bem.

---
**Próximos Passos Sugeridos:**
1. Eu posso recriar o arquivo `AccidentalTracking.ts` imediatamente para você.
2. Depois aplicamos as correções no `PlayerControls.tsx`.
3. Por fim, corrigimos o `ScoreDisplay.tsx`.
