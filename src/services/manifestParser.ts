import * as vscode from 'vscode';

import { DataFileMetaDataOptions, AssetFileMetaDataOptions, DependencyMetaDataOptions } from '../utils/utils';
import { getPythonParserService } from './pythonParserService';

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

export type UpdateManifestOptions =
    | DataFileMetaDataOptions
    | AssetFileMetaDataOptions
    | DependencyMetaDataOptions;

/**
 * Helper class to parse Odoo manifest files and extract structure with positions
 */
export class ManifestParser {
    private language: any;
    private parsedManifest: ParsedManifest | null = null;
    private originalContent: string = "";

    constructor(language: any) {
        this.language = language;
    }

    /**
     * Parse a manifest file and return structured data with positions
     */
    parseManifest(text: string): ParsedManifest | null {
        this.originalContent = text;
        // The parsed manifest holds plain values and ranges only, so the tree can be freed
        // as soon as it has been read. Trees live in WASM memory and are never garbage collected.
        let tree: any = null;
        try {
            tree = getPythonParserService().parse(text);
            if (!tree) {
                return null;
            }
            const rootNode = tree.rootNode;

            // Find the main dictionary (the manifest)
            const dictNode = this.findMainDictionary(rootNode);

            if (!dictNode) {
                return null;
            }

            this.parsedManifest = {
                data: this.parseDictionary(dictNode),
                range: this.nodeToRange(dictNode)
            };

            return this.parsedManifest;
        } catch (error) {
            console.error('[ManifestParser] Error parsing manifest:', error);
            return null;
        } finally {
            tree?.delete();
        }
    }

