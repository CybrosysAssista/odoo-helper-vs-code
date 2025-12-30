import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { Node } from 'vscode-html-languageservice';
import { getXmlParserService } from '../services/xmlParserService';

export class OdooModuleUtils {
    /**
     * Get the root directory of the Odoo module containing the given URI.
     * @param uri - The URI of a file or directory within the module.
     * @returns The URI of the module root, or null if not found.
     */
    static async getModuleRoot(uri: vscode.Uri): Promise<vscode.Uri | null> {
        let currentFolder = uri.fsPath;
        while (currentFolder) {
            const manifestPath = path.join(currentFolder, '__manifest__.py');
            const initPath = path.join(currentFolder, '__init__.py');
            if (fs.existsSync(manifestPath) || fs.existsSync(initPath)) {
                return vscode.Uri.file(currentFolder);
            }
            const parentFolder = path.dirname(currentFolder);
            if (parentFolder === currentFolder) {
                break;
            }
            currentFolder = parentFolder;
        }
        return null;
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

            if (parentNode.tag && ['form', 'tree', 'list', 'kanban', 'pivot', 'search'].includes(parentNode.tag)) {
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

            if (parentNode.tag && ['form', 'tree', 'list', 'kanban', 'pivot', 'search'].includes(parentNode.tag)) {
                foundViewTag = true;
            }

            parentNode = parentNode.parent;
        }
        return null;
    }
}
