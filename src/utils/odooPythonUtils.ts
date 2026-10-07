import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { getPythonParserService } from '../services/pythonParserService';
import { OdooModuleUtils } from './odooModuleUtils';
import fieldIndexService, { FieldInfo } from '../services/fieldIndexService';

export interface OdooModelContext {
    valid: boolean;
    isInherited: boolean;
    modelName: string;
    moduleName: string;
    inheritedModels: string[];
}

export class OdooPythonUtils {
    /**
     * Checks if the given position in a Python file is inside a valid Odoo model.
     * @param uri The URI of the Python file.
     * @param position The position within the file.
     * @returns OdooModelContext
     */
    static async getModelAtContext(uri: vscode.Uri, position: vscode.Position): Promise<OdooModelContext> {
        const failContext: OdooModelContext = {
            valid: false,
            isInherited: false,
            modelName: '',
            moduleName: '',
            inheritedModels: []
        };

        try {
            // 1. Check if inside a valid Odoo module
            const moduleRoot = OdooModuleUtils.getModuleRootPath(uri.fsPath);
            if (!moduleRoot) return failContext;
            const moduleName = path.basename(moduleRoot);

            // 2. Parse Python file: the open editor's text (including unsaved edits), else the file on disk
            const pythonParser = getPythonParserService();
            if (!pythonParser.isInitialized()) return failContext;

            const openDocument = vscode.workspace.textDocuments.find(d => d.uri.toString() === uri.toString());
            const text = openDocument ? openDocument.getText() : await fs.promises.readFile(uri.fsPath, 'utf8');

            return pythonParser.withTree(text, tree => {
                // 3. Find the class containment
                const nodeAtPosition = tree.rootNode.descendantForPosition({
                    row: position.line,
                    column: position.character
                });

                // Walk up to find the class definition
                let classNode = nodeAtPosition;
                while (classNode && classNode.type !== 'class_definition') {
                    classNode = classNode.parent;
                }
                if (!classNode) return failContext;

                // 4. Check if it extends Odoo Models
                // (class_definition name: (identifier) superclasses: (argument_list (attribute object: (identifier) attribute: (identifier))))
                const superclassesNode = classNode.childForFieldName('superclasses');
                let isOdooModel = false;
                if (superclassesNode) {
                    for (const arg of superclassesNode.namedChildren) {
                        if (['models.Model', 'models.TransientModel', 'models.AbstractModel', 'Model', 'TransientModel', 'AbstractModel'].includes(arg.text)) {
                            isOdooModel = true;
                            break;
                        }
                    }
                }
                if (!isOdooModel) return failContext;

                // 5. Extract _name and _inherit
                const bodyNode = classNode.childForFieldName('body');
                let modelName = '';
                let inheritNames: string[] = [];
                let hasName = false;

                if (bodyNode) {
                    for (const child of bodyNode.children) {
                        if (child.type === 'expression_statement') {
                            const assignment = child.firstChild;
                            if (assignment?.type === 'assignment') {
                                const left = assignment.childForFieldName('left');
                                const right = assignment.childForFieldName('right');

                                if (left?.text === '_name') {
                                    hasName = true;
                                    modelName = this.extractStringValue(right);
                                } else if (left?.text === '_inherit') {
                                    inheritNames = this.extractInheritValue(right);
                                }
                            }
                        }
                    }
                }

                // Result Logic:
                // if _name exists, take it.
                // else if _inherit exists, take it.
                // "Inherited" in this context means ONLY _inherit (no _name).
                const finalModelName = modelName || (inheritNames.length > 0 ? inheritNames[0] : '');
                if (!finalModelName) return failContext;

                return {
                    valid: true,
                    isInherited: !hasName, // If no _name, it's a pure inheritance
                    modelName: finalModelName,
                    moduleName: moduleName,
                    inheritedModels: inheritNames
                };
            }) ?? failContext;

        } catch (error) {
            console.error('[OdooPythonUtils] Error identifying model context:', error);
            return failContext;
        }
    }

    private static extractStringValue(node: any): string {
        if (!node) return '';
        if (node.type === 'string') {
            return node.text.slice(1, -1);
        }
        return '';
    }

    private static extractInheritValue(node: any): string[] {
        if (!node) return [];
        if (node.type === 'string') {
            return [node.text.slice(1, -1)];
        }
        if (node.type === 'list' || node.type === 'tuple') {
            return node.namedChildren
                .filter((child: any) => child.type === 'string')
                .map((child: any) => child.text.slice(1, -1));
        }
        return [];
    }
    /**
     * Gets indexed fields for a specific model.
     */
    static getModelFields(modelName: string): FieldInfo[] {
        return fieldIndexService.getFieldsForModel(modelName);
    }
}
