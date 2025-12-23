import * as vscode from 'vscode';
import templateIndexService from '../../services/templateIndexService';
import { getXmlMeta } from './data';
import { getOdooRegistryIndexer, RegistryEntry } from '../../services/odooRegistryIndexer';
import { getXmlParserService } from '../../services/xmlParserService';
import fieldIndexService from '../../services/fieldIndexService';
import { OdooModuleUtils } from '../../utils/odooModuleUtils';
import * as path from 'path';

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

        // XML Parser based suggestions
        const xmlParser = getXmlParserService();
        const node = xmlParser.findNodeAtOffset(text, offset);
        console.log(`Node: ${node}`);
        if (node && node.tag === 'field') {
            const textUntilCursor = text.slice(node.start, offset);

            // Check if offset is inside name attribute value
            console.log(`Text until cursor: ${textUntilCursor}`);
            const nameAttrMatch = textUntilCursor.match(/name\s*=\s*(['"])([^'"]*)$/);
            console.log(`Name attr match: ${nameAttrMatch}`);

            let modelData: { name: string, isUnique: boolean } | null = null;
            if (nameAttrMatch) {
                let parentNode = node;
                while (parentNode.parent) {
                    if (parentNode.tag === 'record') {
                        const attrs = xmlParser.getAttributes(text, parentNode);
                        modelData = {
                            name: attrs['model'],
                            isUnique: true
                        };
                        break;
                    }

                    if (parentNode.tag && [
                        'form', 'tree', 'list', 'kanban', 'pivot', 'search'
                    ].includes(parentNode.tag)) {
                        const archField = parentNode.parent;
                        if (archField && archField.parent) {
                            const recordNode = archField.parent;
                            const modelField = recordNode.children?.find(c => {
                                if (c.tag === 'field') {
                                    const attrs = xmlParser.getAttributes(text, c);
                                    return attrs['name'] === 'model';
                                }
                                return false;
                            });

                            if (modelField && modelField.startTagEnd !== undefined && modelField.endTagStart !== undefined) {
                                const modelName = text.slice(modelField.startTagEnd, modelField.endTagStart).trim();
                                modelData = {
                                    name: modelName,
                                    isUnique: true
                                };
                                break;
                            }
                        }
                    }
                    parentNode = parentNode.parent;
                }

                if (!modelData) {
                    return [];
                }


                if (!modelData) {
                    return [];
                }

                const moduleRoot = await OdooModuleUtils.getModuleRoot(document.uri);
                const currentModule = moduleRoot ? path.basename(moduleRoot.fsPath) : '';

                let fields = fieldIndexService.getFieldsForModel(modelData.name);

                if (modelData.isUnique) {
                    // if isunique true search for fields with same model and not inherited
                    fields = fields.filter(f => !f.isInherited);
                } else {
                    // if false search for the fields with same model and not inherited, 
                    // also fields are with same model, if inherited then the module name should match
                    fields = fields.filter(f => !f.isInherited || (f.isInherited && f.moduleName === currentModule));
                }

                console.log(`Found ${fields.length} matching fields for model ${modelData.name}`);

                // Remove duplicates by field name
                const uniqueFields = new Map<string, any>();
                for (const f of fields) {
                    if (!uniqueFields.has(f.fieldName)) {
                        uniqueFields.set(f.fieldName, f);
                    }
                }

                return Array.from(uniqueFields.values()).map(f => {
                    const item = new vscode.CompletionItem(f.fieldName, vscode.CompletionItemKind.Field);
                    item.detail = `${f.fieldType} (${f.moduleName})`;
                    item.documentation = new vscode.MarkdownString(`**Type:** ${f.fieldType}\n\n**Module:** ${f.moduleName}`);
                    return item;
                });
            }
        }

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
