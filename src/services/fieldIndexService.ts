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
        modelIndexService.onDidIndexRichFile(event => this.indexFromTree(event.tree, event.models));
        modelIndexService.onDidDeleteFile(uri => this.removeFile(uri));
    }

    public indexFromTree(tree: any, models: ModelInfo[]) {
        if (models.length > 0) {
            this.removeFileEntries(models[0].filePath);
            this.parseFieldsFromFile(tree, models);
        }
    }

    async indexFile(uri: vscode.Uri) {
        // This is now mostly handled by onDidIndexRichFile from modelIndexService
        // But if called directly (e.g. initial dev), we can still handle it
        try {
            const text = fs.readFileSync(uri.fsPath, 'utf8');
            const pythonParser = getPythonParserService();
            if (!pythonParser.isInitialized()) return;

            const tree = pythonParser.parse(text);
            if (!tree) return;

            const models = modelIndexService.getModelsByFile(uri.fsPath);
            this.indexFromTree(tree, models);
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
        // console.log('[FieldIndex] Refreshing field cache (incremental)...');
        // DO NOT CLEAR anymore
        this.isIndexing = false;
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

    public getState() {
        return {
            fields: Array.from(this.fieldCache.entries())
        };
    }

    public loadState(state: any) {
        try {
            if (Array.isArray(state)) {
                // Old format
                this.fieldCache = new Map(state);
            } else if (state && typeof state === 'object') {
                // New format
                if (Array.isArray(state.fields)) {
                    this.fieldCache = new Map(state.fields);
                }
            }
        } catch (e) {
            console.error('[FieldIndex] Failed to load state:', e);
            this.fieldCache = new Map();
        }
    }
}

const fieldIndexService = new FieldIndexService();
export default fieldIndexService;
