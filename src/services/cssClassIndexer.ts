import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { EXCLUDE_GLOB, FileChange, FileMetadata, isIgnoredPath, watchFiles, yieldIfBusy } from '../utils/indexing';
import { indexFiles } from '../indexer/indexer';
import type { FileResult } from '../indexer/protocol';
import { indexNeeded } from '../indexer/trigger';

export interface CssClassDefinition {
    className: string;
    moduleName: string;
    filePath: string;
    lineNumber: number;
}

interface FileClasses {
    moduleName: string;
    /** [class name, 1-based line] */
    classes: [string, number][];
}

const STATE_VERSION = 2;
const EXCLUDED_DIRS = new Set(['node_modules', 'venv', '.venv', '__pycache__', 'dist', 'out', 'build', '.git']);

export class CssClassIndexer {
    private static instance: CssClassIndexer;

    private files: Map<string, FileClasses> = new Map(); // filePath -> classes defined in it
    private fileMetadata: Map<string, FileMetadata> = new Map();

    // Derived on demand from `files`, dropped whenever a file changes.
    private classesByModule: Map<string, string[]> | null = null;
    private cssClasses: Map<string, CssClassDefinition[]> | null = null;
    private dirty = false;

    private constructor() { }

    public static getInstance(): CssClassIndexer {
        if (!CssClassIndexer.instance) {
            CssClassIndexer.instance = new CssClassIndexer();
        }
        return CssClassIndexer.instance;
    }

    private isEnabled(): boolean {
        return vscode.workspace.getConfiguration('cybrosys-assista-odoo-helper').get<boolean>('indexing.enableCSSIndexing', true);
    }

    /** Keeps the index current as stylesheets change. */
    public initialize(): vscode.Disposable {
        // `static/lib` stays included: Bootstrap's classes are what most Odoo views use.
        return watchFiles('**/*.{css,scss}', changes => this.applyChanges(changes));
    }

    private async applyChanges(changes: Map<string, FileChange>) {
        if (!this.isEnabled()) return;
        const changed: string[] = [];
        for (const [fsPath, change] of changes) {
            if (change === 'deleted') {
                this.removeFile(fsPath);
            } else {
                changed.push(fsPath);
            }
        }
        await this.indexPaths(changed);
    }

    private indexPaths(paths: string[], progress?: vscode.Progress<{ message?: string; increment?: number }>) {
        return indexFiles(
            paths.filter(path => !isIgnoredPath(path)).map(path => ({ path, kind: 'css' as const, meta: this.fileMetadata.get(path) })),
            result => this.applyResult(result),
            progress && { report: value => progress.report(value), label: 'CSS classes' }
        );
    }

    /**
     * Index all CSS/SCSS files in the workspace.
     */
    public async indexWorkspace(progress?: vscode.Progress<{ message?: string; increment?: number }>): Promise<void> {
        const config = vscode.workspace.getConfiguration('cybrosys-assista-odoo-helper');
        if (!config.get<boolean>('indexing.enableCSSIndexing', true)) {
            this.files.clear();
            this.fileMetadata.clear();
            this.invalidate();
            return;
        }

        // 1. Index Workspace Files
        const allFiles = (await vscode.workspace.findFiles('**/*.{css,scss}', EXCLUDE_GLOB)).map(f => f.fsPath);

        // 2. Index Odoo Source Path (if configured)
        const odooSourcePath = config.get<string>('odooSourcePath', '');
        if (odooSourcePath && fs.existsSync(odooSourcePath)) {
            allFiles.push(...await this.findExternalCssFiles(odooSourcePath));
        }

        const seen = new Set(allFiles);
        await this.indexPaths([...seen], progress);
        for (const filePath of [...this.fileMetadata.keys()]) {
            if (!seen.has(filePath)) {
                this.removeFile(filePath);
            }
        }
    }

