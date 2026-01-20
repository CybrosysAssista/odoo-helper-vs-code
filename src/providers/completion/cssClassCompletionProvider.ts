
import * as vscode from 'vscode';
import * as path from 'path';
import { OdooModuleUtils } from '../../utils/odooModuleUtils';
import { CssClassIndexer } from '../../services/cssClassIndexer';

export class CssClassCompletionProvider implements vscode.CompletionItemProvider {
    async provideCompletionItems(document: vscode.TextDocument, position: vscode.Position): Promise<vscode.CompletionItem[] | undefined> {
        const linePrefix = document.lineAt(position).text.substr(0, position.character);

        // Check if the cursor is properly positioned inside class="..." or class='...'
        const match = linePrefix.match(/class=["']([^"']*)$/);
        if (!match) {
            return undefined;
        }

        const attrValue = match[1];
        const typedClasses = new Set(attrValue.split(/\s+/).filter(Boolean));

        const moduleRoot = await OdooModuleUtils.getModuleRoot(document.uri);
        if (!moduleRoot) {
            return undefined;
        }

        const moduleName = path.basename(moduleRoot.fsPath);

        const indexer = CssClassIndexer.getInstance();

        // High priority modules
        const priorityModules = new Set<string>([moduleName, 'web', 'base', 'mail', 'portal']);

        const items: vscode.CompletionItem[] = [];
        const usedClasses = new Set<string>();

        // 1. Add classes from priority modules first
        for (const mod of priorityModules) {
            const classNames = indexer.getClassesInModule(mod);
            for (const className of classNames) {
                if (usedClasses.has(className) || typedClasses.has(className)) {
                    continue;
                }
                usedClasses.add(className);

                const isCore = ['web', 'base', 'mail', 'portal'].includes(mod);
                const item = new vscode.CompletionItem(className, vscode.CompletionItemKind.Constant);
                item.detail = isCore ? `Odoo Core: ${mod}` : `Module: ${mod}`;
                item.sortText = isCore ? `0_${className}` : `1_${className}`;
                items.push(item);
            }
        }

        // 2. Add ALL other remaining classes (up to a limit for performance)
        // This ensures that even if we misidentified a module, or it's a 3rd party addon, the class is found.
        const allUniqueClasses = indexer.getState().cssClasses;
        for (const [className, defs] of allUniqueClasses) {
            if (usedClasses.has(className) || typedClasses.has(className)) {
                continue;
            }
            usedClasses.add(className);

            const item = new vscode.CompletionItem(className, vscode.CompletionItemKind.Constant);
            const mod = defs[0]?.moduleName || 'unknown';
            item.detail = `Global: ${mod}`;
            item.sortText = `2_${className}`;
            items.push(item);

            if (items.length > 3000) break; // Safety limit
        }

        // console.log(`[CssClassCompletion] Returned ${items.length} candidates. (Project total: ${allUniqueClasses.length} unique classes)`);

        return items;
    }
}
