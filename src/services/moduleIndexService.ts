import * as fs from 'fs';
import * as vscode from 'vscode';
import * as path from 'path';
import { EXCLUDE_GLOB, FileMetadata, watchFiles } from '../utils/indexing';
import { indexFiles } from '../indexer/indexer';
import { OdooModuleUtils } from '../utils/odooModuleUtils';
import { indexNeeded } from '../indexer/trigger';

export interface ModuleInfo {
    id: number;
    name: string;
    path: string;
    depends: string[];
}

const MANIFEST_GLOB = '**/{__manifest__.py,__openerp__.py}';

class ModuleIndexService {
    private moduleCache: Map<string, ModuleInfo> = new Map();
    private modulesByPath: Map<string, string> = new Map(); // module directory -> module name
    private fileMetadata: Map<string, FileMetadata> = new Map();
    private watcher: vscode.Disposable | null = null;
    private initWatcher: vscode.Disposable | null = null;
    private modulesArray: ModuleInfo[] | null = null;
    private reindexing: Promise<void> | null = null;
    private dirty = false;

    private _onDidChange = new vscode.EventEmitter<void>();
    public readonly onDidChange = this._onDidChange.event;
    private _onDidChangeModuleFolders = new vscode.EventEmitter<string[]>();
    /** Folders that became, or stopped being, a module: the files under them change module. */
    public readonly onDidChangeModuleFolders = this._onDidChangeModuleFolders.event;

    constructor() { }

    public initialize() {
        // Only manifests decide what a module is and what it depends on...
        this.watcher = watchFiles(MANIFEST_GLOB, () => this.reindex(), { delayMs: 500 });
        // ...together with the __init__.py next to them: re-check a manifest whose __init__.py
        // appeared or went away.
        this.initWatcher = watchFiles('**/__init__.py', changes => {
            let recheck = false;
            for (const [file, change] of changes) {
                if (change === 'changed') continue;
                for (const name of ['__manifest__.py', '__openerp__.py']) {
                    recheck = this.fileMetadata.delete(path.join(path.dirname(file), name)) || recheck;
                }
            }
            return recheck ? this.reindex() : undefined;
        }, { delayMs: 500 });
    }

    /**
     * Brings the module list up to date. Unchanged manifests (same mtime and size) are not read
     * again, and modules whose manifest has disappeared are dropped.
     */
    public reindex(progress?: vscode.Progress<{ message?: string; increment?: number }>): Promise<void> {
        // Concurrent callers share one pass.
        if (!this.reindexing) {
            this.reindexing = this.doReindex(progress).finally(() => this.reindexing = null);
        }
        return this.reindexing;
    }

    private async doReindex(progress?: vscode.Progress<{ message?: string; increment?: number }>) {
        const foldersBefore = new Set(this.modulesByPath.keys());
        const manifestFiles = await vscode.workspace.findFiles(MANIFEST_GLOB, EXCLUDE_GLOB);
        const found = new Set(manifestFiles.map(uri => uri.fsPath));
        let changed = false;

        await indexFiles(
            [...found].map(path => ({ path, kind: 'manifest' as const, meta: this.fileMetadata.get(path) })),
            result => {
                if (result.status === 'missing') {
                    found.delete(result.path);
                } else if (result.status === 'parsed') {
                    const moduleDir = path.dirname(result.path);
                    // A module also needs an __init__.py next to its manifest.
                    if (result.moduleRoot === moduleDir) {
                        this.setModule({ id: this.moduleCache.size + 1, name: result.module!, path: moduleDir, depends: result.manifest?.depends ?? [] });
                    } else {
                        this.removeModuleAt(moduleDir);
                    }
                    this.fileMetadata.set(result.path, result.meta);
                    changed = true;
                }
            },
            progress && { report: value => progress.report(value), label: 'Modules' }
        );

        // Drop modules whose manifest is gone.
        for (const manifestPath of [...this.fileMetadata.keys()]) {
            if (!found.has(manifestPath) && !fs.existsSync(manifestPath)) {  // a manifest added meanwhile stays
                this.fileMetadata.delete(manifestPath);
                this.removeModuleAt(path.dirname(manifestPath));
                changed = true;
            }
        }

        if (changed) {
            this.modulesArray = null;
            this.dirty = true;
            OdooModuleUtils.clearCache();
            this._onDidChange.fire();
            const foldersAfter = new Set(this.modulesByPath.keys());
            const changedFolders = [...foldersAfter].filter(dir => !foldersBefore.has(dir))
                .concat([...foldersBefore].filter(dir => !foldersAfter.has(dir)));
            if (changedFolders.length) {
                this._onDidChangeModuleFolders.fire(changedFolders);
            }
        }
    }

