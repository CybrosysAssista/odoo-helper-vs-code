import * as path from 'path';
import * as fs from 'fs';
import * as vscode from 'vscode';
import { EXCLUDE_ASSETS_GLOB, FileChange, FileMetadata, watchFiles } from '../utils/indexing';
import { indexFiles } from '../indexer/indexer';
import type { FileResult } from '../indexer/protocol';
import { indexNeeded } from '../indexer/trigger';

export interface RegistryEntry {
    category: string;
    id: string;
    component: string;
    moduleName: string;
    filePath: string;
    line: number;
}

/**
 * Service to index Odoo JavaScript registry registrations
 */

/** Bumped when the parser finds more (or different) registrations, so saved results are refreshed. */
const STATE_VERSION = 2;
export class OdooRegistryIndexer {
    private fileEntries: Map<string, RegistryEntry[]> = new Map(); // filePath -> entries it registers
    private fileMetadata: Map<string, FileMetadata> = new Map();
    private allEntries: RegistryEntry[] | null = null;
    private isScanning: boolean = false;
    private dirty = false;

    /** Keeps the index current as JavaScript files change (bundled `static/lib` code is ignored). */
    initialize(): vscode.Disposable {
        return watchFiles('**/*.js', changes => this.applyChanges(changes), { assets: true });
    }

    private isEnabled(): boolean {
        return vscode.workspace.getConfiguration('cybrosys-assista-odoo-helper').get<boolean>('indexing.enableRegistryIndexing', true);
    }

    private async applyChanges(changes: Map<string, FileChange>) {
        const enabled = this.isEnabled();
        const changed: string[] = [];
        for (const [fsPath, change] of changes) {
            if (change === 'deleted') {
                this.removeFile(vscode.Uri.file(fsPath));
            } else if (enabled) {
                changed.push(fsPath);
            }
        }
        await this.indexPaths(changed);
    }

    /** Parses the files under `dir` again: a module was created or removed there, so they now belong to a different module. */
    public reindexUnder(dir: string): Promise<void> {
        const prefix = dir.endsWith(path.sep) ? dir : dir + path.sep;
        const paths = [...this.fileMetadata.keys()].filter(file => file.startsWith(prefix));
        paths.forEach(file => this.fileMetadata.delete(file));
        return this.indexPaths(paths);
    }

    private indexPaths(paths: string[], progress?: vscode.Progress<{ message?: string; increment?: number }>) {
        return indexFiles(
            paths.map(path => ({ path, kind: 'javascript' as const, meta: this.fileMetadata.get(path) })),
            result => this.applyResult(result),
            progress && { report: value => progress.report(value), label: 'JS Registry' }
        );
    }

    /**
     * Start initial background scan of the workspace
     */
    async scanWorkspace(progress?: vscode.Progress<{ message?: string; increment?: number }>): Promise<void> {
        if (this.isScanning) return;
        this.isScanning = true;

        try {
            const jsFiles = await vscode.workspace.findFiles('**/*.js', EXCLUDE_ASSETS_GLOB);
            const seen = new Set(jsFiles.map(file => file.fsPath));
            await this.indexPaths([...seen], progress);
            for (const filePath of [...this.fileMetadata.keys()]) {
                if (!seen.has(filePath) && !fs.existsSync(filePath)) {  // a file the watcher added meanwhile stays
                    this.removeFile(vscode.Uri.file(filePath));
                }
            }
        } catch (error) {
            console.error('[OdooRegistryIndexer] Scan failed:', error);
        } finally {
            this.isScanning = false;
        }
    }

    private applyResult(result: FileResult) {
        if (result.status === 'missing') {
            this.removeFile(vscode.Uri.file(result.path));
        } else if (result.status === 'parsed') {
            this.removeFile(vscode.Uri.file(result.path));
            if (result.module && result.registry && result.registry.length > 0) {
                const moduleName = result.module;
                this.fileEntries.set(result.path, result.registry.map(call => ({ ...call, moduleName, filePath: result.path })));
                this.allEntries = null;
            }
            this.fileMetadata.set(result.path, result.meta);
            this.dirty = true;
        }
    }

    /**
     * Remove entries for a specific file
     */
    removeFile(uri: vscode.Uri): void {
        if (this.fileEntries.delete(uri.fsPath)) {
            this.allEntries = null;
            this.dirty = true;
        }
        if (this.fileMetadata.delete(uri.fsPath)) {
            this.dirty = true;
        }
    }

    /**
     * Get all registry entries for a specific category
     */
    getEntriesByCategory(category: string): RegistryEntry[] {
        return this.getAllEntries().filter(e => e.category === category);
    }

    /**
     * Find a specific registry entry by ID
     */
    getEntryById(id: string): RegistryEntry | undefined {
        return this.getAllEntries().find(e => e.id === id);
    }

    /**
     * Get all indexed entries
     */
    getAllEntries(): RegistryEntry[] {
        indexNeeded();
        if (!this.allEntries) {
            this.allEntries = ([] as RegistryEntry[]).concat(...this.fileEntries.values());
        }
        return this.allEntries;
    }

    /**
     * Clear the index
     */
    clear(): void {
        this.fileEntries.clear();
        this.allEntries = null;
    }

    isDirty(): boolean {
        return this.dirty;
    }

    getState() {
        this.dirty = false;
        return {
            version: STATE_VERSION,
            entries: this.getAllEntries(),
            metadata: Array.from(this.fileMetadata.entries())
        };
    }

    loadState(state: any) {
        let entries: RegistryEntry[] = [];
        try {
            if (Array.isArray(state)) {
                // Old format: direct array
                entries = state;
            } else if (state && typeof state === 'object') {
                // New format: { entries: [], metadata: [] }
                if (Array.isArray(state.entries)) {
                    entries = state.entries;
                }
                // Metadata from an older parser is dropped, so every file is read again with this one.
                if (Array.isArray(state.metadata) && state.version === STATE_VERSION) {
                    this.fileMetadata = new Map(state.metadata);
                }
            }
        } catch (e) {
            console.error('[OdooRegistryIndexer] Failed to load state:', e);
            this.fileMetadata = new Map();
        }
        this.fileEntries = new Map();
        for (const entry of entries) {
            const list = this.fileEntries.get(entry.filePath);
            if (list) {
                list.push(entry);
            } else {
                this.fileEntries.set(entry.filePath, [entry]);
            }
        }
        this.allEntries = null;
    }
}

// Singleton instance
let indexerInstance: OdooRegistryIndexer | null = null;

export function getOdooRegistryIndexer(): OdooRegistryIndexer {
    if (!indexerInstance) {
        indexerInstance = new OdooRegistryIndexer();
    }
    return indexerInstance;
}
