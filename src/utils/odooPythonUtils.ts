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

interface ClassRange {
    startRow: number;
    startColumn: number;
    endRow: number;
    endColumn: number;
    context: OdooModelContext | undefined;
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

            // The model classes of an open document are worked out once per version of its text, so
            // moving the cursor is a lookup rather than a parse.
            const key = uri.toString();
            const cached = openDocument ? this.classCache.get(key) : undefined;
            let classes: ClassRange[];
            if (cached && cached.version === openDocument!.version) {
                classes = cached.classes;
            } else {
                const text = openDocument ? openDocument.getText() : await fs.promises.readFile(uri.fsPath, 'utf8');
                classes = pythonParser.withTree(text, tree =>
                    tree.rootNode.descendantsOfType('class_definition').map((node: any): ClassRange => ({
                        startRow: node.startPosition.row, startColumn: node.startPosition.column,
                        endRow: node.endPosition.row, endColumn: node.endPosition.column,
                        context: this.classContext(node, moduleName),
                    }))) ?? [];
                if (openDocument) {
                    this.classCache.delete(key);
                    this.classCache.set(key, { version: openDocument.version, classes });
                    if (this.classCache.size > 20) this.classCache.delete(this.classCache.keys().next().value!);
                }
            }
            // The innermost class around the position, as before.
            let found: ClassRange | undefined;
            for (const range of classes) {
                const after = position.line > range.startRow || (position.line === range.startRow && position.character >= range.startColumn);
                const before = position.line < range.endRow || (position.line === range.endRow && position.character <= range.endColumn);
                if (after && before && (!found || range.startRow >= found.startRow)) found = range;
            }
            return found?.context ?? failContext;

        } catch (error) {
            console.error('[OdooPythonUtils] Error identifying model context:', error);
            return failContext;
        }
    }

    private static readonly classCache = new Map<string, { version: number; classes: ClassRange[] }>();

    /** The Odoo model a class defines or extends, or undefined when it is not an Odoo model. */
    private static classContext(classNode: any, moduleName: string): OdooModelContext | undefined {
        const superclassesNode = classNode.childForFieldName('superclasses');
        const isOdooModel = !!superclassesNode && superclassesNode.namedChildren.some((arg: any) =>
            ['models.Model', 'models.TransientModel', 'models.AbstractModel', 'Model', 'TransientModel', 'AbstractModel'].includes(arg.text));
        if (!isOdooModel) return undefined;

        const bodyNode = classNode.childForFieldName('body');
        let modelName = '';
        let inheritNames: string[] = [];
        let hasName = false;
        for (const child of bodyNode?.children ?? []) {
            const assignment = child.type === 'expression_statement' ? child.firstChild : null;
            if (assignment?.type !== 'assignment') continue;
            const left = assignment.childForFieldName('left');
            const right = assignment.childForFieldName('right');
            if (left?.text === '_name') {
                hasName = true;
                modelName = this.extractStringValue(right);
            } else if (left?.text === '_inherit') {
                inheritNames = this.extractInheritValue(right);
            }
        }
        // _name if set, else the first _inherit; "inherited" means _inherit without _name.
        const finalModelName = modelName || inheritNames[0] || '';
        if (!finalModelName) return undefined;
        return { valid: true, isInherited: !hasName, modelName: finalModelName, moduleName, inheritedModels: inheritNames };
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