    private removeModuleAt(moduleDir: string) {
        const name = this.modulesByPath.get(moduleDir);
        if (name && this.moduleCache.get(name)?.path === moduleDir) {
            this.moduleCache.delete(name);
        }
        this.modulesByPath.delete(moduleDir);
    }

    private setModule(info: ModuleInfo) {
        const previous = this.moduleCache.get(info.name);
        if (previous && previous.path !== info.path) {
            this.modulesByPath.delete(previous.path);
        }
        this.moduleCache.set(info.name, info);
        this.modulesByPath.set(info.path, info.name);
    }

    public async getModules(progress?: vscode.Progress<{ message?: string; increment?: number }>): Promise<ModuleInfo[]> {
        indexNeeded();
        if (this.moduleCache.size === 0) {
            await this.reindex(progress);
        }
        return this.getModulesSync();
    }

    /** The modules known right now, without triggering a scan. */
    public getModulesSync(): ModuleInfo[] {
        indexNeeded();
        if (!this.modulesArray) {
            this.modulesArray = Array.from(this.moduleCache.values());
        }
        return this.modulesArray;
    }

    public async getModuleNames(): Promise<string[]> {
        const modules = await this.getModules();
        return modules.map(m => m.name).sort();
    }

    public getModulePath(name: string): string | undefined {
        return this.moduleCache.get(name)?.path;
    }

    public getModuleInfo(name: string): ModuleInfo | undefined {
        return this.moduleCache.get(name);
    }

    /** The indexed module containing `fsPath`, found by walking up its parent folders. */
    public getModuleForPath(fsPath: string): ModuleInfo | undefined {
        let dir = fsPath;
        while (true) {
            const name = this.modulesByPath.get(dir);
            if (name) {
                return this.moduleCache.get(name);
            }
            const parent = path.dirname(dir);
            if (parent === dir) {
                return undefined;
            }
            dir = parent;
        }
    }

    public hasModules(): boolean {
        return this.moduleCache.size > 0;
    }

    public isDirty(): boolean {
        return this.dirty;
    }

    public getState() {
        this.dirty = false;
        return {
            modules: Array.from(this.moduleCache.entries()),
            metadata: Array.from(this.fileMetadata.entries())
        };
    }

    public loadState(state: any) {
        try {
            if (Array.isArray(state)) {
                this.moduleCache = new Map(state);
            } else if (state && typeof state === 'object') {
                if (Array.isArray(state.modules)) {
                    this.moduleCache = new Map(state.modules);
                }
                if (Array.isArray(state.metadata)) {
                    this.fileMetadata = new Map(state.metadata);
                }
            }
        } catch (e) {
            console.error('[ModuleIndex] Failed to load state:', e);
            this.moduleCache = new Map();
            this.fileMetadata = new Map();
        }
        this.modulesByPath = new Map([...this.moduleCache.values()].map(m => [m.path, m.name]));
        this.modulesArray = null;
    }

    public dispose() {
        this.watcher?.dispose();
        this.initWatcher?.dispose();
        this._onDidChangeModuleFolders.dispose();
    }
}

const moduleIndexService = new ModuleIndexService();
export default moduleIndexService;
