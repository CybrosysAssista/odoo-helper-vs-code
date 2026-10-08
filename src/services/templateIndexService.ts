import * as path from 'path';
import * as fs from 'fs';
import * as vscode from 'vscode';
import { EXCLUDE_GLOB, FileChange, FileMetadata, watchFiles } from '../utils/indexing';
import { EntryKind, XmlEntry } from '../parsing/xml';
import { indexFiles } from '../indexer/indexer';
import type { FileResult } from '../indexer/protocol';
import { indexNeeded } from '../indexer/trigger';

export interface TemplateLocation {
    filePath: string;
    line: number;
}

const STATE_VERSION = 3;  // 3: template ids no longer double-qualified

class TemplateIndexService {
    private fileEntries: Map<string, XmlEntry[]> = new Map(); // filePath -> templates and ids it defines
    private templates: Map<string, TemplateLocation[]> = new Map(); // template name -> where it is defined
    private xmlIds: Map<string, TemplateLocation[]> = new Map(); // module.xml_id -> where it is defined
    private fileMetadata: Map<string, FileMetadata> = new Map();
    private watcher: vscode.Disposable | null = null;
    private templateNames: string[] | null = null;
    private dirty = false;

    initialize() {
        this.watcher = watchFiles('**/*.xml', changes => this.applyChanges(changes));
    }

    private async applyChanges(changes: Map<string, FileChange>) {
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

    /** Parses the files under `dir` again: a module was created or removed there, so they now belong to a different module. */
    public reindexUnder(dir: string): Promise<void> {
        const prefix = dir.endsWith(path.sep) ? dir : dir + path.sep;
        const paths = [...this.fileMetadata.keys()].filter(file => file.startsWith(prefix));
        paths.forEach(file => this.fileMetadata.delete(file));
        return this.indexPaths(paths);
    }

    private indexPaths(paths: string[], progress?: vscode.Progress<{ message?: string; increment?: number }>) {
        return indexFiles(
            paths.map(path => ({ path, kind: 'xml' as const, meta: this.fileMetadata.get(path) })),
            result => this.applyResult(result),
            progress && { report: value => progress.report(value), label: 'Templates' }
        );
    }

    async buildCache(progress?: vscode.Progress<{ message?: string; increment?: number }>) {
        const xmlFiles = await vscode.workspace.findFiles('**/*.xml', EXCLUDE_GLOB);
        const seen = new Set(xmlFiles.map(file => file.fsPath));
        await this.indexPaths([...seen], progress);
        for (const filePath of [...this.fileMetadata.keys()]) {
            if (!seen.has(filePath) && !fs.existsSync(filePath)) {  // a file the watcher added meanwhile stays
                this.removeFile(filePath);
            }
        }
    }

    private applyResult(result: FileResult) {
        if (result.status === 'missing') {
            this.removeFile(result.path);
        } else if (result.status === 'parsed') {
            this.removeEntries(result.path);
            if (result.xml) {
                this.addEntries(result.path, result.xml);
            }
            this.fileMetadata.set(result.path, result.meta);
            this.dirty = true;
        }
    }

    private removeFile(filePath: string) {
        if (this.fileMetadata.delete(filePath)) {
            this.dirty = true;
        }
        this.removeEntries(filePath);
    }

    private addEntries(filePath: string, entries: XmlEntry[]) {
        if (entries.length === 0) return;
        this.fileEntries.set(filePath, entries);
        for (const [name, line, kind] of entries) {
            const map = kind === EntryKind.Template ? this.templates : this.xmlIds;
            const locations = map.get(name);
            if (locations) {
                locations.push({ filePath, line });
            } else {
                map.set(name, [{ filePath, line }]);
            }
        }
        this.templateNames = null;
        this.dirty = true;
    }

    private removeEntries(filePath: string) {
        const entries = this.fileEntries.get(filePath);
        if (!entries) return;
        this.fileEntries.delete(filePath);
        for (const [name, , kind] of entries) {
            const map = kind === EntryKind.Template ? this.templates : this.xmlIds;
            const locations = map.get(name)?.filter(l => l.filePath !== filePath);
            if (locations && locations.length > 0) {
                map.set(name, locations);
            } else {
                map.delete(name);
            }
        }
        this.templateNames = null;
        this.dirty = true;
    }

    getAllTemplates(): string[] {
        indexNeeded();
        if (!this.templateNames) {
            this.templateNames = Array.from(this.templates.keys());
        }
        return this.templateNames;
    }

    /** Where a template is defined, by full name (`module.name`) or by its name alone. */
    findTemplate(name: string): TemplateLocation[] {
        indexNeeded();
        return TemplateIndexService.lookup(this.templates, name);
    }

    /** Where an XML id (record, menu item or template) is defined, as `module.id` or `id`. */
    findXmlId(id: string): TemplateLocation[] {
        indexNeeded();
        return TemplateIndexService.lookup(this.xmlIds, id);
    }

    private static lookup(map: Map<string, TemplateLocation[]>, name: string): TemplateLocation[] {
        const exact = map.get(name);
        if (exact) {
            return exact;
        }
        const suffix = '.' + name;
        const results: TemplateLocation[] = [];
        for (const [fullName, locations] of map) {
            if (fullName.endsWith(suffix)) {
                results.push(...locations);
            }
        }
        return results;
    }

    isDirty(): boolean {
        return this.dirty;
    }

    getState() {
        this.dirty = false;
        return {
            version: STATE_VERSION,
            files: Array.from(this.fileEntries.entries()),
            metadata: Array.from(this.fileMetadata.entries())
        };
    }

    loadState(state: any) {
        this.fileEntries = new Map();
        this.templates = new Map();
        this.xmlIds = new Map();
        this.fileMetadata = new Map();
        this.templateNames = null;
        // Earlier versions saved template names without their files, so their entries could never
        // be removed. Such a state is dropped and rebuilt (a cheap pass: templates are found by regex).
        if (!state || state.version !== STATE_VERSION || !Array.isArray(state.files)) {
            return;
        }
        try {
            for (const [filePath, entries] of state.files as [string, XmlEntry[]][]) {
                this.addEntries(filePath, entries);
            }
            if (Array.isArray(state.metadata)) {
                this.fileMetadata = new Map(state.metadata);
            }
        } catch (e) {
            console.error('[TemplateIndex] Failed to load state:', e);
            this.fileEntries = new Map();
            this.templates = new Map();
            this.xmlIds = new Map();
            this.fileMetadata = new Map();
        }
        this.dirty = false;
    }

    dispose() {
        this.watcher?.dispose();
    }
}

// Singleton instance
const templateIndexService = new TemplateIndexService();

export default templateIndexService;
