import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { getPythonParserService } from './pythonParserService';
import modelIndexService, { ModelInfo } from './modelIndexService';

export interface FieldInfo {
    fieldName: string;
    fieldType: string;
    attributes: { [key: string]: string };
    modelName: string;
    isInherited: boolean;
    moduleName: string;
    filePath: string;
    line: number;
    character: number;
}

class FieldIndexService {
    private fieldCache: Map<string, FieldInfo[]> = new Map(); // modelName -> FieldInfo[]
    private isIndexing: boolean = false;

    constructor() { }

    initialize() {
        // Listen to model index changes to stay in sync
        modelIndexService.onDidIndexFile(uri => this.indexFile(uri));
        modelIndexService.onDidDeleteFile(uri => this.removeFile(uri));
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

            this.parseFieldsFromFile(tree, models);
            tree.delete();
        } catch (error) {
            console.error(`[FieldIndex] Error indexing file ${uri.fsPath}:`, error);
        }
    }

    private removeFile(uri: vscode.Uri) {
        this.removeFileEntries(uri.fsPath);
    }

    private removeFileEntries(filePath: string) {
        for (const [key, list] of this.fieldCache.entries()) {
            const filtered = list.filter(f => f.filePath !== filePath);
            if (filtered.length === 0) {
                this.fieldCache.delete(key);
            } else {
                this.fieldCache.set(key, filtered);
            }
        }
    }

    async buildCache(progress?: vscode.Progress<{ message?: string; increment?: number }>) {
        if (this.isIndexing) return;
        this.isIndexing = true;

        console.log('[FieldIndex] Building field cache...');
        this.fieldCache.clear();

        const allModels = modelIndexService.getAllModels();
        // Group models by file to avoid multiple parses of the same file
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
                    message: `Indexing Fields: ${filesProcessed}/${totalFiles} (${fileName})`,
                    increment: (1 / totalFiles) * 100
                });
            }

            try {
                const text = fs.readFileSync(filePath, 'utf8');
                const tree = pythonParser.parse(text);
                if (!tree) continue;

                this.parseFieldsFromFile(tree, models);

                // CRITICAL: Prevent memory access out of bounds by explicitly deleting the tree
                tree.delete();
            } catch (error) {
                console.error(`[FieldIndex] Error parsing file ${filePath}:`, error);
            }

            // Yield occasionally
            if (filesProcessed % 10 === 0) {
                await new Promise(resolve => setTimeout(resolve, 10));
            }
        }

        this.isIndexing = false;
        console.log(`[FieldIndex] Finished: Indexed fields for ${this.fieldCache.size} models.`);
    }

    private parseFieldsFromFile(tree: any, models: ModelInfo[]) {
        const pythonParser = getPythonParserService();
        const language = pythonParser.getLanguage();
        if (!language) return;

        // Query to find classes and their assignments
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

                const fields: FieldInfo[] = [];

                // Iterate over class body to find field assignments
                for (const child of bodyNode.children) {
                    if (child.type === 'expression_statement') {
                        const assignment = child.firstChild;
                        if (assignment?.type === 'assignment') {
                            const left = assignment.childForFieldName('left');
                            const right = assignment.childForFieldName('right');

                            if (left?.type === 'identifier' && right?.type === 'call') {
                                const fieldName = left.text;
                                const callNode = right;
                                const funcNode = callNode.childForFieldName('function');

                                let fieldType = '';
                                if (funcNode?.type === 'attribute') {
                                    const obj = funcNode.childForFieldName('object');
                                    const attr = funcNode.childForFieldName('attribute');
                                    if (obj?.text === 'fields' && attr) {
                                        fieldType = attr.text;
                                    }
                                } else if (funcNode?.type === 'identifier') {
                                    // Handle direct imports like from odoo.fields import Char
                                    fieldType = funcNode.text;
                                    // We might want to verify if it's actually an Odoo field type
                                }

                                if (fieldType) {
                                    const attributes = this.extractAttributes(callNode);
                                    fields.push({
                                        fieldName,
                                        fieldType,
                                        attributes,
                                        modelName: modelInfo.modelName,
                                        isInherited: modelInfo.isInherited,
                                        moduleName: modelInfo.moduleName,
                                        filePath: modelInfo.filePath,
                                        line: left.startPosition.row,
                                        character: left.startPosition.column
                                    });
                                }
                            }
                        }
                    }
                }

                if (fields.length > 0) {
                    const existing = this.fieldCache.get(modelInfo.modelName) || [];
                    this.fieldCache.set(modelInfo.modelName, [...existing, ...fields]);
                }
            }
        }
    }

    private extractAttributes(callNode: any): { [key: string]: string } {
        const attributes: { [key: string]: string } = {};
        const argListNode = callNode.childForFieldName('arguments');
        if (argListNode) {
            for (const arg of argListNode.namedChildren) {
                if (arg.type === 'keyword_argument') {
                    const nameNode = arg.childForFieldName('name');
                    const valueNode = arg.childForFieldName('value');
                    if (nameNode && valueNode) {
                        let value = valueNode.text;
                        // Strip quotes if it's a string
                        if (valueNode.type === 'string') {
                            value = value.slice(1, -1);
                        }
                        attributes[nameNode.text] = value;
                    }
                }
            }
        }
        return attributes;
    }

    public getFieldsForModel(modelName: string): FieldInfo[] {
        return this.fieldCache.get(modelName) || [];
    }

    public getAllFields(): FieldInfo[] {
        const all: FieldInfo[] = [];
        for (const fields of this.fieldCache.values()) {
            all.push(...fields);
        }
        return all;
    }
}

const fieldIndexService = new FieldIndexService();
export default fieldIndexService;
