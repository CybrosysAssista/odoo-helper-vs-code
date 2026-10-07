/** Offsets of every `\n` in `text`, for {@link lineAt}. */
export function newlineOffsets(text: string): number[] {
    const offsets: number[] = [];
    for (let i = text.indexOf('\n'); i !== -1; i = text.indexOf('\n', i + 1)) {
        offsets.push(i);
    }
    return offsets;
}

/** Converts a character offset into a 0-based line number, given the offsets of every newline. */
export function lineAt(newlines: number[], offset: number): number {
    let low = 0, high = newlines.length;
    while (low < high) {
        const mid = (low + high) >> 1;
        if (newlines[mid] < offset) {
            low = mid + 1;
        } else {
            high = mid;
        }
    }
    return low;
}
