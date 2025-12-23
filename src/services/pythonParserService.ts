import * as path from 'path';
import * as vscode from 'vscode';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const TreeSitter = require('web-tree-sitter');
const { Parser } = TreeSitter;

/**
 * Python Parser Service using Tree-sitter
 * Provides robust parsing for Odoo Python files
 */
export class PythonParserService {
    private parser: any = null;
    private language: any = null;
    private isReady: boolean = false;

    /**
     * Initialize the parser with the Python language
     */
    async init(context: vscode.ExtensionContext): Promise<void> {
        try {
            // Initialize Tree-sitter Parser
            await Parser.init();

            // Load the Python language WASM file
            const wasmPath = path.join(context.extensionPath, 'resources', 'tree-sitter-python.wasm');
            this.language = await TreeSitter.Language.load(wasmPath);

            // Create parser and set language
            this.parser = new Parser();
            this.parser.setLanguage(this.language);

            this.isReady = true;
            console.log('[PythonParserService] Initialized successfully');
        } catch (error) {
            console.error('[PythonParserService] Failed to initialize:', error);
            throw error;
        }
    }

    /**
     * Parse Python code and return the syntax tree
     */
    parse(text: string): any | null {
        if (!this.isReady || !this.parser) {
            console.warn('[PythonParserService] Parser not ready');
            return null;
        }
        return this.parser.parse(text);
    }

    /**
     * Find all Odoo Model classes in the code
     * Returns: Array of { name: string, line: number, inherits: string[] }
     */
    findOdooModels(text: string): Array<{ name: string; line: number; inherits: string[] }> {
        const tree = this.parse(text);
        if (!tree || !this.language) return [];

        // Query to find classes that inherit from models.Model, models.TransientModel, or models.AbstractModel
        const queryScm = `
            (class_definition
                name: (identifier) @class_name
                superclasses: (argument_list
                    (attribute
                        object: (identifier) @super_object
                        attribute: (identifier) @super_attr
                    )
                )
                (#eq? @super_object "models")
                (#match? @super_attr "^(Model|TransientModel|AbstractModel)$")
            )
        `;

        const query = new TreeSitter.Query(this.language, queryScm);
        const captures = query.captures(tree.rootNode);

        const models: Array<{ name: string; line: number; inherits: string[] }> = [];
        let currentModel: { name: string; line: number; inherits: string[] } | null = null;

        for (const capture of captures) {
            if (capture.name === 'class_name') {
                if (currentModel) {
                    models.push(currentModel);
                }
                currentModel = {
                    name: capture.node.text,
                    line: capture.node.startPosition.row,
                    inherits: []
                };
            }
        }

        if (currentModel) {
            models.push(currentModel);
        }

        return models;
    }

    /**
     * Get manifest data (e.g., depends, data, assets)
     */
    getManifestData(text: string, key: string): string[] {
        const tree = this.parse(text);
        if (!tree || !this.language) return [];

        // Query to find the specified key in the manifest dictionary
        const queryScm = `
            (dictionary
                (pair
                    key: (string) @key
                    value: (list) @value
                )
                (#eq? @key "\\"${key}\\"")
            )
        `;

        const query = new TreeSitter.Query(this.language, queryScm);
        const captures = query.captures(tree.rootNode);

        const results: string[] = [];

        for (const capture of captures) {
            if (capture.name === 'value') {
                // Iterate through list items
                for (const child of capture.node.namedChildren) {
                    if (child.type === 'string') {
                        // Remove quotes
                        const value = child.text.slice(1, -1);
                        results.push(value);
                    }
                }
            }
        }
        return results;
    }

    /**
     * Find the position to insert a new item in a manifest list
     * Returns: { line: number, character: number } or null
     */
    findManifestListInsertPosition(text: string, key: string): { line: number; character: number } | null {
        const tree = this.parse(text);
        if (!tree || !this.language) return null;

        const queryScm = `
            (dictionary
                (pair
                    key: (string) @key
                    value: (list) @value
                )
                (#eq? @key "\\"${key}\\"")
            )
        `;

        const query = new TreeSitter.Query(this.language, queryScm);
        const captures = query.captures(tree.rootNode);

        for (const capture of captures) {
            if (capture.name === 'value') {
                const listNode = capture.node;
                const lastChild = listNode.lastNamedChild;

                if (lastChild) {
                    // Insert after the last item
                    return {
                        line: lastChild.endPosition.row,
                        character: lastChild.endPosition.column
                    };
                } else {
                    // Empty list, insert at the start
                    return {
                        line: listNode.startPosition.row,
                        character: listNode.startPosition.column + 1
                    };
                }
            }
        }

        return null;
    }

    /**
     * Check if a value exists in a manifest list
     */
    manifestListContains(text: string, key: string, value: string): boolean {
        const items = this.getManifestData(text, key);
        return items.includes(value);
    }

    /**
     * Find all field definitions in a class
     */
    findFields(text: string): Array<{ name: string; type: string; line: number }> {
        const tree = this.parse(text);
        if (!tree || !this.language) return [];

        // Query to find field assignments like: name = fields.Char(...)
        const queryScm = `
            (assignment
                left: (identifier) @field_name
                right: (call
                    function: (attribute
                        object: (identifier) @obj
                        attribute: (identifier) @field_type
                    )
                )
                (#eq? @obj "fields")
            )
        `;

        const query = new TreeSitter.Query(this.language, queryScm);
        const captures = query.captures(tree.rootNode);

        const fields: Array<{ name: string; type: string; line: number }> = [];
        let currentField: { name?: string; type?: string; line?: number } = {};

        for (const capture of captures) {
            if (capture.name === 'field_name') {
                currentField.name = capture.node.text;
                currentField.line = capture.node.startPosition.row;
            } else if (capture.name === 'field_type') {
                currentField.type = capture.node.text;
            }

            if (currentField.name && currentField.type && currentField.line !== undefined) {
                fields.push({
                    name: currentField.name,
                    type: currentField.type,
                    line: currentField.line
                });
                currentField = {};
            }
        }

        return fields;
    }

    /**
     * Check if parser is ready
     */
    isInitialized(): boolean {
        return this.isReady;
    }

    /**
     * Get a ManifestParser instance for advanced manifest parsing
     */
    getManifestParser() {
        if (!this.isReady || !this.language) {
            return null;
        }
        const { ManifestParser } = require('./manifestParser');
        return new ManifestParser(this.language);
    }

    /**
     * Get the Tree-sitter language instance
     */
    getLanguage(): any {
        return this.language;
    }

    /**
     * Get the Tree-sitter parser instance
     */
    getParser(): any {
        return this.parser;
    }
}

// Singleton instance
let parserServiceInstance: PythonParserService | null = null;

export function getPythonParserService(): PythonParserService {
    if (!parserServiceInstance) {
        parserServiceInstance = new PythonParserService();
    }
    return parserServiceInstance;
}
