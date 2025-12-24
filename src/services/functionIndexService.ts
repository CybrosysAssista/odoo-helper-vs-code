import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { getPythonParserService } from './pythonParserService';
import modelIndexService, { ModelInfo } from './modelIndexService';

export interface FunctionInfo {
    functionName: string;
    parameters: string[];
    className: string;
    modelName: string;
    moduleName: string;
    isInherited: boolean;
    filePath: string;
    line: number;
    character: number;
}

class FunctionIndexService {
    private functionCache: Map<string, FunctionInfo[]> = new Map(); // modelName -> FunctionInfo[]
    private watcher: vscode.FileSystemWatcher | null = null;
    private isIndexing: boolean = false;

    constructor() { }

    initialize() {
        this.watcher = vscode.workspace.createFileSystemWatcher('**/*.py');
        this.watcher.onDidChange(uri => this.indexFile(uri));
        this.watcher.onDidCreate(uri => this.indexFile(uri));
        this.watcher.onDidDelete(uri => this.removeFile(uri));
    }

    async buildCache(progress?: vscode.Progress<{ message?: string; increment?: number }>) {
        if (this.isIndexing) return;
        this.isIndexing = true;

        console.log('[FunctionIndex] Building function cache...');
        this.functionCache.clear();

        const allModels = modelIndexService.getAllModels();
        const modelsByFile = new Map<string, ModelInfo[]>();
        for (const model of allModels) {
            const list = modelsByFile.get(model.filePath) || [];
            list.push(model);
            modelsByFile.set(model.filePath, list);
        }

        const pythonParser = getPythonParserService();
        if (!pythonParser.isInitialized()) {
            this.isIndexing = false;
            return;
        }

        const totalFiles = modelsByFile.size;
        let filesProcessed = 0;

        for (const [filePath, models] of modelsByFile.entries()) {
            filesProcessed++;
            if (progress) {
                const fileName = path.basename(filePath);
                progress.report({
                    message: `Indexing Functions: ${filesProcessed}/${totalFiles} (${fileName})`,
                    increment: (1 / totalFiles) * 100
                });
            }

            try {
                const text = fs.readFileSync(filePath, 'utf8');
                const tree = pythonParser.parse(text);
                if (!tree) continue;

                this.parseFunctionsFromFile(tree, models);

                tree.delete();
            } catch (error) {
                console.error(`[FunctionIndex] Error parsing file ${filePath}:`, error);
            }

            if (filesProcessed % 10 === 0) {
                await new Promise(resolve => setTimeout(resolve, 10));
            }
        }

        this.isIndexing = false;
        console.log(`[FunctionIndex] Finished: Indexed functions for ${this.functionCache.size} models.`);
    }

    async indexFile(uri: vscode.Uri) {
        try {
            const text = fs.readFileSync(uri.fsPath, 'utf8');
            const pythonParser = getPythonParserService();
            if (!pythonParser.isInitialized()) return;

            const tree = pythonParser.parse(text);
            if (!tree) return;

            const models = modelIndexService.getModelsByFile(uri.fsPath);
            if (models.length === 0) {
                tree.delete();
                return;
            }

            // Remove old entries for this file
            this.removeFileEntries(uri.fsPath);

            this.parseFunctionsFromFile(tree, models);
            tree.delete();
        } catch (error) {
            console.error(`[FunctionIndex] Error indexing file ${uri.fsPath}:`, error);
        }
    }

    private removeFile(uri: vscode.Uri) {
        this.removeFileEntries(uri.fsPath);
    }

    private removeFileEntries(filePath: string) {
        for (const [key, list] of this.functionCache.entries()) {
            const filtered = list.filter(f => f.filePath !== filePath);
            if (filtered.length === 0) {
                this.functionCache.delete(key);
            } else {
                this.functionCache.set(key, filtered);
            }
        }
    }

    private parseFunctionsFromFile(tree: any, models: ModelInfo[]) {
        const pythonParser = getPythonParserService();
        const language = pythonParser.getLanguage();
        if (!language) return;

        const query = new (require('web-tree-sitter')).Query(language, `
            (class_definition
                name: (identifier) @class_name
                body: (block) @body
            )
        `);

        const matches = query.matches(tree.rootNode);
        for (const match of matches) {
            const classNameNode = match.captures.find((c: any) => c.name === 'class_name')?.node;
            const bodyNode = match.captures.find((c: any) => c.name === 'body')?.node;

            if (classNameNode && bodyNode) {
                const className = classNameNode.text;
                const modelInfo = models.find(m => m.className === className);
                if (!modelInfo) continue;

                const functions: FunctionInfo[] = [];

                for (const child of bodyNode.children) {
                    if (child.type === 'function_definition') {
                        const nameNode = child.childForFieldName('name');
                        const paramsNode = child.childForFieldName('parameters');

                        if (nameNode) {
                            const functionName = nameNode.text;
                            const parameters: string[] = [];

                            if (paramsNode) {
                                // Extract parameter names
                                for (const param of paramsNode.namedChildren) {
                                    // Parameters can be identifiers, typed_parameters, default_parameters, etc.
                                    // We just want the name.
                                    let paramName = '';
                                    if (param.type === 'identifier') {
                                        paramName = param.text;
                                    } else {
                                        const idNode = param.childForFieldName('name') || param.firstChild;
                                        if (idNode && idNode.type === 'identifier') {
                                            paramName = idNode.text;
                                        } else {
                                            paramName = param.text;
                                        }
                                    }
                                    if (paramName) {
                                        parameters.push(paramName);
                                    }
                                }
                            }

                            functions.push({
                                functionName,
                                parameters,
                                className: modelInfo.className,
                                modelName: modelInfo.modelName,
                                moduleName: modelInfo.moduleName,
                                isInherited: modelInfo.isInherited,
                                filePath: modelInfo.filePath,
                                line: nameNode.startPosition.row,
                                character: nameNode.startPosition.column
                            });
                        }
                    }
                }

                if (functions.length > 0) {
                    const existing = this.functionCache.get(modelInfo.modelName) || [];
                    this.functionCache.set(modelInfo.modelName, [...existing, ...functions]);
                }
            }
        }
    }

    public getFunctionsForModel(modelName: string): FunctionInfo[] {
        return this.functionCache.get(modelName) || [];
    }

    public getAllFunctions(): FunctionInfo[] {
        const all: FunctionInfo[] = [];
        for (const funcs of this.functionCache.values()) {
            all.push(...funcs);
        }
        return all;
    }

    public dispose() {
        if (this.watcher) {
            this.watcher.dispose();
        }
    }
}

const functionIndexService = new FunctionIndexService();
export default functionIndexService;
