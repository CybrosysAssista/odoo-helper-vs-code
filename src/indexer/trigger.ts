/**
 * Indexing starts a few seconds after the window opens, or as soon as an editor feature needs an
 * index, whichever comes first. Index getters call {@link indexNeeded}.
 */
let trigger: () => void = () => { };

export function setIndexTrigger(start: () => void) {
    trigger = start;
}

export function indexNeeded() {
    trigger();
}
