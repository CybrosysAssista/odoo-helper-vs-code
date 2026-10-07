import * as vscode from 'vscode';
import type { Node } from 'vscode-html-languageservice';
import { getXmlParserService } from '../services/xmlParserService';
import { clearModuleRootCache, findModuleRoot } from '../parsing/moduleRoot';

// arch root tags of every view type (tree before 18, card from 20)
const VIEW_ROOT_TAGS = new Set(['form', 'tree', 'list', 'kanban', 'card', 'pivot', 'graph', 'calendar', 'search', 'activity', 'hierarchy']);

export class OdooModuleUtils {
    /** Cleared whenever the module index changes. */
    static clearCache() {
        clearModuleRootCache();
    }

    /**
     * Get the root directory of the Odoo module containing the given URI.
     * @param uri - The URI of a file or directory within the module.
     * @returns The URI of the module root, or null if not found.
     */
    static async getModuleRoot(uri: vscode.Uri): Promise<vscode.Uri | null> {
        const root = findModuleRoot(uri.fsPath);
        return root ? vscode.Uri.file(root) : null;
    }

    /** Synchronous form of {@link getModuleRoot}; answers from a cache after the first lookup. */
    static getModuleRootPath(fsPath: string): string | null {
        return findModuleRoot(fsPath);
    }

    /**
     * Extract Odoo model metadata (name and uniqueness) from an XML node context.
     * @param node - The current XML node.
     * @param text - The full document text.
     * @returns Model metadata or null if not found.
     */
    static getModelMetadata(node: Node, text: string): { name: string, isUnique: boolean } | null {
        const xmlParser = getXmlParserService();
        let parentNode: Node | undefined = node;
        while (parentNode) {
            if (parentNode.tag === 'record') {
                const attrs = xmlParser.getAttributes(text, parentNode);
                if (attrs['model']) {
                    return {
                        name: attrs['model'],
                        isUnique: true
                    };
                }
            }

            if (parentNode.tag && VIEW_ROOT_TAGS.has(parentNode.tag)) {
                const archField = parentNode.parent;
                if (archField && archField.parent) {
                    const recordNode = archField.parent;
                    const modelField = recordNode.children?.find(c => {
                        if (c.tag === 'field') {
                            const attrs = xmlParser.getAttributes(text, c);
                            return attrs['name'] === 'model';
                        }
                        return false;
                    });

                    if (modelField && modelField.startTagEnd !== undefined && modelField.endTagStart !== undefined) {
                        const modelName = text.slice(modelField.startTagEnd, modelField.endTagStart).trim();
                        return {
                            name: modelName,
                            isUnique: false
                        };
                    }
                }
            }
            parentNode = parentNode.parent;
        }
        return null;
    }

    static getRecordModel(node: Node, text: string): string | null {
        const xmlParser = getXmlParserService();
        let parentNode: Node | undefined = node;
        while (parentNode) {
            if (parentNode.tag === 'record') {
                const attrs = xmlParser.getAttributes(text, parentNode);
                if (attrs['model']) {
                    return attrs['model'];
                }
            }
            parentNode = parentNode.parent;
        }
        return null;
    }

    static findViewModel(node: Node, text: string): string | null {
        const xmlParser = getXmlParserService();
        let parentNode: Node | undefined = node;
        let foundViewTag = false;

        while (parentNode) {
            if (parentNode.tag === 'record') {
                const attrs = xmlParser.getAttributes(text, parentNode);
                const recordModel = attrs['model'];

                // If we are in an ir.ui.view or we found a view tag (form, tree, etc.),
                // we should look for the <field name="model"> content.
                if (foundViewTag) {
                    const children = parentNode.children;
                    if (children) {
                        for (const child of children) {
                            if (child.tag === 'field') {
                                const cAttrs = xmlParser.getAttributes(text, child);
                                if (cAttrs['name'] === 'model') {
                                    if (child.startTagEnd !== undefined && child.endTagStart !== undefined) {
                                        return text.slice(child.startTagEnd, child.endTagStart).trim();
                                    }
                                }
                            }
                        }
                    }
                }

                // If it's not a view record or the model field wasn't found,
                // use the record's model attribute itself.
                if (recordModel) {
                    return recordModel;
                }
                break;
            }

            if (parentNode.tag && VIEW_ROOT_TAGS.has(parentNode.tag)) {
                foundViewTag = true;
            }

            parentNode = parentNode.parent;
        }
        return null;
    }
}
