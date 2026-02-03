import * as vscode from 'vscode';
import * as path from 'path';
import { getPythonParserService } from './pythonParserService';
import moduleIndexService from './moduleIndexService';

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

export interface RichIndexEvent {
    uri: vscode.Uri;
    tree: any;
    models: ModelInfo[];
}

class ModelIndexService {
    private modelCache: Map<string, ModelInfo[]>; // modelName -> ModelInfo[] (since multiple modules can inherit/define)
    private fileMetadata: Map<string, { mtime: number, size: number }>; // filePath -> metadata
    private watcher: vscode.FileSystemWatcher | null;
    private isIndexing: boolean = false;
    private _onDidIndexFile = new vscode.EventEmitter<vscode.Uri>();
    public readonly onDidIndexFile = this._onDidIndexFile.event;
    private _onDidDeleteFile = new vscode.EventEmitter<vscode.Uri>();
    public readonly onDidDeleteFile = this._onDidDeleteFile.event;

    private _onDidIndexRichFile = new vscode.EventEmitter<RichIndexEvent>();
    public readonly onDidIndexRichFile = this._onDidIndexRichFile.event;

    constructor() {
        this.modelCache = new Map();
        this.fileMetadata = new Map();
        this.watcher = null;
    }

    initialize() {
        this.watcher = vscode.workspace.createFileSystemWatcher('**/*.py');
        this.watcher.onDidChange(uri => this.indexFile(uri));
        this.watcher.onDidCreate(uri => this.indexFile(uri));
        this.watcher.onDidDelete(uri => this.removeFile(uri));
    }

    async buildCache(progress?: vscode.Progress<{ message?: string; increment?: number }>) {
        if (this.isIndexing) return;
        this.isIndexing = true;

        // console.log('[ModelIndex] Refreshing model cache (incremental)...');
        // DO NOT CLEAR modelCache anymore!

        if (progress) {
            progress.report({ message: "Finding Odoo Modules..." });
        }
        const modules = await moduleIndexService.getModules(progress);
        const totalModules = modules.length;
        let modulesProcessed = 0;

        for (const module of modules) {
            modulesProcessed++;

            // Find all python files in this module
            const pattern = new vscode.RelativePattern(module.path, '**/*.py');
            const pythonFiles = await vscode.workspace.findFiles(pattern, '**/{node_modules,venv,.venv,__pycache__}/**');
            const totalFiles = pythonFiles.length;
            let filesProcessed = 0;

            for (const file of pythonFiles) {
                filesProcessed++;
                if (progress) {
                    progress.report({
                        message: `Models: ${filesProcessed}/${totalFiles}`,
                        increment: (1 / (totalModules * (totalFiles || 1))) * 100
                    });
                }
                await this.indexFile(file, module.name);
            }

            // Yield to main thread occasionally
            await new Promise(resolve => setTimeout(resolve, 0));
        }

        // Cleanup: Remove entries for files that no longer exist
        this.cleanupDeletedFiles();

        this.isIndexing = false;
        // console.log(`[ModelIndex] Finished: Indexed ${this.modelCache.size} models across ${modules.length} modules.`);
    }

    async indexFile(uri: vscode.Uri, moduleName?: string) {
        const config = vscode.workspace.getConfiguration('cybrosys-assista-odoo-helper');
        if (!config.get<boolean>('indexing.enableCoreIndexing', true)) {
            return;
        }

        try {
            const stats = await vscode.workspace.fs.stat(uri);
            const cachedMetadata = this.fileMetadata.get(uri.fsPath);

            // Skip if file hasn't changed
            if (cachedMetadata && cachedMetadata.mtime === stats.mtime && cachedMetadata.size === stats.size) {
                // If we already have models for this file, skip parsing
                const models = this.getModelsByFile(uri.fsPath);
                if (models.length > 0 || this.hasMetadata(uri.fsPath)) {
                    return;
                }
            }

            if (!moduleName) {
                // Try to find module name if not provided
                const modules = await moduleIndexService.getModules();
                const module = modules.find(m => uri.fsPath.startsWith(m.path));
                if (!module) return; // Not in a valid Odoo module
                moduleName = module.name;
            }

            const content = await vscode.workspace.fs.readFile(uri);
            const text = Buffer.from(content).toString('utf8');

            const pythonParser = getPythonParserService();
            if (!pythonParser.isInitialized()) return;

            const tree = pythonParser.parse(text);
            if (!tree) return;

            // Remove old entries for this file
            this.removeFileEntries(uri.fsPath);

            // Parse classes
            const moduleInfo = moduleIndexService.getModuleInfo(moduleName);
            const moduleDepends = moduleInfo?.depends || [];
            const models = this.parseModelsFromTree(tree, uri.fsPath, moduleName, moduleDepends);

            // Update metadata
            this.fileMetadata.set(uri.fsPath, { mtime: stats.mtime, size: stats.size });

            // Notify others with the parsed tree
            this._onDidIndexRichFile.fire({ uri, tree, models });
            this._onDidIndexFile.fire(uri);

            // CRITICAL: Delete tree only after everyone is done
            tree.delete();

        } catch (error) {
            console.error(`[ModelIndex] Error indexing file ${uri.fsPath}:`, error);
        }
    }

