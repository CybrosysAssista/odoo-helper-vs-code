import * as path from 'path';
import * as vscode from 'vscode';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const TreeSitter = require('web-tree-sitter');
const { Parser } = TreeSitter;

/**
 * JavaScript Parser Service using Tree-sitter
 * Provides robust parsing for Odoo JavaScript/OWL files
 */
export class JavaScriptParserService {
    private parser: any = null;
    private language: any = null;
    private isReady: boolean = false;

    /**
     * Initialize the parser with the JavaScript language
     */
    async init(context: vscode.ExtensionContext): Promise<void> {
        try {
            // Initialize Tree-sitter Parser
            await Parser.init();

            // Load the JavaScript language WASM file
            const wasmPath = path.join(context.extensionPath, 'resources', 'tree-sitter-javascript.wasm');
            this.language = await TreeSitter.Language.load(wasmPath);

            // Create parser and set language
            this.parser = new Parser();
            this.parser.setLanguage(this.language);

            this.isReady = true;
            console.log('[JavaScriptParserService] Initialized successfully');
        } catch (error) {
            console.error('[JavaScriptParserService] Failed to initialize:', error);
            throw error;
        }
    }

    /**
     * Parse JavaScript code and return the syntax tree
     */
    parse(text: string): any | null {
        if (!this.isReady || !this.parser) {
            console.warn('[JavaScriptParserService] Parser not ready');
            return null;
        }
        return this.parser.parse(text);
    }

    /**
     * Find Odoo registry calls: registry.category("...").add("...", Component)
     * Returns: Array of { category: string, id: string, component: string, line: number }
     */
    findRegistryCalls(text: string): Array<{ category: string; id: string; component: string; line: number }> {
        const tree = this.parse(text);
        if (!tree || !this.language) return [];

        // Query to find: registry.category("category").add("id", Component)
        const queryScm = `
            (call_expression
                function: (member_expression
                    object: (call_expression
                        function: (member_expression
                            object: (identifier) @registry
                            property: (property_identifier) @category_method)
                        arguments: (arguments (string) @category_name))
                    property: (property_identifier) @add_method)
                arguments: (arguments 
                    (string) @id
                    (identifier) @component))
            (#eq? @registry "registry")
            (#eq? @category_method "category")
            (#eq? @add_method "add")
        `;

        const query = new TreeSitter.Query(this.language, queryScm);
        const captures = query.captures(tree.rootNode);

        const results: Array<{ category: string; id: string; component: string; line: number }> = [];
        let currentEntry: { category?: string; id?: string; component?: string; line?: number } = {};

        for (const capture of captures) {
            if (capture.name === 'category_name') {
                // Remove quotes from string
                currentEntry.category = capture.node.text.slice(1, -1);
                currentEntry.line = capture.node.startPosition.row;
            } else if (capture.name === 'id') {
                currentEntry.id = capture.node.text.slice(1, -1);
            } else if (capture.name === 'component') {
                currentEntry.component = capture.node.text;
            }

            // If we have all three pieces, add to results
            if (currentEntry.category && currentEntry.id && currentEntry.component && currentEntry.line !== undefined) {
                results.push({
                    category: currentEntry.category,
                    id: currentEntry.id,
                    component: currentEntry.component,
                    line: currentEntry.line
                });
                currentEntry = {};
            }
        }

        tree.delete();
        return results;
    }

    /**
     * Find all class definitions
     * Returns: Array of { name: string, line: number }
     */
    findClasses(text: string): Array<{ name: string; line: number }> {
        const tree = this.parse(text);
        if (!tree || !this.language) return [];

        const queryScm = `
            (class_declaration
                name: (identifier) @class_name)
        `;

        const query = new TreeSitter.Query(this.language, queryScm);
        const captures = query.captures(tree.rootNode);

        const classes: Array<{ name: string; line: number }> = [];

        for (const capture of captures) {
            if (capture.name === 'class_name') {
                classes.push({
                    name: capture.node.text,
                    line: capture.node.startPosition.row
                });
            }
        }

        tree.delete();
        return classes;
    }

    /**
     * Find all function/method definitions
     * Returns: Array of { name: string, line: number, isMethod: boolean }
     */
    findFunctions(text: string): Array<{ name: string; line: number; isMethod: boolean }> {
        const tree = this.parse(text);
        if (!tree || !this.language) return [];

        const queryScm = `
            [
                (function_declaration
                    name: (identifier) @func_name)
                (method_definition
                    name: (property_identifier) @method_name)
            ]
        `;

        const query = new TreeSitter.Query(this.language, queryScm);
        const captures = query.captures(tree.rootNode);

        const functions: Array<{ name: string; line: number; isMethod: boolean }> = [];

        for (const capture of captures) {
            if (capture.name === 'func_name') {
                functions.push({
                    name: capture.node.text,
                    line: capture.node.startPosition.row,
                    isMethod: false
                });
            } else if (capture.name === 'method_name') {
                functions.push({
                    name: capture.node.text,
                    line: capture.node.startPosition.row,
                    isMethod: true
                });
            }
        }

        tree.delete();
        return functions;
    }

    /**
     * Check if parser is ready
     */
    isInitialized(): boolean {
        return this.isReady;
    }

    /**
     * Get the language object for advanced queries
     */
    getLanguage(): any {
        return this.language;
    }
}

// Singleton instance
let parserServiceInstance: JavaScriptParserService | null = null;

export function getJavaScriptParserService(): JavaScriptParserService {
    if (!parserServiceInstance) {
        parserServiceInstance = new JavaScriptParserService();
    }
    return parserServiceInstance;
}
