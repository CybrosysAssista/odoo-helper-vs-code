import * as path from 'path';
import * as fs from 'fs';
import * as vscode from 'vscode';
import moduleIndexService from './moduleIndexService';
import { EXCLUDE_GLOB, FileChange, FileMetadata, watchFiles } from '../utils/indexing';
import { indexFiles } from '../indexer/indexer';
import type { FileResult } from '../indexer/protocol';
import type { ParsedPythonFile } from '../parsing/python';
import { indexNeeded } from '../indexer/trigger';

export interface ModelInfo {
    modelName: string;
    moduleName: string;
    className: string;
    filePath: string;
    line: number;
    character: number;
    isInherited: boolean;
    moduleDepends: string[];
}

/** A Python file that was parsed again, with what it declares now (nothing if it left a module). */
export interface ParsedFileEvent {
    filePath: string;
    models: ModelInfo[];
    parsed: ParsedPythonFile;
}

const NOTHING: ParsedPythonFile = { models: [], fields: [], functions: [] };

/**
 * Bumped when parsing changes in a way that makes saved results wrong. A saved index from another
 * version keeps answering until every file has been parsed again (fields and functions included,
 * since they are parsed from the same pass).
 */
const STATE_VERSION = 2;

class ModelIndexService {
    private modelCache: Map<string, ModelInfo[]>; // modelName -> ModelInfo[] (since multiple modules can inherit/define)
    private fileModels: Map<string, ModelInfo[]>; // filePath -> ModelInfo[] declared in that file
    private fileMetadata: Map<string, FileMetadata>; // filePath -> metadata
    private watcher: vscode.Disposable | null;
    private isIndexing: boolean = false;
    private modelNames: string[] | null = null;
    private dirty = false;
    private _version = 0;
    private _onDidDeleteFile = new vscode.EventEmitter<vscode.Uri>();
    public readonly onDidDeleteFile = this._onDidDeleteFile.event;

    /**
     * Fired for every Python file parsed again, so the field and function indexes take their part
     * of the same parse. Also fired when a file now declares nothing, so they drop its old entries.
     */
    private _onDidParseFile = new vscode.EventEmitter<ParsedFileEvent>();
    public readonly onDidParseFile = this._onDidParseFile.event;

    constructor() {
        this.modelCache = new Map();
        this.fileModels = new Map();
        this.fileMetadata = new Map();
        this.watcher = null;
    }

    initialize() {
        this.watcher = watchFiles('**/*.py', changes => this.applyChanges(changes));
    }

    private async applyChanges(changes: Map<string, FileChange>) {
        if (!this.isCoreIndexingEnabled()) {
            return;
        }
        const changed: string[] = [];
        for (const [fsPath, change] of changes) {
            if (change === 'deleted') {
                this.removeFile(vscode.Uri.file(fsPath));
            } else {
                changed.push(fsPath);
            }
        }
        await this.indexPaths(changed);
    }

    private isCoreIndexingEnabled(): boolean {
        return vscode.workspace.getConfiguration('cybrosys-assista-odoo-helper').get<boolean>('indexing.enableCoreIndexing', true);
    }

    /** Has the background indexer parse the files that changed since they were last indexed. */
    /** Parses the files under `dir` again: a module was created or removed there, so they now belong to a different module. */
    public reindexUnder(dir: string): Promise<void> {
        const prefix = dir.endsWith(path.sep) ? dir : dir + path.sep;
        const paths = [...this.fileMetadata.keys()].filter(file => file.startsWith(prefix));
        paths.forEach(file => this.fileMetadata.delete(file));
        return this.indexPaths(paths);
    }

    private indexPaths(paths: string[], progress?: vscode.Progress<{ message?: string; increment?: number }>) {
        return indexFiles(
            paths.map(path => ({ path, kind: 'python' as const, meta: this.fileMetadata.get(path) })),
            result => this.applyResult(result),
            progress && { report: value => progress.report(value), label: 'Models' }
        );
    }

    async buildCache(progress?: vscode.Progress<{ message?: string; increment?: number }>) {
        if (this.isIndexing || !this.isCoreIndexingEnabled()) return;
        this.isIndexing = true;

        try {
            // One search for the whole workspace; the indexer works out each file's module.
            const pythonFiles = await vscode.workspace.findFiles('**/*.py', EXCLUDE_GLOB);
            const seen = new Set(pythonFiles.map(file => file.fsPath));
            await this.indexPaths([...seen], progress);

            // Drop files that no longer exist.
            for (const filePath of [...this.fileMetadata.keys()]) {
                if (!seen.has(filePath) && !fs.existsSync(filePath)) {  // a file the watcher added meanwhile stays
                    this.removeFile(vscode.Uri.file(filePath));
                }
            }
        } finally {
            this.isIndexing = false;
        }
    }

    private applyResult(result: FileResult) {
        if (result.status === 'missing') {
            this.removeFile(vscode.Uri.file(result.path));
            return;
        }
        if (result.status !== 'parsed') {
            if (result.status === 'error') {
                console.error(`[ModelIndex] Error indexing file ${result.path}: ${result.message}`);
            }
            return;
        }
        this.removeFileEntries(result.path);
        const parsed = result.module && result.python ? result.python : NOTHING;
        const moduleName = result.module ?? '';
        const moduleDepends = moduleIndexService.getModuleInfo(moduleName)?.depends || [];
        const models: ModelInfo[] = parsed.models.map(model => ({ ...model, moduleName, filePath: result.path, moduleDepends }));
        this.addFileModels(result.path, models);
        this.fileMetadata.set(result.path, result.meta);
        this.changed();
        this._onDidParseFile.fire({ filePath: result.path, models, parsed });
    }

