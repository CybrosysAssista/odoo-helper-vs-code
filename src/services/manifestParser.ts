import * as vscode from 'vscode';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const TreeSitter = require('web-tree-sitter');

/**
 * Represents a position in the source code
 */
export interface Position {
    line: number;
    character: number;
}

/**
 * Represents a range in the source code
 */
export interface Range {
    start: Position;
    end: Position;
}

/**
 * Represents a value in the manifest with its position and type
 */
export interface ManifestValue {
    type: 'string' | 'list' | 'dict' | 'boolean' | 'number' | 'unknown';
    value: any;
    range: Range;
    // For lists: positions of each item
    items?: Array<{ value: any; range: Range }>;
    // For dicts: recursive map of nested values
    children?: Map<string, ManifestValue>;
}

/**
 * Parsed manifest structure with positions
 */
export interface ParsedManifest {
    data: Map<string, ManifestValue>;
    range: Range;
}

/**
 * Helper class to parse Odoo manifest files and extract structure with positions
 */
export class ManifestParser {
    private language: any;

    constructor(language: any) {
        this.language = language;
    }

    /**
     * Parse a manifest file and return structured data with positions
     */
    parseManifest(text: string): ParsedManifest | null {
        try {
            const TreeSitterModule = require('web-tree-sitter');
            const { Parser } = TreeSitterModule;

            const parser = new Parser();
            parser.setLanguage(this.language);

            const tree = parser.parse(text);
            const rootNode = tree.rootNode;

            // Find the main dictionary (the manifest)
            const dictNode = this.findMainDictionary(rootNode);

            if (!dictNode) {
                return null;
            }

            return {
                data: this.parseDictionary(dictNode),
                range: this.nodeToRange(dictNode)
            };
        } catch (error) {
            console.error('[ManifestParser] Error parsing manifest:', error);
            return null;
        }
    }

    /**
     * Find the main dictionary node in the manifest
     */
    private findMainDictionary(node: any): any {
        // The manifest is typically an expression_statement containing a dictionary
        if (node.type === 'module') {
            for (const child of node.namedChildren) {
                if (child.type === 'expression_statement') {
                    const dict = child.namedChildren.find((n: any) => n.type === 'dictionary');
                    if (dict) return dict;
                }
            }
        }
        return null;
    }

    /**
     * Recursively parse a dictionary node
     */
    private parseDictionary(dictNode: any): Map<string, ManifestValue> {
        const result = new Map<string, ManifestValue>();

        for (const child of dictNode.namedChildren) {
            if (child.type === 'pair') {
                const keyNode = child.childForFieldName('key');
                const valueNode = child.childForFieldName('value');

                if (keyNode && valueNode) {
                    // Extract key (remove quotes)
                    const key = this.extractString(keyNode.text);

                    // Parse value recursively
                    const value = this.parseValue(valueNode);

                    if (value) {
                        result.set(key, value);
                    }
                }
            }
        }

        return result;
    }

    /**
     * Parse any value node (string, list, dict, etc.)
     */
    private parseValue(node: any): ManifestValue | null {
        const range = this.nodeToRange(node);

        switch (node.type) {
            case 'string':
                return {
                    type: 'string',
                    value: this.extractString(node.text),
                    range
                };

            case 'list':
                return this.parseList(node);

            case 'dictionary':
                return {
                    type: 'dict',
                    value: null,
                    range,
                    children: this.parseDictionary(node)
                };

            case 'true':
            case 'false':
                return {
                    type: 'boolean',
                    value: node.type === 'true',
                    range
                };

            case 'integer':
            case 'float':
                return {
                    type: 'number',
                    value: parseFloat(node.text),
                    range
                };

            default:
                return {
                    type: 'unknown',
                    value: node.text,
                    range
                };
        }
    }

    /**
     * Parse a list node
     */
    private parseList(listNode: any): ManifestValue {
        const items: Array<{ value: any; range: Range }> = [];
        const values: any[] = [];

        for (const child of listNode.namedChildren) {
            const range = this.nodeToRange(child);

            if (child.type === 'string') {
                const value = this.extractString(child.text);
                items.push({ value, range });
                values.push(value);
            } else if (child.type === 'dictionary') {
                const dictValue = this.parseDictionary(child);
                items.push({ value: dictValue, range });
                values.push(dictValue);
            } else {
                // Other types
                items.push({ value: child.text, range });
                values.push(child.text);
            }
        }

        return {
            type: 'list',
            value: values,
            range: this.nodeToRange(listNode),
            items
        };
    }

    /**
     * Convert a Tree-sitter node to a Range
     */
    private nodeToRange(node: any): Range {
        return {
            start: {
                line: node.startPosition.row,
                character: node.startPosition.column
            },
            end: {
                line: node.endPosition.row,
                character: node.endPosition.column
            }
        };
    }

    /**
     * Extract string value (remove quotes)
     */
    private extractString(text: string): string {
        // Remove surrounding quotes
        if ((text.startsWith('"') && text.endsWith('"')) ||
            (text.startsWith("'") && text.endsWith("'"))) {
            return text.slice(1, -1);
        }
        return text;
    }

    /**
     * Get the insertion position for adding an item to a list
     */
    getListInsertPosition(listValue: ManifestValue): Position | null {
        if (listValue.type !== 'list' || !listValue.items) {
            return null;
        }

        if (listValue.items.length === 0) {
            // Empty list - insert at start
            return {
                line: listValue.range.start.line,
                character: listValue.range.start.character + 1
            };
        }

        // Insert after last item
        const lastItem = listValue.items[listValue.items.length - 1];
        return {
            line: lastItem.range.end.line,
            character: lastItem.range.end.character
        };
    }

    /**
     * Get the insertion position for adding a key-value pair to a dict
     */
    getDictInsertPosition(dictValue: ManifestValue): Position | null {
        if (dictValue.type !== 'dict' || !dictValue.children) {
            return null;
        }

        if (dictValue.children.size === 0) {
            // Empty dict - insert at start
            return {
                line: dictValue.range.start.line,
                character: dictValue.range.start.character + 1
            };
        }

        // Insert after last key-value pair
        const entries = Array.from(dictValue.children.values());
        const lastEntry = entries[entries.length - 1];
        return {
            line: lastEntry.range.end.line,
            character: lastEntry.range.end.character
        };
    }
}

/**
 * Helper function to get a nested value from parsed manifest
 * Example: getValue(manifest, 'assets', 'web.assets_backend')
 */
export function getNestedValue(manifest: ParsedManifest, ...keys: string[]): ManifestValue | null {
    let current: ManifestValue | undefined;
    let currentMap = manifest.data;

    for (const key of keys) {
        current = currentMap.get(key);

        if (!current) {
            return null;
        }

        if (current.type === 'dict' && current.children) {
            currentMap = current.children;
        } else {
            // Not a dict, can't go deeper
            return current;
        }
    }

    return current || null;
}

/**
 * Helper function to check if a value exists in a list
 */
export function listContains(listValue: ManifestValue, searchValue: string): boolean {
    if (listValue.type !== 'list' || !listValue.items) {
        return false;
    }

    return listValue.items.some(item => item.value === searchValue);
}
