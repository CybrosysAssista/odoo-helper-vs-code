import { ChildProcess, fork } from 'child_process';
import * as os from 'os';
import * as path from 'path';
import { FileProcessor } from './fileProcessor';
import type { FileRequest, FileResult, WorkerResponse } from './protocol';

/** The process is stopped after this long without work; it restarts on the next request. */
const IDLE_TIMEOUT_MS = 60_000;
/** Worker crashes allowed per session; after that, files that would need the worker are skipped. */
const MAX_CRASHES = 50;

/** The worker process died while it had work. */
class WorkerCrash extends Error { }
/** The worker process could not be started at all. */
class WorkerUnavailable extends Error { }

/**
 * Hands parsing to a background process (`worker.ts`) running at the lowest CPU priority. Parsing
 * then never competes with typing, completion or anything else on the extension host's thread, and
 * tree-sitter's memory, which never shrinks, is given back whenever the process stops.
 *
 * A file that crashes the process (a parser bug on unusual input) is found by splitting the batch
 * and retrying the halves; that one file is then skipped for the session and everything else keeps
 * parsing in the background. Only if the process can't be started at all, or answers with an error,
 * are files parsed in the extension host instead, yielding between files.
 */
export class IndexerClient {
    private child: ChildProcess | undefined;
    private nextId = 1;
    private readonly pending = new Map<number, { resolve: (results: FileResult[]) => void; reject: (error: Error) => void }>();
    private idleTimer: NodeJS.Timeout | undefined;
    private crashes = 0;
    /** Files that crashed the process: skipped for the rest of the session. */
    private readonly crashingFiles = new Set<string>();
    private unavailable = false;
    private inProcess: Promise<FileProcessor> | undefined;
    private disposed = false;

    constructor(
        private readonly extensionPath: string,
        private readonly yieldToEditor: () => Promise<void>,
    ) { }

    async process(items: FileRequest[]): Promise<FileResult[]> {
        if (items.length === 0 || this.disposed) {
            return [];
        }
        const skipped = items.filter(item => this.crashingFiles.has(item.path));
        const results = skipped.map(item => crashedResult(item.path));
        return results.concat(await this.processSafely(skipped.length ? items.filter(item => !this.crashingFiles.has(item.path)) : items));
    }

    private async processSafely(items: FileRequest[]): Promise<FileResult[]> {
        if (items.length === 0 || this.disposed) {
            return [];
        }
        if (this.unavailable) {
            return this.processInExtensionHost(items);
        }
        try {
            return await this.processInChild(items);
        } catch (error) {
            if (error instanceof WorkerUnavailable) {
                console.error('[OdooIndexer] Background indexer unavailable, parsing in the extension host:', error);
                this.unavailable = true;
                return this.processInExtensionHost(items);
            }
            if (!(error instanceof WorkerCrash)) {
                console.error('[OdooIndexer] Background indexer failed:', error);
                return this.processInExtensionHost(items);  // it answered with an error: parse this batch here
            }
            if (++this.crashes > MAX_CRASHES) {
                return items.map(item => crashedResult(item.path));
            }
            if (items.length === 1) {
                console.error(`[OdooIndexer] Skipping ${items[0].path}: it crashes the indexer.`);
                this.crashingFiles.add(items[0].path);
                return [crashedResult(items[0].path)];
            }
            // Find the file that crashed it: retry each half in a fresh process.
            const middle = Math.ceil(items.length / 2);
            const first = await this.processSafely(items.slice(0, middle));
            return first.concat(await this.processSafely(items.slice(middle)));
        }
    }

    private async processInExtensionHost(items: FileRequest[]): Promise<FileResult[]> {
        this.inProcess ??= FileProcessor.create(this.extensionPath);
        return (await this.inProcess).process(items, this.yieldToEditor);
    }

    private processInChild(items: FileRequest[]): Promise<FileResult[]> {
        const child = this.ensureChild();
        const id = this.nextId++;
        this.clearIdleTimer();
        return new Promise<FileResult[]>((resolve, reject) => {
            this.pending.set(id, { resolve, reject });
            child.send({ id, type: 'process', items });
        });
    }

    private ensureChild(): ChildProcess {
        if (this.child) {
            return this.child;
        }
        const child = fork(path.join(__dirname, 'worker.js'), [], {
            execPath: process.execPath,
            execArgv: [],
            env: { ...process.env, ELECTRON_RUN_AS_NODE: '1' },
            stdio: ['ignore', 'ignore', 'pipe', 'ipc'],
        });
        try {
            // Lowest priority: indexing only uses CPU nothing else wants.
            os.setPriority(child.pid!, os.constants.priority.PRIORITY_LOW);
        } catch {
            // Not permitted on this system: run at normal priority.
        }
        child.stderr?.on('data', (chunk: Buffer) => console.error('[OdooIndexer] worker:', chunk.toString()));
        child.on('message', (response: WorkerResponse) => this.onResponse(response));
        let spawned = false;
        child.on('spawn', () => spawned = true);
        child.on('exit', (code, signal) => this.onExit(child, code, signal));
        // Before 'spawn' an error means it could not start; afterwards (e.g. sending to a process
        // that just died) it is treated like the crash it is.
        child.on('error', error => this.onExit(child, null, null, spawned ? undefined : error));
        child.send({ type: 'init', extensionPath: this.extensionPath });
        this.child = child;
        return child;
    }

    private onResponse(response: WorkerResponse) {
        const entry = this.pending.get(response.id);
        if (!entry) return;
        this.pending.delete(response.id);
        if (response.ok) {
            entry.resolve(response.results);
        } else {
            entry.reject(new Error(response.error));
        }
        if (this.pending.size === 0) {
            this.startIdleTimer();
        }
    }

    private onExit(child: ChildProcess, code: number | null, signal: NodeJS.Signals | null, error?: Error) {
        if (this.child !== child) return;
        this.child = undefined;
        this.clearIdleTimer();
        if (this.pending.size > 0) {
            // It died with work outstanding: a crash, or it never started; not an idle stop.
            const failure = error
                ? new WorkerUnavailable(error.message)
                : new WorkerCrash(`Indexer process exited (code ${code}, signal ${signal})`);
            for (const entry of this.pending.values()) {
                entry.reject(failure);
            }
            this.pending.clear();
        }
    }

    private startIdleTimer() {
        this.clearIdleTimer();
        this.idleTimer = setTimeout(() => {
            const child = this.child;
            this.child = undefined;
            child?.kill();
        }, IDLE_TIMEOUT_MS);
    }

    private clearIdleTimer() {
        if (this.idleTimer) {
            clearTimeout(this.idleTimer);
            this.idleTimer = undefined;
        }
    }

    dispose() {
        this.disposed = true;
        this.clearIdleTimer();
        this.child?.kill();
        this.child = undefined;
    }
}

function crashedResult(path: string): FileResult {
    return { path, status: 'error', message: 'Skipped: this file crashes the indexer' };
}