    private addFileModels(filePath: string, models: ModelInfo[]) {
        if (models.length === 0) return;
        this.fileModels.set(filePath, models);
        for (const model of models) {
            const existing = this.modelCache.get(model.modelName);
            if (existing) {
                existing.push(model);
            } else {
                this.modelCache.set(model.modelName, [model]);
            }
        }
    }

    private removeFile(uri: vscode.Uri) {
        const known = this.fileMetadata.delete(uri.fsPath);
        if (this.removeFileEntries(uri.fsPath) || known) {
            this.changed();
            this._onDidDeleteFile.fire(uri);
        }
    }

    /** Removes the models declared in `filePath`. Cost is proportional to that file's models only. */
    private removeFileEntries(filePath: string): boolean {
        const models = this.fileModels.get(filePath);
        if (!models) return false;
        this.fileModels.delete(filePath);
        for (const model of models) {
            const list = this.modelCache.get(model.modelName);
            if (!list) continue;
            const filtered = list.filter(m => m.filePath !== filePath);
            if (filtered.length === 0) {
                this.modelCache.delete(model.modelName);
            } else {
                this.modelCache.set(model.modelName, filtered);
            }
        }
        this.changed();
        return true;
    }

    private changed() {
        this.modelNames = null;
        this.dirty = true;
        this._version++;
    }

    /** Increases on every change, so callers can cheaply tell whether derived data is stale. */
    public get version(): number {
        return this._version;
    }

    public isDirty(): boolean {
        return this.dirty;
    }

    /** For an extension (`_inherit` only): the module it extends, among the ones it depends on. */
    public resolveInheritedModule(modelInfo: ModelInfo): string | undefined {
        if (!modelInfo.isInherited) return undefined;
        const allModulesDefiningModel = this.getModelsByName(modelInfo.modelName).map(m => m.moduleName);
        const currentModuleInfo = moduleIndexService.getModuleInfo(modelInfo.moduleName);
        if (!currentModuleInfo || !currentModuleInfo.depends) return undefined;
        // Find a module that exists in both the model definitions and the current module's dependencies
        const inherited = currentModuleInfo.depends.find((dep: string) => allModulesDefiningModel.includes(dep));
        // Fallback: if not found in direct dependencies, it might be core 'base' if we only have one other definition
        if (!inherited && allModulesDefiningModel.length === 2) {
            return allModulesDefiningModel.find(m => m !== modelInfo.moduleName);
        }
        return inherited;
    }

    public getModelsByName(modelName: string): ModelInfo[] {
        indexNeeded();
        return this.modelCache.get(modelName) || [];
    }

    public getAllModelNames(): string[] {
        indexNeeded();
        if (!this.modelNames) {
            this.modelNames = Array.from(this.modelCache.keys());
        }
        return this.modelNames;
    }

    public getAllModels(): ModelInfo[] {
        indexNeeded();
        const all: ModelInfo[] = [];
        for (const models of this.modelCache.values()) {
            all.push(...models);
        }
        return all;
    }

    public getModelsByFile(filePath: string): ModelInfo[] {
        return this.fileModels.get(filePath) || [];
    }

    public getState() {
        this.dirty = false;
        // `moduleDepends` is the module's own depends list; it is restored from the module index on
        // load instead of being written out once per model.
        return {
            version: STATE_VERSION,
            models: Array.from(this.modelCache.entries(), ([name, models]) =>
                [name, models.map(({ moduleDepends, ...rest }) => rest)]),
            metadata: Array.from(this.fileMetadata.entries())
        };
    }

    /** Call after the module index has loaded its state, so `moduleDepends` can be restored. */
    public loadState(state: any) {
        try {
            let entries: [string, ModelInfo[]][] = [];
            if (Array.isArray(state)) {
                // Old format: direct array
                entries = state;
            } else if (state && typeof state === 'object') {
                // New format: { models: [], metadata: [] }
                if (Array.isArray(state.models)) {
                    entries = state.models;
                }
                // Metadata from another version is dropped, so every file is parsed again.
                if (Array.isArray(state.metadata) && state.version === STATE_VERSION) {
                    this.fileMetadata = new Map(state.metadata);
                }
            }
            this.modelCache = new Map();
            this.fileModels = new Map();
            const byFile = new Map<string, ModelInfo[]>();
            for (const [, models] of entries) {
                for (const model of models) {
                    model.moduleDepends = moduleIndexService.getModuleInfo(model.moduleName)?.depends || model.moduleDepends || [];
                    const list = byFile.get(model.filePath);
                    if (list) {
                        list.push(model);
                    } else {
                        byFile.set(model.filePath, [model]);
                    }
                }
            }
            for (const [filePath, models] of byFile) {
                this.addFileModels(filePath, models);
            }
        } catch (e) {
            console.error('[ModelIndex] Failed to load state:', e);
            this.modelCache = new Map();
            this.fileModels = new Map();
            this.fileMetadata = new Map();
        }
        this.modelNames = null;
        this._version++;
    }

    public dispose() {
        if (this.watcher) {
            this.watcher.dispose();
        }
    }
}

const modelIndexService = new ModelIndexService();
export default modelIndexService;
