import * as vscode from 'vscode';
import templateIndexService from '../../services/templateIndexService';
import { getXmlMeta } from './data';
import { getOdooRegistryIndexer, RegistryEntry } from '../../services/odooRegistryIndexer';

export class OdooXmlCompletionProvider implements vscode.CompletionItemProvider {
    private xmlTags: string[] = [];
    private attributes: { [key: string]: string[] } = {};

    constructor() { }

    async provideCompletionItems(document: vscode.TextDocument, position: vscode.Position): Promise<vscode.CompletionItem[] | undefined> {
        const meta = await getXmlMeta();
        this.xmlTags = meta.xmlTags;
        this.attributes = meta.attributes;
        const text = document.getText();
        const offset = document.offsetAt(position);

        // Xpath position attribute value suggestions
        const before = text.slice(0, offset);
        // Check if we're editing position attribute in an xpath tag
        const xpathPositionMatch = before.match(/<xpath[^>]*\bposition\s*=\s*['"]([^'"]*)$/);
        if (xpathPositionMatch) {
            const partial = xpathPositionMatch[1] || '';
            const positions = ['after', 'before', 'inside', 'replace', 'attributes'];
            return positions
                .filter(pos => pos.startsWith(partial))
                .map(pos => {
                    const item = new vscode.CompletionItem(pos, vscode.CompletionItemKind.EnumMember);
                    item.insertText = pos;
                    item.detail = 'Odoo Xpath Position';
                    return item;
                });
        }

        // Find if we're inside t-call="..."
        const tcallMatch = before.match(/<t[^>]*\bt-call\s*=\s*['"]([^'"]*)$/);
        if (tcallMatch) {
            const partial = tcallMatch[1] || '';
            return templateIndexService.getAllTemplates()
                .filter(tpl => tpl.startsWith(partial))
                .map(tpl => {
                    const item = new vscode.CompletionItem(tpl, vscode.CompletionItemKind.Reference);
                    item.insertText = tpl;
                    item.detail = 'Odoo QWeb Template';
                    return item;
                });
        }

        // Find if we're inside widget="..." (must have opening quote)
        const widgetMatch = before.match(/<[^>]*\bwidget\s*=\s*(['"])([^'"]*)$/);
        if (widgetMatch) {
            const partial = widgetMatch[2] || '';
            const registryIndexer = getOdooRegistryIndexer();
            return registryIndexer.getEntriesByCategory('fields')
                .filter((entry: RegistryEntry) => entry.id.startsWith(partial))
                .map((entry: RegistryEntry) => {
                    const item = new vscode.CompletionItem(entry.id, vscode.CompletionItemKind.Value);
                    item.detail = `Module: ${entry.moduleName}`;
                    item.documentation = new vscode.MarkdownString(`**Component:** ${entry.component}\n\n**File:** ${entry.filePath}:${entry.line}`);
                    return item;
                });
        }

        // Check if we're inside a tag
        const currentLine = document.lineAt(position).text;
        const tagMatch = /<([^>]*)$/.exec(currentLine);
        if (tagMatch) {
            return this.provideTagCompletions(tagMatch[1]);
        }

        // Check if we're inside an attribute
        const textUntilPosition = document.getText(new vscode.Range(new vscode.Position(0, 0), position));
        const attributeMatch = /<[^>]*\s+([^=]*)$/.exec(currentLine);
        if (attributeMatch) {
            const tagName = this.getCurrentTag(textUntilPosition);
            if (tagName) {
                return this.provideAttributeCompletions(tagName, attributeMatch[1]);
            }
        }

        return [];
    }

    provideTagCompletions(partialTag: string): vscode.CompletionItem[] {
        return this.xmlTags
            .filter(tag => tag.startsWith(partialTag))
            .map(tag => new vscode.CompletionItem(tag, vscode.CompletionItemKind.Class));
    }

    provideAttributeCompletions(tagName: string, partialAttribute: string): vscode.CompletionItem[] {
        const attributes = this.attributes[tagName] || [];

        // Always ensure 'widget' is available as it's very common
        if (!attributes.includes('widget')) {
            attributes.push('widget');
        }

        return attributes
            .filter(attr => attr.startsWith(partialAttribute))
            .map(attr => {
                const item = new vscode.CompletionItem(attr, vscode.CompletionItemKind.Property);
                item.insertText = new vscode.SnippetString(`${attr}="$1"`);

                // If it's the widget attribute, trigger suggestions for its values immediately after insertion
                if (attr === 'widget') {
                    item.command = {
                        command: 'editor.action.triggerSuggest',
                        title: 'Suggest Widgets'
                    };
                }

                return item;
            });
    }

    getCurrentTag(text: string): string | null {
        const tagMatch = /<([^/\s>]+)[^>]*$/.exec(text);
        return tagMatch ? tagMatch[1].toLowerCase() : null;
    }
}
