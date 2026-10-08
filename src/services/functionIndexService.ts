import { packEntries, unpackEntries } from './compactState';
import modelIndexService, { ParsedFileEvent } from './modelIndexService';
import { indexNeeded } from '../indexer/trigger';

export interface FunctionInfo {
    functionName: string;
    parameters: string[];
    className: string;
    modelName: string;
    moduleName: string;
    inheritsFromModule?: string; // The specific module this inheritance targets
    isInherited: boolean;
    filePath: string;
    line: number;
    character: number;
}

class FunctionIndexService {
    private functionCache: Map<string, FunctionInfo[]> = new Map(); // modelName -> FunctionInfo[]
    private fileModelNames: Map<string, Set<string>> = new Map(); // filePath -> models that file has entries for
    private dirty = false;

    constructor() { }

    initialize() {
        // Listen to model index changes to stay in sync
        modelIndexService.onDidParseFile(event => this.indexParsedFile(event));
        modelIndexService.onDidDeleteFile(uri => this.removeFileEntries(uri.fsPath));
    }

    public indexParsedFile({ filePath, models, parsed }: ParsedFileEvent) {
        this.removeFileEntries(filePath);
        for (const modelInfo of models) {
            const entries = parsed.functions.filter(entry => entry.className === modelInfo.className);
            if (entries.length === 0) continue;
            const inheritsFromModule = modelIndexService.resolveInheritedModule(modelInfo);
            this.add(filePath, modelInfo.modelName, entries.map(entry => ({
                ...entry,
                modelName: modelInfo.modelName,
                moduleName: modelInfo.moduleName,
                isInherited: modelInfo.isInherited,
                inheritsFromModule,
                filePath
            })));
        }
    }

    private add(filePath: string, modelName: string, entries: FunctionInfo[]) {
        const existing = this.functionCache.get(modelName);
        if (existing) {
            existing.push(...entries);
        } else {
            this.functionCache.set(modelName, entries);
        }
        const models = this.fileModelNames.get(filePath);
        if (models) {
            models.add(modelName);
        } else {
            this.fileModelNames.set(filePath, new Set([modelName]));
        }
        this.dirty = true;
    }

    /** Removes the entries from `filePath`. Cost is proportional to that file's models only. */
    private removeFileEntries(filePath: string) {
        const models = this.fileModelNames.get(filePath);
        if (!models) return;
        this.fileModelNames.delete(filePath);
        for (const modelName of models) {
            const list = this.functionCache.get(modelName);
            if (!list) continue;
            const filtered = list.filter(f => f.filePath !== filePath);
            if (filtered.length === 0) {
                this.functionCache.delete(modelName);
            } else {
                this.functionCache.set(modelName, filtered);
            }
        }
        this.dirty = true;
    }

    public getFunctionsForModel(modelName: string): FunctionInfo[] {
        indexNeeded();
        return this.functionCache.get(modelName) || [];
    }

    public getAllFunctions(): FunctionInfo[] {
        indexNeeded();
        const all: FunctionInfo[] = [];
        for (const funcs of this.functionCache.values()) {
            all.push(...funcs);
        }
        return all;
    }

    public isDirty(): boolean {
        return this.dirty;
    }

    public getState() {
        this.dirty = false;
        const { files, rows } = packEntries(this.functionCache.entries());
        return { format: 2, files, functions: rows };
    }

    public loadState(state: any) {
        let entries: [string, FunctionInfo[]][] = [];
        try {
            if (Array.isArray(state)) {
                // Old format
                entries = state;
                this.dirty = true;
            } else if (state?.format === 2 && Array.isArray(state.files) && Array.isArray(state.functions)) {
                // Compact format (file paths in a table)
                entries = unpackEntries<FunctionInfo>(state.files, state.functions);
            } else if (state && typeof state === 'object' && Array.isArray(state.functions)) {
                // Previous format: written again in the compact one at the next save
                entries = state.functions;
                this.dirty = true;
            }
        } catch (e) {
            console.error('[FunctionIndex] Failed to load state:', e);
        }
        this.functionCache = new Map();
        this.fileModelNames = new Map();
        for (const [modelName, list] of entries) {
            this.functionCache.set(modelName, list);
            for (const entry of list) {
                const models = this.fileModelNames.get(entry.filePath);
                if (models) {
                    models.add(modelName);
                } else {
                    this.fileModelNames.set(entry.filePath, new Set([modelName]));
                }
            }
        }
    }
}

const functionIndexService = new FunctionIndexService();
export default functionIndexService;