    /**
     * Find the main dictionary node in the manifest
     */
    private findMainDictionary(node: any): any {
        if (node.type === 'dictionary') {
            return node;
        }
        for (let i = 0; i < node.childCount; i++) {
            const found = this.findMainDictionary(node.child(i));
            if (found) return found;
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
                        // Store the range of the entire 'pair' node
                        value.range = this.nodeToRange(child);
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
        if (listValue.type !== 'list') return null;
        return {
            line: listValue.range.end.line,
            character: listValue.range.end.character - 1
        };
    }

    isSingleLine(range: Range): boolean {
        return range.start.line === range.end.line;
    }

    /**
     * Get the insertion position for adding a key-value pair to a dictionary
     */
    getDictInsertPosition(dictValue: ManifestValue): Position | null {
        if (dictValue.type !== 'dict') {
            return null;
        }
        return {
            line: dictValue.range.end.line,
            character: dictValue.range.end.character - 1
        };
    }

    /**
     * Get position after specific keys in a dictionary
     */
    private getPositionAfterKeys(dictValue: ManifestValue, targetKeys: string[]): Position | null {
        if (dictValue.type !== 'dict' || !dictValue.children) return null;

        for (const targetKey of targetKeys) {
            const value = dictValue.children.get(targetKey);
            if (value) {
                // Return position at the end of this key-value pair's range
                return {
                    line: value.range.end.line,
                    character: value.range.end.character
                };
            }
        }
        return null;
    }

    private getIndentation(line: string): string {
        const match = line.match(/^\s*/);
        return match ? match[0] : "";
    }

    public updateManifest(options: UpdateManifestOptions, filePath: string): { success: boolean, message: string, updatedContent?: string } {
        if (this.parsedManifest === null) {
            return { success: false, message: 'Manifest not parsed yet.' };
        }

        if (!this.parsedManifest.data.has('name') || !this.parsedManifest.data.has('version')) {
            return { success: false, message: 'Manifest is Invalid' };
        }

        const subCategoryKeyMap: Record<AssetFileMetaDataOptions['assetCategory'], string> = {
            'web': 'web.assets_frontend',
            'pos': 'point_of_sale._assets_pos',
            'frontend': 'web.assets_frontend',
            'backend': 'web.assets_backend'
        };

        let subCategoryKey = '';
        if (options.manifestCategory === 'asset') {
            subCategoryKey = subCategoryKeyMap[options.assetCategory];
        } else if (options.manifestCategory === 'dependency') {
            const moduleName = options.moduleName;
            const dictValue: ManifestValue = {
                type: 'dict',
                value: null,
                range: this.parsedManifest.range,
                children: this.parsedManifest.data
            };

            if (!this.parsedManifest.data.has("depends")) {
                // Try to find position after website, version, or name
                let insertPos = this.getPositionAfterKeys(dictValue, ['website', 'version', 'name']);
                let isAfterExistingKey = !!insertPos;

                if (!insertPos) {
                    insertPos = this.getDictInsertPosition(dictValue);
                }

                if (insertPos) {
                    // Check if the character right before is already a comma to avoid duplicates
                    // Or let insertAtPosition handle it. 
                    // But if isAfterExistingKey is true, we ARE after a pair.
                    // We should add a comma if it's missing.
                    const prefix = isAfterExistingKey ? "," : "";
                    const entryToAdd = `${prefix}\n    'depends': ['${moduleName}'],`;
                    const updatedContent = this.insertAtPosition(this.originalContent, insertPos, entryToAdd);
                    return { success: true, message: `Added depends list with ${moduleName}.`, updatedContent };
                }
                return { success: false, message: 'Could not find insertion position for depends.' };
            } else {
                const dependsValue = this.parsedManifest.data.get("depends");
                if (!dependsValue || dependsValue.type !== 'list') {
                    return { success: false, message: 'Invalid manifest format (depends is not a list).' };
                }

                if (listContains(dependsValue, moduleName)) {
                    return { success: true, message: 'Module already in depends.' };
                }

                const insertPos = this.getListInsertPosition(dependsValue);
                if (insertPos) {
                    const isFirstItem = (dependsValue.items?.length || 0) === 0;
                    const isSingleLine = this.isSingleLine(dependsValue.range);
                    const prefix = (isFirstItem || !this.isTrailingCommaMissing(insertPos)) ? "" : ", ";

                    let itemToAdd = "";
                    if (isSingleLine) {
                        itemToAdd = `${prefix}'${moduleName}'`;
                    } else {
                        itemToAdd = `${prefix}\n        '${moduleName}',`;
                    }

                    const updatedContent = this.insertAtPosition(this.originalContent, insertPos, itemToAdd);
                    return { success: true, message: `Added ${moduleName} to depends.`, updatedContent };
                }
                return { success: false, message: 'Could not find insertion position in depends list.' };
            }
        } else if (options.manifestCategory === 'data') {
            if (!this.parsedManifest.data.has("data")) {
                const insertPos = this.getDictInsertPosition({
                    type: 'dict',
                    value: null,
                    range: this.parsedManifest.range,
                    children: this.parsedManifest.data
                });

                if (insertPos) {
                    const isFirstEntry = this.parsedManifest.data.size === 0;
                    const prefix = (isFirstEntry || !this.isTrailingCommaMissing(insertPos)) ? "" : ",";
                    const dataToAdd = `${prefix}\n    'data': [\n        '${filePath}',\n    ]`;
                    const updatedContent = this.insertAtPosition(this.originalContent, insertPos, dataToAdd);
                    return { success: true, message: 'Manifest updated successfully.', updatedContent };
                }
            } else {
                const dataList = this.parsedManifest.data.get("data");
                if (dataList?.type !== "list") {
                    return { success: false, message: 'Invalid manifest format (data is not a list).' };
                }

                if (listContains(dataList, filePath)) {
                    return { success: true, message: 'File already exists in manifest.' };
                }

                const insertPos = this.getListInsertPosition(dataList);
                if (insertPos) {
                    const isFirstItem = (dataList.items?.length || 0) === 0;
                    const prefix = (isFirstItem || !this.isTrailingCommaMissing(insertPos)) ? "" : ",";
                    const itemToAdd = `${prefix}\n        '${filePath}',`;
                    const updatedContent = this.insertAtPosition(this.originalContent, insertPos, itemToAdd);
                    return { success: true, message: 'Manifest updated successfully.', updatedContent };
                }
            }
        } else {
            return { success: false, message: 'Unsupported manifest category.' };
        }

        if (!this.parsedManifest.data.has("assets")) {
            const insertPos = this.getDictInsertPosition({
                type: 'dict',
                value: null,
                range: this.parsedManifest.range,
                children: this.parsedManifest.data
            });

            if (insertPos) {
                const isFirstEntry = this.parsedManifest.data.size === 0;
                const prefix = (isFirstEntry || !this.isTrailingCommaMissing(insertPos)) ? "" : ",";
                const assetDictToAdd = `${prefix}\n    'assets': {\n        '${subCategoryKey}': [\n            '${filePath}',\n        ],\n    }`;
                const updatedContent = this.insertAtPosition(this.originalContent, insertPos, assetDictToAdd);
                return { success: true, message: 'Manifest updated successfully.', updatedContent };
            }
        } else {
            const assets = this.parsedManifest.data.get("assets");
            if (assets?.type !== "dict" || !assets.children) {
                return { success: false, message: 'Invalid manifest format (assets is not a dictionary).' };
            }

            if (!assets.children.has(subCategoryKey)) {
                const insertPos = this.getDictInsertPosition(assets);
                if (insertPos) {
                    const isFirstEntry = (assets.children.size || 0) === 0;
                    const prefix = (isFirstEntry || !this.isTrailingCommaMissing(insertPos)) ? "" : ",";
                    const entryToAdd = `${prefix}\n        '${subCategoryKey}': [\n            '${filePath}',\n        ]`;
                    const updatedContent = this.insertAtPosition(this.originalContent, insertPos, entryToAdd);
                    return { success: true, message: 'Manifest updated successfully.', updatedContent };
                }
            } else {
                const subCategoryList = assets.children.get(subCategoryKey);
                if (subCategoryList?.type !== "list") {
                    return { success: false, message: 'Invalid manifest format (subcategory is not a list).' };
                }

                if (subCategoryList.items?.some(item => item.value === filePath)) {
                    return { success: false, message: 'File already exists in manifest.' };
                }

                const insertPos = this.getListInsertPosition(subCategoryList);
                if (insertPos) {
                    const isFirstItem = (subCategoryList.items?.length || 0) === 0;
                    const prefix = (isFirstItem || !this.isTrailingCommaMissing(insertPos)) ? "" : ",";
                    const itemToAdd = `${prefix}\n            '${filePath}',`;
                    const updatedContent = this.insertAtPosition(this.originalContent, insertPos, itemToAdd);
                    return { success: true, message: 'Manifest updated successfully.', updatedContent };
                }
            }
        }

        return { success: true, message: 'Manifest updated successfully.' };
    }

    private isTrailingCommaMissing(pos: Position): boolean {
        const lines = this.originalContent.split('\n');
        let currentLine = pos.line;
        let currentChar = pos.character - 1;

        while (currentLine >= 0) {
            const line = lines[currentLine];
            while (currentChar >= 0) {
                const char = line[currentChar];
                if (char === ',') return false;
                if (char === '[' || char === '{') return true;
                if (!/\s/.test(char)) return true;
                currentChar--;
            }
            currentLine--;
            if (currentLine >= 0) {
                currentChar = lines[currentLine].length - 1;
            }
        }
        return true;
    }

    private insertAtPosition(content: string, pos: Position, text: string): string {
        const lines = content.split('\n');
        const line = lines[pos.line];

        let linePrefix = line.slice(0, pos.character);
        const lineSuffix = line.slice(pos.character).trimStart();

        // If we are adding a newline and our current line is just indentation (like the bracket line),
        // we should remove the prefix from this line to prevent it from becoming a blank line.
        if (text.startsWith('\n') && linePrefix.trim() === "") {
            linePrefix = "";
        }

        // If we are adding a comma and it's on a new line, join it with the prefix/previous line
        let finalText = text;
        if (finalText.startsWith(',')) {
            let leftSide = linePrefix.trimEnd();
            if (leftSide === "" && pos.line > 0) {
                // Find last non-empty line
                let prevLineIdx = pos.line - 1;
                while (prevLineIdx >= 0 && lines[prevLineIdx].trim() === "") {
                    prevLineIdx--;
                }
                if (prevLineIdx >= 0 && !lines[prevLineIdx].trimEnd().endsWith(',')) {
                    lines[prevLineIdx] = lines[prevLineIdx].trimEnd() + ',';
                    finalText = finalText.slice(1);
                } else if (prevLineIdx >= 0 && lines[prevLineIdx].trimEnd().endsWith(',')) {
                    finalText = finalText.slice(1);
                }
            } else if (leftSide !== "" && !leftSide.endsWith(',')) {
                linePrefix = leftSide + ',';
                finalText = finalText.slice(1);
            } else if (leftSide !== "" && leftSide.endsWith(',')) {
                linePrefix = leftSide;
                finalText = finalText.slice(1);
            }
        }

        // Clean up text to avoid redundant blank lines
        finalText = finalText.replace(/\n\s*\n/g, '\n');

        // Handle suffix (closing bracket) move to new line if text contains newlines
        if (lineSuffix !== "" && finalText.includes('\n')) {
            const indent = this.getIndentation(line);
            finalText += '\n' + indent + lineSuffix;
        } else if (lineSuffix !== "") {
            finalText += lineSuffix;
        }

        lines[pos.line] = linePrefix + finalText;
        return lines.join('\n');
    }
}

/**
 * Helper function to get a nested value from parsed manifest
 */
export function getNestedValue(manifest: ParsedManifest, ...keys: string[]): ManifestValue | null {
    let current: ManifestValue | undefined;
    let currentMap = manifest.data;

    for (const key of keys) {
        current = currentMap.get(key);
        if (!current) return null;

        if (current.type === 'dict' && current.children) {
            currentMap = current.children;
        } else {
            return current;
        }
    }
    return current || null;
}

/**
 * Helper function to check if a value exists in a list
 */
export function listContains(listValue: ManifestValue, searchValue: string): boolean {
    if (listValue.type !== 'list' || !listValue.items) return false;
    return listValue.items.some(item => item.value === searchValue);
}