    private applyResult(result: FileResult) {
        if (result.status === 'missing') {
            this.removeFile(result.path);
        } else if (result.status === 'parsed') {
            this.files.delete(result.path);
            if (result.module && result.css && result.css.length > 0) {
                this.files.set(result.path, { moduleName: result.module, classes: result.css });
            }
            this.fileMetadata.set(result.path, result.meta);
            this.invalidate();
        }
    }

    private async findExternalCssFiles(dir: string): Promise<string[]> {
        const results: string[] = [];

        const walk = async (currentDir: string) => {
            let entries: fs.Dirent[];
            try {
                entries = await fs.promises.readdir(currentDir, { withFileTypes: true });
            } catch {
                return;
            }
            for (const entry of entries) {
                if (EXCLUDED_DIRS.has(entry.name)) continue;
                const fullPath = path.join(currentDir, entry.name);
                if (entry.isDirectory()) {
                    await walk(fullPath);
                } else if (entry.name.endsWith('.css') || entry.name.endsWith('.scss')) {
                    results.push(fullPath);
                }
            }
            await yieldIfBusy();
        };

        await walk(dir);
        return results;
    }

    private removeFile(filePath: string) {
        const hadFile = this.files.delete(filePath);
        if (this.fileMetadata.delete(filePath) || hadFile) {
            this.invalidate();
        }
    }

    private invalidate() {
        this.classesByModule = null;
        this.cssClasses = null;
        this.dirty = true;
    }

    public getClassDefinitions(className: string): CssClassDefinition[] {
        indexNeeded();
        if (!this.cssClasses) {
            this.cssClasses = new Map();
            for (const [filePath, { moduleName, classes }] of this.files) {
                for (const [name, lineNumber] of classes) {
                    const definition = { className: name, moduleName, filePath, lineNumber };
                    const list = this.cssClasses.get(name);
                    if (list) {
                        list.push(definition);
                    } else {
                        this.cssClasses.set(name, [definition]);
                    }
                }
            }
        }
        return this.cssClasses.get(className) || [];
    }

    public getClassesInModule(moduleName: string): string[] {
        indexNeeded();
        return this.getClassesByModule().get(moduleName) || [];
    }

    /** Every class name with the first module defining it. */
    public getAllClasses(): Map<string, string> {
        indexNeeded();
        const all = new Map<string, string>();
        for (const [moduleName, classes] of this.getClassesByModule()) {
            for (const name of classes) {
                if (!all.has(name)) {
                    all.set(name, moduleName);
                }
            }
        }
        return all;
    }

    private getClassesByModule(): Map<string, string[]> {
        if (!this.classesByModule) {
            const sets = new Map<string, Set<string>>();
            for (const { moduleName, classes } of this.files.values()) {
                let set = sets.get(moduleName);
                if (!set) {
                    set = new Set();
                    sets.set(moduleName, set);
                }
                for (const [name] of classes) {
                    set.add(name);
                }
            }
            this.classesByModule = new Map([...sets].map(([module, set]) => [module, Array.from(set)]));
        }
        return this.classesByModule;
    }

    public isDirty(): boolean {
        return this.dirty;
    }

    public getState() {
        this.dirty = false;
        return {
            version: STATE_VERSION,
            files: Array.from(this.files.entries()),
            metadata: Array.from(this.fileMetadata.entries())
        };
    }

    public loadState(state: any) {
        this.files = new Map();
        this.fileMetadata = new Map();
        this.invalidate();
        this.dirty = false;
        // Earlier versions stored classes without a reliable per-file breakdown; such a state is
        // dropped and rebuilt (a cheap pass: classes are found by regex).
        if (!state || state.version !== STATE_VERSION || !Array.isArray(state.files)) {
            return;
        }
        try {
            this.files = new Map(state.files);
            if (Array.isArray(state.metadata)) {
                this.fileMetadata = new Map(state.metadata);
            }
        } catch (e) {
            console.error('[CssClassIndexer] Failed to load state:', e);
            this.files = new Map();
            this.fileMetadata = new Map();
        }
    }
}
