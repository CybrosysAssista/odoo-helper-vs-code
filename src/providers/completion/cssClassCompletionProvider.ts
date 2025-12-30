
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

        // Optimized retrieval: only get classes for relevant modules instead of iterating all 21k+ classes
        // 'web' usually contains Bootstrap and core styles. 'mail' is also common.
        const relevantModules = new Set<string>([moduleName, 'web', 'mail']);

        const items: vscode.CompletionItem[] = [];
        const usedClasses = new Set<string>();

        for (const mod of relevantModules) {
            const classNames = indexer.getClassesInModule(mod);
            for (const className of classNames) {
                if (usedClasses.has(className) || typedClasses.has(className)) {
                    continue;
                }
                usedClasses.add(className);

                const isBootstrapClass = mod === 'web';
                const item = new vscode.CompletionItem(className, vscode.CompletionItemKind.Constant);
                item.detail = isBootstrapClass ? "CSS Class From Bootstrap" : `CSS Class From ${mod}`;
                items.push(item);
            }
        }

        console.log(`[CssClassCompletion] Returning ${items.length} relevant candidates from modules: ${Array.from(relevantModules).join(', ')}.`);

        return items;
    }
}
