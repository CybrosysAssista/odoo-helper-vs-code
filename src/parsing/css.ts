import { lineAt, newlineOffsets } from './text';

/**
 * Finds the class names used in the selectors of a stylesheet, with their 1-based line.
 *
 * Only selector text is scanned: the part before each `{`, after the previous `{`, `}` or `;`,
 * found in a single linear pass.
 * That covers nested SCSS rules too, and leaves out declaration values such as `url(img.png)` or
 * `1.5em`. Comments are blanked out first, keeping offsets (and so line numbers) intact.
 */
export function extractCssClasses(text: string): [string, number][] {
    const source = text.replace(/\/\*[\s\S]*?\*\//g, m => m.replace(/[^\n]/g, ' '))
        .replace(/(^|[^:])\/\/[^\n]*/g, (m, p1) => p1 + ' '.repeat(m.length - p1.length));
    const newlines = newlineOffsets(source);
    const found: [string, number][] = [];
    const seen = new Set<string>();
    const classRe = /\.(-?[_a-zA-Z][\w-]*)/g;
    // One linear pass: a selector is the text between the previous `{`, `}` or `;` and the next `{`.
    let segmentStart = 0;
    for (let i = 0; i < source.length; i++) {
        const ch = source.charCodeAt(i);
        if (ch === 0x3B /* ; */ || ch === 0x7D /* } */) {
            segmentStart = i + 1;
        } else if (ch === 0x7B /* { */) {
            const selector = source.slice(segmentStart, i);
            segmentStart = i + 1;
            if (selector.trimStart().startsWith('@') && !selector.includes('.')) {
                continue;
            }
            let match;
            classRe.lastIndex = 0;
            while ((match = classRe.exec(selector)) !== null) {
                const line = lineAt(newlines, i - selector.length + match.index) + 1;
                const key = `${match[1]}:${line}`;
                if (!seen.has(key)) {
                    seen.add(key);
                    found.push([match[1], line]);
                }
            }
        }
    }
    return found;
}
