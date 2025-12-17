const vscode = require('vscode');
const templateIndexService = require('../../services/templateIndexService');
const { getXmlMeta } = require('./data');

class OdooXmlCompletionProvider {
    constructor() { }

    async provideCompletionItems(document, position) {
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
            return this.provideAttributeCompletions(tagName, attributeMatch[1]);
        }

        return [];
    }

    provideTagCompletions(partialTag) {
        return this.xmlTags
            .filter(tag => tag.startsWith(partialTag))
            .map(tag => new vscode.CompletionItem(tag, vscode.CompletionItemKind.Class));
    }

    provideAttributeCompletions(tagName, partialAttribute) {
        const attributes = this.attributes[tagName] || [];
        return attributes
            .filter(attr => attr.startsWith(partialAttribute))
            .map(attr => {
                const item = new vscode.CompletionItem(attr, vscode.CompletionItemKind.Property);
                item.insertText = new vscode.SnippetString(`${attr}="$1"`);
                return item;
            });
    }

    getCurrentTag(text) {
        const tagMatch = /<([^/\s>]+)[^>]*$/.exec(text);
        return tagMatch ? tagMatch[1].toLowerCase() : null;
    }
}

module.exports = OdooXmlCompletionProvider; 