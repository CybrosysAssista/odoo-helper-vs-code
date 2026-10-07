import { ChildProcess, fork } from 'child_process';
import * as os from 'os';
import * as path from 'path';
import { FileProcessor } from './fileProcessor';
import type { FileRequest, FileResult, WorkerResponse } from './protocol';

/** The process is stopped after this long without work; it restarts on the next request. */
const IDLE_TIMEOUT_MS = 60_000;
/** After this many crashes in a row, parsing moves into the extension host for the session. */
const MAX_CRASHES = 3;

/**
 * Hands parsing to a background process (`worker.ts`) running at the lowest CPU priority. Parsing
 * then never competes with typing, completion or anything else on the extension host's thread, and
 * tree-sitter's memory, which never shrinks, is given back whenever the process stops.
 *
 * If the process can't be started or keeps crashing, files are parsed in the extension host
 * instead, yielding between files, so the features keep working.
 */
export class IndexerClient {
    private child: ChildProcess | undefined;
    private nextId = 1;
    private readonly pending = new Map<number, { resolve: (results: FileResult[]) => void; reject: (error: Error) => void }>();
    private idleTimer: NodeJS.Timeout | undefined;
    private crashes = 0;
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
        // A crashed process is restarted and the batch retried, up to MAX_CRASHES times in a row.
        while (this.crashes < MAX_CRASHES) {
            const crashesBefore = this.crashes;
            try {
                return await this.processInChild(items);
            } catch (error) {
                console.error('[OdooIndexer] Background indexer failed:', error);
                if (this.crashes === crashesBefore) {
                    break; // It answered with an error rather than crashing: parse this batch here.
                }
            }
        }
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
        child.on('exit', (code, signal) => this.onExit(child, code, signal));
        child.on('error', error => this.onExit(child, null, null, error));
        child.send({ type: 'init', extensionPath: this.extensionPath });
        this.child = child;
        return child;
    }

    private onResponse(response: WorkerResponse) {
        const entry = this.pending.get(response.id);
        if (!entry) return;
        this.pending.delete(response.id);
        if (response.ok) {
            this.crashes = 0;
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
            // It died with work outstanding: a crash, not an idle stop.
            this.crashes++;
            const failure = error ?? new Error(`Indexer process exited (code ${code}, signal ${signal})`);
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
