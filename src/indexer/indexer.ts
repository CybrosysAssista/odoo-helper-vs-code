import * as vscode from 'vscode';
import { IndexerClient } from './client';
import type { FileRequest, FileResult } from './protocol';
import { yieldIfBusy } from '../utils/indexing';

const BATCH_SIZE = 200;

let client: IndexerClient | undefined;

/** Starts the background indexer for this extension; disposed with the extension. */
export function initIndexer(context: vscode.ExtensionContext) {
    client = new IndexerClient(context.extensionPath, yieldIfBusy);
    context.subscriptions.push({ dispose: () => client?.dispose() });
}

/**
 * Has `items` stat'ed, and parsed when changed, by the background indexer, in batches. `apply` gets
 * each result on the extension host, with a yield whenever the current slice of time is used up.
 */
export async function indexFiles(
    items: FileRequest[],
    apply: (result: FileResult) => void,
    progress?: { report(value: { message?: string }): void; label: string }
): Promise<void> {
    if (!client) {
        return;
    }
    // The next batch is parsed in the background while this one is applied.
    const request = (start: number) => client!.process(items.slice(start, start + BATCH_SIZE));
    let pending = request(0);
    for (let start = 0; start < items.length; start += BATCH_SIZE) {
        if (progress) {
            progress.report({ message: `${progress.label}: ${Math.min(start + BATCH_SIZE, items.length)}/${items.length}` });
        }
        const results = await pending;
        if (start + BATCH_SIZE < items.length) {
            pending = request(start + BATCH_SIZE);
        }
        for (const result of results) {
            apply(result);
            await yieldIfBusy();
        }
    }
}
