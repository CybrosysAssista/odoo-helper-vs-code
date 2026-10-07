
import * as vscode from 'vscode';
import * as path from 'path';
import { OdooModuleUtils } from '../../utils/odooModuleUtils';
import { CssClassIndexer } from '../../services/cssClassIndexer';

export class CssClassCompletionProvider implements vscode.CompletionItemProvider {
    async provideCompletionItems(document: vscode.TextDocument, position: vscode.Position): Promise<vscode.CompletionList | undefined> {
        const linePrefix = document.lineAt(position).text.substr(0, position.character);

        // Check if the cursor is properly positioned inside class="..." or class='...'
        const match = linePrefix.match(/class=["']([^"']*)$/);
        if (!match) {
            return undefined;
        }

        const attrValue = match[1];
        const typedClasses = new Set(attrValue.split(/\s+/).filter(Boolean));
        // The class being typed. Candidates are filtered by it here, so the size limit below never
        // hides a matching class; the list is marked incomplete when cut, and asked for again as
        // typing continues.
        const partial = attrValue.slice(attrValue.search(/\S*$/));

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
                if (usedClasses.has(className) || typedClasses.has(className) || !className.startsWith(partial)) {
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
        let truncated = false;
        for (const [className, mod] of indexer.getAllClasses()) {
            if (usedClasses.has(className) || typedClasses.has(className) || !className.startsWith(partial)) {
                continue;
            }
            usedClasses.add(className);

            const item = new vscode.CompletionItem(className, vscode.CompletionItemKind.Constant);
            item.detail = `Global: ${mod}`;
            item.sortText = `2_${className}`;
            items.push(item);

            if (items.length > 3000) { // Safety limit
                truncated = true;
                break;
            }
        }

        return new vscode.CompletionList(items, truncated);
    }
}
