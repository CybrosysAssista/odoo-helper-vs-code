import * as vscode from 'vscode';
import { getPythonParserService } from '../../services/pythonParserService';
import modelIndexService from '../../services/modelIndexService';
import moduleIndexService from '../../services/moduleIndexService';

export class ModelInheritCompletionProvider implements vscode.CompletionItemProvider {
    async provideCompletionItems(
        document: vscode.TextDocument,
        position: vscode.Position
    ): Promise<vscode.CompletionItem[]> {
        // 1. Check if it's a valid Odoo module
        const modules = await moduleIndexService.getModules();
        const module = modules.find(m => document.uri.fsPath.startsWith(m.path));
        if (!module) return [];

        const pythonParser = getPythonParserService();
        if (!pythonParser.isInitialized()) return [];

        const text = document.getText();
        const tree = pythonParser.parse(text);
        if (!tree) return [];

        // 2. Find node at cursor
        const offset = document.offsetAt(position);
        // We look slightly before the cursor if it's exactly at a boundary
        const node = tree.rootNode.descendantForIndex(Math.max(0, offset - 1));
        if (!node) return [];

        // 3. Check context: class -> assignment(_inherit) -> string
        if (this.isModelInheritContext(node)) {
            const models = modelIndexService.getAllModelNames();
            return models.map(name => {
                const item = new vscode.CompletionItem(name, vscode.CompletionItemKind.Class);
                item.detail = 'Odoo Model';
                item.documentation = new vscode.MarkdownString(`**Model**: ${name}`);
                return item;
            });
        }

        return [];
    }

    private isModelInheritContext(node: any): boolean {
        let current = node;

        // Traverse up to find if we are in an assignment to _inherit
        let assignmentNode = null;
        let temp = current;
        while (temp) {
            if (temp.type === 'assignment') {
                const left = temp.childForFieldName('left');
                if (left?.text === '_inherit') {
                    assignmentNode = temp;
                    break;
                }
            }
            temp = temp.parent;
        }

        if (!assignmentNode) return false;

        // Ensure we are inside a class definition
        let classNode = assignmentNode.parent;
        while (classNode && classNode.type !== 'class_definition') {
            classNode = classNode.parent;
        }
        if (!classNode) return false;

        // Check if cursor is in the 'right' side of the assignment
        const right = assignmentNode.childForFieldName('right');
        if (!right) return false;

        // Ensure cursor is within the bounds of the right-hand side
        if (current.startIndex < right.startIndex || current.endIndex > right.endIndex) {
            return false;
        }

        // Ensure right side is a supported type (string, list, tuple) or we are inside one
        let inSupportedContainer = false;
        temp = current;
        while (temp && temp.startIndex >= right.startIndex && temp.endIndex <= right.endIndex) {
            if (temp.type === 'string' || temp.type === 'list' || temp.type === 'tuple' || temp.type === 'string_content') {
                inSupportedContainer = true;
                break;
            }
            temp = temp.parent;
        }

        return inSupportedContainer;
    }
}
