import * as vscode from 'vscode';

/**
 * Shared helpers that keep indexing off the critical path of the extension host.
 *
 * Everything this extension does runs on the extension host's single thread, which every other
 * extension (Python, the debugger, completions...) shares. Indexing therefore must never run in long
 * synchronous stretches, must never react to file events one by one, and must skip folders that
 * hold no Odoo code.
 */

/** Folders that never contain Odoo modules: dependencies, virtualenvs, caches, VCS data. */
export const EXCLUDE_GLOB = '**/{node_modules,venv*,.venv*,env,.env,__pycache__,.git,dist,out,build}/**';

/** Same as {@link EXCLUDE_GLOB}, plus bundled third-party front-end libraries (`static/lib`). */
export const EXCLUDE_ASSETS_GLOB = '**/{node_modules,venv*,.venv*,env,.env,__pycache__,.git,dist,out,build,lib}/**';

const IGNORED_SEGMENT_RE = /[\\/](node_modules|\.git|__pycache__|\.?venv[^\\/]*|env|\.env)[\\/]/;
const STATIC_LIB_RE = /[\\/]static[\\/]lib[\\/]/;

/** Whether a file event comes from a folder the indexes never look at. */
export function isIgnoredPath(fsPath: string, assets = false): boolean {
    return IGNORED_SEGMENT_RE.test(fsPath) || (assets && STATIC_LIB_RE.test(fsPath));
}

const SLICE_MS = 8;
let sliceStart = Date.now();

/**
 * Yields to the event loop once the current slice of work has used up its time budget, so a long
 * indexing pass never holds the extension host for more than a few milliseconds at a time.
 */
export async function yieldIfBusy(): Promise<void> {
    if (Date.now() - sliceStart >= SLICE_MS) {
        await new Promise<void>(resolve => setImmediate(resolve));
        sliceStart = Date.now();
    }
}

export type FileChange = 'changed' | 'deleted';

/**
 * Watches `pattern` and delivers changes in batches: events for the same file are coalesced and the
 * batch is handed over once no new event has arrived for `delayMs`. A branch switch or a
 * `pip install` therefore costs one pass over the files that actually changed, not one pass per event.
 */
export function watchFiles(
    pattern: string,
    onBatch: (changes: Map<string, FileChange>) => Promise<void> | void,
    options: { delayMs?: number; assets?: boolean } = {}
): vscode.Disposable {
    const delayMs = options.delayMs ?? 300;
    const pending = new Map<string, FileChange>();
    let timer: NodeJS.Timeout | undefined;
    let running: Promise<void> = Promise.resolve();

    const schedule = (uri: vscode.Uri, change: FileChange) => {
        if (uri.scheme !== 'file' || isIgnoredPath(uri.fsPath, options.assets)) {
            return;
        }
        pending.set(uri.fsPath, change);
        if (timer) {
            clearTimeout(timer);
        }
        timer = setTimeout(() => {
            timer = undefined;
            const batch = new Map(pending);
            pending.clear();
            // Batches run one after another, never concurrently.
            running = running.then(() => onBatch(batch)).catch(error => {
                console.error(`[Indexing] Failed to process changes for ${pattern}:`, error);
            });
        }, delayMs);
    };

    const watcher = vscode.workspace.createFileSystemWatcher(pattern);
    const subscriptions = [
        watcher,
        watcher.onDidCreate(uri => schedule(uri, 'changed')),
        watcher.onDidChange(uri => schedule(uri, 'changed')),
        watcher.onDidDelete(uri => schedule(uri, 'deleted')),
    ];
    return new vscode.Disposable(() => {
        if (timer) {
            clearTimeout(timer);
        }
        subscriptions.forEach(s => s.dispose());
    });
}

export type { FileMetadata } from '../indexer/protocol';
