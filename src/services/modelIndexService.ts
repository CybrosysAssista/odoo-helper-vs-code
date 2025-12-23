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
}

class ModelIndexService {
    private modelCache: Map<string, ModelInfo[]>; // modelName -> ModelInfo[] (since multiple modules can inherit/define)
    private watcher: vscode.FileSystemWatcher | null;
    private isIndexing: boolean = false;

    constructor() {
        this.modelCache = new Map();
        this.watcher = null;
    }

    initialize() {
        this.watcher = vscode.workspace.createFileSystemWatcher('**/*.py');
        this.watcher.onDidChange(uri => this.indexFile(uri));
        this.watcher.onDidCreate(uri => this.indexFile(uri));
        this.watcher.onDidDelete(uri => this.removeFile(uri));
    }

    async buildCache() {
        if (this.isIndexing) return;
        this.isIndexing = true;

        console.log('[ModelIndex] Building model cache...');
        this.modelCache.clear();

        const modules = await moduleIndexService.getModules();
        for (const module of modules) {
            // Find all python files in this module
            const pattern = new vscode.RelativePattern(module.path, '**/*.py');
            const pythonFiles = await vscode.workspace.findFiles(pattern, '**/node_modules/**');

            for (const file of pythonFiles) {
                await this.indexFile(file, module.name);
            }
        }

        this.isIndexing = false;
        console.log(`[ModelIndex] Finished: Indexed ${this.modelCache.size} models across ${modules.length} modules.`);
    }

    async indexFile(uri: vscode.Uri, moduleName?: string) {
        try {
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
            this.parseModelsFromTree(tree, uri.fsPath, moduleName);

        } catch (error) {
            console.error(`[ModelIndex] Error indexing file ${uri.fsPath}:`, error);
        }
    }

    private parseModelsFromTree(tree: any, filePath: string, moduleName: string) {
        const rootNode = tree.rootNode;
        const pythonParser = getPythonParserService();
        const language = pythonParser.getLanguage();

        if (!language) return;

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
                        isInherited: !hasName
                    };

                    const existing = this.modelCache.get(finalModelName) || [];
                    existing.push(modelInfo);
                    this.modelCache.set(finalModelName, existing);
                }
            }
        }
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

    public dispose() {
        if (this.watcher) {
            this.watcher.dispose();
        }
    }
}

const modelIndexService = new ModelIndexService();
export default modelIndexService;
