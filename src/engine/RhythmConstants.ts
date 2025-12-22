export const PPQ = 480;

export function getTicks(duration: string): number {
    const ticksPerQuarter = PPQ;

    // Handle basic durations
    let baseTicks = 0;
    let multiplier = 1;

    // Remove modifiers to identify base duration
    let cleanDuration = duration.replace('d', '').replace('t', '').replace('r', '');

    switch (cleanDuration) {
        case 'w': baseTicks = ticksPerQuarter * 4; break;
        case 'h': baseTicks = ticksPerQuarter * 2; break;
        case 'q': baseTicks = ticksPerQuarter; break;
        case '8': baseTicks = ticksPerQuarter / 2; break;
        case '16': baseTicks = ticksPerQuarter / 4; break;
        case '32': baseTicks = ticksPerQuarter / 8; break;
        default: return 0;
    }

    // Handle dotted notes (add 50%)
    if (duration.includes('d')) {
        multiplier *= 1.5;
    }

    // Handle triplets (2/3 of normal duration)
    // 8t means 3 notes in the space of 2 eighth notes
    // So each note is 2/3 of an eighth note
    if (duration.includes('t')) {
        multiplier *= (2 / 3);
    }

    return Math.round(baseTicks * multiplier);
}