    private parseModelsFromTree(tree: any, filePath: string, moduleName: string, moduleDepends: string[]): ModelInfo[] {
        const rootNode = tree.rootNode;
        const pythonParser = getPythonParserService();
        const language = pythonParser.getLanguage();
        const foundModels: ModelInfo[] = [];

        if (!language) return [];

        // Query to find classes
        const classQuery = new (require('web-tree-sitter')).Query(language, `
            (class_definition
                name: (identifier) @class_name
                body: (block) @body
            )
        `);

        const matches = classQuery.matches(rootNode);
        for (const match of matches) {
            const classNameNode = match.captures.find((c: any) => c.name === 'class_name')?.node;
            const bodyNode = match.captures.find((c: any) => c.name === 'body')?.node;

            if (classNameNode && bodyNode) {
                const className = classNameNode.text;
                let modelNameValue: string | null = null;
                let inheritValue: string | string[] | null = null;
                let hasName = false;

                // Look for _name and _inherit assignments in the class body
                for (const child of bodyNode.children) {
                    if (child.type === 'expression_statement') {
                        const assignment = child.firstChild;
                        if (assignment?.type === 'assignment') {
                            const left = assignment.childForFieldName('left');
                            const right = assignment.childForFieldName('right');

                            if (left?.text === '_name') {
                                hasName = true;
                                modelNameValue = this.extractString(right);
                            } else if (left?.text === '_inherit') {
                                inheritValue = this.extractValue(right);
                            }
                        }
                    }
                }

                // Logic to determine model name as requested
                let finalModelName: string | null = null;
                if (hasName) {
                    finalModelName = modelNameValue;
                } else if (inheritValue) {
                    if (Array.isArray(inheritValue)) {
                        finalModelName = inheritValue[0];
                    } else {
                        finalModelName = inheritValue;
                    }
                }

                if (finalModelName) {
                    const modelInfo: ModelInfo = {
                        modelName: finalModelName,
                        moduleName: moduleName,
                        className: className,
                        filePath: filePath,
                        line: classNameNode.startPosition.row,
                        character: classNameNode.startPosition.column,
                        isInherited: !hasName,
                        moduleDepends: moduleDepends
                    };

                    const existing = this.modelCache.get(finalModelName) || [];
                    existing.push(modelInfo);
                    this.modelCache.set(finalModelName, existing);
                    foundModels.push(modelInfo);
                }
            }
        }
        return foundModels;
    }

    private extractString(node: any): string | null {
        if (!node) return null;
        if (node.type === 'string') {
            return node.text.slice(1, -1);
        }
        return null;
    }

    private extractValue(node: any): string | string[] | null {
        if (!node) return null;
        if (node.type === 'string') {
            return node.text.slice(1, -1);
        }
        if (node.type === 'list' || node.type === 'tuple') {
            const values: string[] = [];
            for (const child of node.namedChildren) {
                if (child.type === 'string') {
                    values.push(child.text.slice(1, -1));
                }
            }
            return values;
        }
        return null;
    }

    private removeFile(uri: vscode.Uri) {
        this.removeFileEntries(uri.fsPath);
        this._onDidDeleteFile.fire(uri);
    }

    private removeFileEntries(filePath: string) {
        for (const [key, list] of this.modelCache.entries()) {
            const filtered = list.filter(m => m.filePath !== filePath);
            if (filtered.length === 0) {
                this.modelCache.delete(key);
            } else {
                this.modelCache.set(key, filtered);
            }
        }
    }

    public getModelsByName(modelName: string): ModelInfo[] {
        return this.modelCache.get(modelName) || [];
    }

    private hasMetadata(filePath: string): boolean {
        return this.fileMetadata.has(filePath);
    }

    private async cleanupDeletedFiles() {
        for (const filePath of this.fileMetadata.keys()) {
            try {
                await vscode.workspace.fs.stat(vscode.Uri.file(filePath));
            } catch (e) {
                // File deleted
                this.removeFileEntries(filePath);
                this.fileMetadata.delete(filePath);
            }
        }
    }

    public getAllModelNames(): string[] {
        return Array.from(this.modelCache.keys());
    }

    public getAllModels(): ModelInfo[] {
        const all: ModelInfo[] = [];
        for (const models of this.modelCache.values()) {
            all.push(...models);
        }
        return all;
    }

    public getModelsByFile(filePath: string): ModelInfo[] {
        const results: ModelInfo[] = [];
        for (const models of this.modelCache.values()) {
            for (const model of models) {
                if (model.filePath === filePath) {
                    results.push(model);
                }
            }
        }
        return results;
    }

    public getState() {
        return {
            models: Array.from(this.modelCache.entries()),
            metadata: Array.from(this.fileMetadata.entries())
        };
    }

    public loadState(state: any) {
        try {
            if (Array.isArray(state)) {
                // Old format: direct array
                this.modelCache = new Map(state);
            } else if (state && typeof state === 'object') {
                // New format: { models: [], metadata: [] }
                if (Array.isArray(state.models)) {
                    this.modelCache = new Map(state.models);
                }
                if (Array.isArray(state.metadata)) {
                    this.fileMetadata = new Map(state.metadata);
                }
            }
        } catch (e) {
            console.error('[ModelIndex] Failed to load state:', e);
            this.modelCache = new Map();
            this.fileMetadata = new Map();
        }
    }

    public dispose() {
        if (this.watcher) {
            this.watcher.dispose();
        }
    }
}

const modelIndexService = new ModelIndexService();
export default modelIndexService;
