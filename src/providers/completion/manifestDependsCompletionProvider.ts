import * as vscode from 'vscode';
import { getPythonParserService } from '../../services/pythonParserService';
import { moduleIndexService } from '../../services/moduleIndexService';

/**
 * Provides Odoo module name suggestions for the 'depends' list in manifest files.
 */
export class ManifestDependsCompletionProvider implements vscode.CompletionItemProvider {

    async provideCompletionItems(
        document: vscode.TextDocument,
        position: vscode.Position
    ): Promise<vscode.CompletionList | vscode.CompletionItem[]> {

        const parserService = getPythonParserService();
        if (!parserService.isInitialized()) {
            return [];
        }

        const tree = parserService.parse(document.getText());
        if (!tree) {
            return [];
        }

        // Get the node at the current cursor position
        let node = tree.rootNode.descendantForPosition({
            row: position.line,
            column: position.character > 0 ? position.character - 1 : position.character
        });

        if (!node) {
            return [];
        }

        // 1. Verify we are in a manifest 'depends' list
        if (!this.isInDependsContext(node)) {
            return [];
        }

        // 2. Extract partial text for filtering
        const lineText = document.lineAt(position.line).text;
        const lineToCursor = lineText.substring(0, position.character);
        const lastQuote = Math.max(lineToCursor.lastIndexOf("'"), lineToCursor.lastIndexOf('"'));

        if (lastQuote === -1) return [];
        const prefix = lineToCursor.substring(lastQuote + 1);

        // 3. Get modules from our new high-speed index
        const modules = moduleIndexService.getModules();

        const replacementRange = new vscode.Range(
            position.translate(0, -prefix.length),
            position
        );

        return modules
            .filter(mod => mod.name.toLowerCase().startsWith(prefix.toLowerCase()))
            .map(mod => {
                const item = new vscode.CompletionItem(mod.name, vscode.CompletionItemKind.Module);
                item.detail = 'Odoo Module Name';
                item.documentation = new vscode.MarkdownString(`Path: \`${mod.path}\``);
                item.range = replacementRange;
                return item;
            });
    }

    /**
     * Context check: Go up the tree to find if the parent list belongs to 'depends'
     */
    private isInDependsContext(node: any): boolean {
        let current = node;
        while (current) {
            // If we are in a list, check the key of its parent pair
            if (current.type === 'list') {
                const pair = current.parent;
                if (pair && pair.type === 'pair') {
                    const key = pair.childForFieldName('key')?.text.replace(/['"]/g, '');
                    if (key === 'depends') return true;
                }
            }
            // Sometimes we are looking directly at a pair if the list is empty
            if (current.type === 'pair') {
                const key = current.childForFieldName('key')?.text.replace(/['"]/g, '');
                if (key === 'depends') return true;
            }
            current = current.parent;
        }
        return false;
    }
}
