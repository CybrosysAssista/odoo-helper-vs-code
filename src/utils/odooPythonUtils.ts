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
            moduleName: ''
        };

        try {
            // 1. Check if inside a valid Odoo module
            const moduleRoot = await OdooModuleUtils.getModuleRoot(uri);
            if (!moduleRoot) return failContext;
            const moduleName = path.basename(moduleRoot.fsPath);

            // 2. Parse Python file
            const pythonParser = getPythonParserService();
            if (!pythonParser.isInitialized()) return failContext;

            const text = fs.readFileSync(uri.fsPath, 'utf8');
            const tree = pythonParser.parse(text);
            if (!tree) return failContext;

            const language = pythonParser.getLanguage();
            if (!language) {
                tree.delete();
                return failContext;
            }

            // 3. Find the class containment
            const rootNode = tree.rootNode;
            let nodeAtPosition = rootNode.descendantForPosition({
                row: position.line,
                column: position.character
            });

            // Walk up to find the class definition
            let classNode = nodeAtPosition;
            while (classNode && classNode.type !== 'class_definition') {
                classNode = classNode.parent;
            }

            if (!classNode) {
                tree.delete();
                return failContext;
            }

            // 4. Check if it extends Odoo Models
            // (class_definition name: (identifier) superclasses: (argument_list (attribute object: (identifier) attribute: (identifier))))
            const superclassesNode = classNode.childForFieldName('superclasses');
            let isOdooModel = false;
            if (superclassesNode) {
                for (const arg of superclassesNode.namedChildren) {
                    const text = arg.text;
                    if (['models.Model', 'models.TransientModel', 'models.AbstractModel', 'Model', 'TransientModel', 'AbstractModel'].includes(text)) {
                        isOdooModel = true;
                        break;
                    }
                }
            }

            if (!isOdooModel) {
                tree.delete();
                return failContext;
            }

            // 5. Extract _name and _inherit
            const bodyNode = classNode.childForFieldName('body');
            let modelName = '';
            let inheritName = '';
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
                                inheritName = this.extractInheritValue(right);
                            }
                        }
                    }
                }
            }

            tree.delete();

            // Result Logic:
            // if _name exists, take it.
            // else if _inherit exists, take it.
            // if _name exists, isInherited = !!inheritName (optional, but Odoo usually considers _name + _inherit as extension with new table)
            // But per request: "if not a inherited module return isinherited false and module name if inherited return true and module name"
            // Usually "inherited" in this context means ONLY _inherit (no _name).

            const finalModelName = modelName || inheritName;
            if (!finalModelName) return failContext;

            return {
                valid: true,
                isInherited: !hasName, // If no _name, it's a pure inheritance
                modelName: finalModelName,
                moduleName: moduleName
            };

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

    private static extractInheritValue(node: any): string {
        if (!node) return '';
        if (node.type === 'string') {
            return node.text.slice(1, -1);
        }
        if (node.type === 'list' || node.type === 'tuple') {
            const firstChild = node.namedChildren[0];
            if (firstChild && firstChild.type === 'string') {
                return firstChild.text.slice(1, -1);
            }
        }
        return '';
    }
    /**
     * Gets indexed fields for a specific model.
     */
    static getModelFields(modelName: string): FieldInfo[] {
        return fieldIndexService.getFieldsForModel(modelName);
    }
}
