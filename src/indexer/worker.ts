/**
 * Background indexer process. Started by `IndexerClient` with `ELECTRON_RUN_AS_NODE=1` and the
 * lowest CPU priority, so parsing only ever uses CPU the editor isn't using. Never loads `vscode`.
 */
import { FileProcessor } from './fileProcessor';
import type { InitMessage, ProcessMessage, WorkerResponse } from './protocol';

// Exit with the extension host, whatever the reason it went away.
process.on('disconnect', () => process.exit(0));

let processor: Promise<FileProcessor> | undefined;
let queue: Promise<void> = Promise.resolve();

process.on('message', (message: InitMessage | ProcessMessage) => {
    if (message.type === 'init') {
        processor = FileProcessor.create(message.extensionPath);
        return;
    }
    // One request at a time, in order.
    queue = queue.then(async () => {
        let response: WorkerResponse;
        try {
            if (!processor) {
                throw new Error('Indexer process not initialized');
            }
            response = { id: message.id, ok: true, results: await (await processor).process(message.items) };
        } catch (error) {
            response = { id: message.id, ok: false, error: String(error) };
        }
        process.send?.(response);
    });
});
