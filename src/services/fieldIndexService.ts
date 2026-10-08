import { packEntries, unpackEntries } from './compactState';
import modelIndexService, { ParsedFileEvent } from './modelIndexService';
import { indexNeeded } from '../indexer/trigger';

export interface FieldInfo {
    fieldName: string;
    fieldType: string;
    attributes: { [key: string]: string };
    modelName: string;
    isInherited: boolean;
    moduleName: string;
    inheritsFromModule?: string; // The specific module this inheritance targets
    filePath: string;
    line: number;
    character: number;
}

class FieldIndexService {
    private fieldCache: Map<string, FieldInfo[]> = new Map(); // modelName -> FieldInfo[]
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
            const entries = parsed.fields.filter(entry => entry.className === modelInfo.className);
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

    private add(filePath: string, modelName: string, entries: FieldInfo[]) {
        const existing = this.fieldCache.get(modelName);
        if (existing) {
            existing.push(...entries);
        } else {
            this.fieldCache.set(modelName, entries);
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
            const list = this.fieldCache.get(modelName);
            if (!list) continue;
            const filtered = list.filter(f => f.filePath !== filePath);
            if (filtered.length === 0) {
                this.fieldCache.delete(modelName);
            } else {
                this.fieldCache.set(modelName, filtered);
            }
        }
        this.dirty = true;
    }

    public getFieldsForModel(modelName: string): FieldInfo[] {
        indexNeeded();
        return this.fieldCache.get(modelName) || [];
    }

    public getAllFields(): FieldInfo[] {
        indexNeeded();
        const all: FieldInfo[] = [];
        for (const fields of this.fieldCache.values()) {
            all.push(...fields);
        }
        return all;
    }

    public isDirty(): boolean {
        return this.dirty;
    }

    public getState() {
        this.dirty = false;
        const { files, rows } = packEntries(this.fieldCache.entries());
        return { format: 2, files, fields: rows };
    }

    public loadState(state: any) {
        let entries: [string, FieldInfo[]][] = [];
        try {
            if (Array.isArray(state)) {
                // Old format
                entries = state;
                this.dirty = true;
            } else if (state?.format === 2 && Array.isArray(state.files) && Array.isArray(state.fields)) {
                // Compact format (file paths in a table)
                entries = unpackEntries<FieldInfo>(state.files, state.fields);
            } else if (state && typeof state === 'object' && Array.isArray(state.fields)) {
                // Previous format: written again in the compact one at the next save
                entries = state.fields;
                this.dirty = true;
            }
        } catch (e) {
            console.error('[FieldIndex] Failed to load state:', e);
        }
        this.fieldCache = new Map();
        this.fileModelNames = new Map();
        for (const [modelName, list] of entries) {
            this.fieldCache.set(modelName, list);
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

const fieldIndexService = new FieldIndexService();
export default fieldIndexService;
