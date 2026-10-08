import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { getPythonParserService } from '../services/pythonParserService';
import { OdooModuleUtils } from '../utils/odooModuleUtils';

/**
 * Provides path completion for Odoo manifest files (data, demo, assets)
 */
export class ManifestPathCompletionProvider implements vscode.CompletionItemProvider {

    async provideCompletionItems(
        document: vscode.TextDocument,
        position: vscode.Position,
        token: vscode.CancellationToken,
        context: vscode.CompletionContext
    ): Promise<vscode.CompletionList | vscode.CompletionItem[]> {

        const parserService = getPythonParserService();
        if (!parserService.isInitialized()) {
            return [];
        }

        // 1. Verify we are in a manifest 'path' list (data, demo, assets, etc.)
        const manifestKey = parserService.withTree(document.getText(), tree => {
            // Get the node at the current cursor position
            // We look slightly to the left if we are at the end of a node to stay within the string
            const node = tree.rootNode.descendantForPosition({
                row: position.line,
                column: position.character > 0 ? position.character - 1 : position.character
            });
            return node ? this.getManifestContextKey(node) : null;
        });
        if (!manifestKey) {
            return [];
        }

        // 2. Extract path and search prefix from the current line
        const partialInfo = this.getPartialPathInfo(document, position);
        if (!partialInfo) {
            return [];
        }

        const items = await this.getPathCompletions(document, position, partialInfo, manifestKey === 'assets');

        // Return as incomplete list so VS Code re-triggers on every character
        return new vscode.CompletionList(items, true);
    }

    /**
     * Walks up the tree to see if we are inside a list that belongs to a manifest key.
     */
    private getManifestContextKey(node: any): string | null {
        let current = node;

        // Search up for a list node.
        while (current) {
            if (current.type === 'list') {
                const parent = current.parent;
                if (parent && parent.type === 'pair') {
                    const keyNode = parent.childForFieldName('key');
                    const key = keyNode?.text.replace(/['"]/g, '');

                    // Direct cases: 'data', 'demo'
                    if (['data', 'demo'].includes(key || "")) return key || "";

                    // Asset case: List -> Pair -> Dictionary -> Pair (key: 'assets')
                    const grandparent = parent.parent; // dictionary
                    if (grandparent && grandparent.type === 'dictionary') {
                        const greatGrandparent = grandparent.parent; // pair
                        if (greatGrandparent && greatGrandparent.type === 'pair') {
                            const rootKeyNode = greatGrandparent.childForFieldName('key');
                            const rootKey = rootKeyNode?.text.replace(/['"]/g, '');
                            if (rootKey === 'assets') return 'assets';
                        }
                    }
                }
            }
            current = current.parent;
        }

        return null;
    }

    /**
     * More aggressive path extraction from the line text
     */
    private getPartialPathInfo(document: vscode.TextDocument, position: vscode.Position) {
        const lineText = document.lineAt(position.line).text;
        const lineToCursor = lineText.substring(0, position.character);

        // Find the start of the string by looking for the last quote on this line before cursor
        const lastSingle = lineToCursor.lastIndexOf("'");
        const lastDouble = lineToCursor.lastIndexOf('"');
        const startPos = Math.max(lastSingle, lastDouble);

        if (startPos === -1) return null;

        // Content after the quote up to the cursor
        const pathString = lineToCursor.substring(startPos + 1);

        const lastSlash = pathString.lastIndexOf('/');
        const dirRelPath = lastSlash !== -1 ? pathString.substring(0, lastSlash) : "";
        const searchPrefix = lastSlash !== -1 ? pathString.substring(lastSlash + 1) : pathString;

        return { dirRelPath, searchPrefix, documentUri: document.uri };
    }

    private async getPathCompletions(
        document: vscode.TextDocument,
        position: vscode.Position,
        info: { dirRelPath: string; searchPrefix: string; documentUri: vscode.Uri },
        isAsset: boolean
    ): Promise<vscode.CompletionItem[]> {
        const moduleRoot = await OdooModuleUtils.getModuleRoot(info.documentUri);
        if (!moduleRoot) return [];
        const moduleName = path.basename(moduleRoot.fsPath);

        // Asset paths start with the module name (`my_module/static/...`): resolve them from the
        // addons folder. `data`/`demo` paths are relative to the module.
        const [first] = info.dirRelPath.split('/');
        const base = isAsset && first === moduleName ? path.dirname(moduleRoot.fsPath) : moduleRoot.fsPath;
        const searchPath = path.join(base, info.dirRelPath);

        try {
            const entries: fs.Dirent[] = isAsset && info.dirRelPath === ''
                ? [] // the first segment of an asset path is the module itself
                : await listDirectory(searchPath);
            const extra = isAsset && info.dirRelPath === '' ? [moduleName] : [];

            // Critical: The range must cover exactly the part of the word already typed
            const replacementRange = new vscode.Range(
                position.translate(0, -info.searchPrefix.length),
                position
            );

            const folderItems = extra
                .filter(name => name.toLowerCase().startsWith(info.searchPrefix.toLowerCase()))
                .map(name => {
                    const item = new vscode.CompletionItem(name, vscode.CompletionItemKind.Folder);
                    item.range = new vscode.Range(position.translate(0, -info.searchPrefix.length), position);
                    item.insertText = name + '/';
                    item.command = { command: 'editor.action.triggerSuggest', title: 'Re-trigger completions' };
                    return item;
                });
            return folderItems.concat(entries
                .filter(entry => !entry.name.startsWith('.'))
                .filter(entry => entry.name.toLowerCase().startsWith(info.searchPrefix.toLowerCase()))
                .map(entry => {
                    const item = new vscode.CompletionItem(
                        entry.name,
                        entry.isDirectory() ? vscode.CompletionItemKind.Folder : vscode.CompletionItemKind.File
                    );

                    item.range = replacementRange;

                    if (entry.isDirectory()) {
                        item.insertText = entry.name + '/';
                        // Re-trigger suggestions after a slash
                        item.command = { command: 'editor.action.triggerSuggest', title: 'Re-trigger completions' };
                    }

                    return item;
                }));
        } catch (error) {
            return [];
        }
    }
}

/** Directory listings, kept for a moment: completion asks again on every keystroke. */
const listings = new Map<string, { at: number; entries: Promise<fs.Dirent[]> }>();
const LISTING_TTL_MS = 2000;

function listDirectory(dir: string): Promise<fs.Dirent[]> {
    const now = Date.now();
    const cached = listings.get(dir);
    if (cached && now - cached.at < LISTING_TTL_MS) return cached.entries;
    const entries = fs.promises.readdir(dir, { withFileTypes: true }).catch(() => [] as fs.Dirent[]);
    listings.set(dir, { at: now, entries });
    if (listings.size > 50) listings.delete(listings.keys().next().value!);
    return entries;
}
