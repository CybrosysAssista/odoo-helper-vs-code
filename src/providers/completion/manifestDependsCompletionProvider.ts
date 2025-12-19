import * as vscode from 'vscode';
import moduleIndexService from '../../services/moduleIndexService';

export class ManifestDependsCompletionProvider implements vscode.CompletionItemProvider {
    constructor() { }

    async provideCompletionItems(document: vscode.TextDocument, position: vscode.Position): Promise<vscode.CompletionItem[] | undefined> {
        const line = document.lineAt(position).text;
        const textBefore = line.substring(0, position.character);

        // Only trigger if the line contains 'depends' and we're inside quotes
        if (!/depends/.test(line) || !/['"]$/.test(textBefore)) return undefined;

        // Extract the partial module name being typed (allow empty string for always suggest)
        const partialMatch = textBefore.match(/['"]([a-zA-Z0-9_\-]*)$/);
        const partial = partialMatch ? partialMatch[1] : '';

        // Get all module names in the workspace
        const moduleNames = await moduleIndexService.getModuleNames();
        return moduleNames
            .filter((name: string) => partial === '' || name.startsWith(partial))
            .map((name: string) => {
                const item = new vscode.CompletionItem(name, vscode.CompletionItemKind.Module);
                item.insertText = name;
                item.detail = 'Odoo Module';
                return item;
            });
    }
}
