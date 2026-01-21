import * as vscode from 'vscode';
import templateIndexService from '../../services/templateIndexService';
import { getXmlMeta } from './data';
import { getOdooRegistryIndexer, RegistryEntry } from '../../services/odooRegistryIndexer';
import { getXmlParserService } from '../../services/xmlParserService';
import fieldIndexService from '../../services/fieldIndexService';
import modelIndexService from '../../services/modelIndexService';
import functionIndexService from '../../services/functionIndexService';
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

        if (node) {
            const textUntilCursor = text.slice(node.start, offset);

            if (node.tag === 'button') {
                const nameAttrMatch = textUntilCursor.match(/name\s*=\s*(['"])([^'"]*)$/);
                if (nameAttrMatch) {
                    const modelData = OdooModuleUtils.getModelMetadata(node, text);
                    if (modelData) {
                        const attributes = xmlParser.getAttributes(text, node);
                        // Use a more relaxed check for button type
                        const isObjectButton = attributes["type"]?.toLowerCase() === "object";
                        if (isObjectButton) {
                            const moduleRoot = await OdooModuleUtils.getModuleRoot(document.uri);
                            const currentModule = moduleRoot ? path.basename(moduleRoot.fsPath) : '';

                            let functions = functionIndexService.getFunctionsForModel(modelData.name);

                            // Align with field logic: base functions + functions defined in current module
                            functions = functions.filter(f => !f.isInherited || (f.isInherited && f.moduleName === currentModule));

                            // Remove duplicates
                            const uniqueFuncs = new Map<string, any>();
                            for (const f of functions) {
                                if (!uniqueFuncs.has(f.functionName)) {
                                    uniqueFuncs.set(f.functionName, f);
                                }
                            }

                            return Array.from(uniqueFuncs.values()).map(f => {
                                const item = new vscode.CompletionItem(f.functionName, vscode.CompletionItemKind.Method);
                                item.detail = `Method (${f.moduleName})`;
                                item.documentation = new vscode.MarkdownString(`**Model:** ${f.modelName}\n\n**Parameters:** (${f.parameters.join(', ')})\n\n**Module:** ${f.moduleName}`);
                                return item;
                            });
                        }
                    }
                }
            }

            // 1. Suggestions inside <field name="...">
            if (node.tag === 'field' || node.tag === 'filter') {
                const nameAttrMatch = textUntilCursor.match(/name\s*=\s*(['"])([^'"]*)$/);
                if (nameAttrMatch) {
                    const modelData = OdooModuleUtils.getModelMetadata(node, text);
                    if (modelData) {
                        const moduleRoot = await OdooModuleUtils.getModuleRoot(document.uri);
                        const currentModule = moduleRoot ? path.basename(moduleRoot.fsPath) : '';

                        let fields = fieldIndexService.getFieldsForModel(modelData.name);
                        if (modelData.isUnique) {
                            fields = fields.filter(f => !f.isInherited);
                        } else {
                            fields = fields.filter(f => !f.isInherited || (f.isInherited && f.moduleName === currentModule));
                        }

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
            }

            // 2. Suggest model names inside <field name="model">...</field>
            if (node.tag === 'field' && node.startTagEnd !== undefined && offset >= node.startTagEnd && (node.endTagStart === undefined || offset <= node.endTagStart)) {
                const attrs = xmlParser.getAttributes(text, node);
                const recordModel = OdooModuleUtils.getRecordModel(node, text);
                if (recordModel) {
                    if (
                        (recordModel === 'ir.ui.view' && attrs['name'] === 'model') ||
                        (recordModel === 'ir.actions.act_window' && attrs['name'] === 'res_model')
                    ) {
                        return modelIndexService.getAllModelNames().map(name => {
                            const item = new vscode.CompletionItem(name, vscode.CompletionItemKind.Class);
                            item.detail = 'Odoo Model';
                            return item;
                        });
                    }

                    if (recordModel === 'ir.actions.act_window') {
                        if (attrs['name'] === 'view_mode') {
                            return ['tree', 'form', 'kanban', 'list', 'pivot', 'graph', 'calendar'].map(mode => {
                                const item = new vscode.CompletionItem(mode, vscode.CompletionItemKind.EnumMember);
                                item.insertText = mode;
                                return item;
                            });
                        }
                    }

                    if (recordModel === 'ir.actions.client') {
                        if (attrs['name'] === 'tag') {
                            const registryIndexer = getOdooRegistryIndexer();
                            return registryIndexer.getEntriesByCategory('actions')
                                .map((entry: RegistryEntry) => {
                                    const item = new vscode.CompletionItem(entry.id, vscode.CompletionItemKind.Value);
                                    item.detail = `Module: ${entry.moduleName}`;
                                    item.documentation = new vscode.MarkdownString(`**Component:** ${entry.component}\n\n**File:** ${entry.filePath}:${entry.line}`);
                                    return item;
                                });
                        }
                    }
                }
            }

            // 3. Suggest model names inside <record model="...">
            if (node.tag === 'record') {
                const modelAttrMatch = textUntilCursor.match(/model\s*=\s*(['"])([^'"]*)$/);
                if (modelAttrMatch) {
                    const partial = modelAttrMatch[2] || '';
                    return modelIndexService.getAllModelNames()
                        .filter(name => name.startsWith(partial))
                        .map(name => {
                            const item = new vscode.CompletionItem(name, vscode.CompletionItemKind.Class);
                            item.detail = 'Odoo Model';
                            return item;
                        });
                }
            }

            // 4. Xpath position attribute value suggestions
            const xpathPositionMatch = textUntilCursor.match(/position\s*=\s*['"]([^'"]*)$/);
            if (node.tag === 'xpath' && xpathPositionMatch) {
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

            // 5. Find if we're inside t-call="..."
            const tcallMatch = textUntilCursor.match(/t-call\s*=\s*['"]([^'"]*)$/);
            if (node.tag === 't' && tcallMatch) {
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

            // 6. Find if we're inside widget="..." (any tag)
            const widgetMatch = textUntilCursor.match(/\bwidget\s*=\s*(['"])([^'"]*)$/);
            if (node.tag == 'field' && widgetMatch) {
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

            if (node.tag === 't') {
                const tComponentMatch = textUntilCursor.match(/t-component\s*=\s*(['"])([^'"]*)$/);
                if (tComponentMatch) {
                    const partial = tComponentMatch[2] || '';
                    const registryIndexer = getOdooRegistryIndexer();
                    return registryIndexer.getEntriesByCategory('public_components')
                        .filter((entry: RegistryEntry) => entry.id.startsWith(partial))
                        .map((entry: RegistryEntry) => {
                            const item = new vscode.CompletionItem(entry.id, vscode.CompletionItemKind.Value);
                            item.detail = `Module: ${entry.moduleName}`;
                            item.documentation = new vscode.MarkdownString(`**Component:** ${entry.component}\n\n**File:** ${entry.filePath}:${entry.line}`);
                            return item;
                        });
                }
            }

            if (node.tag === 'owl-component') {
                const nameMatch = textUntilCursor.match(/name\s*=\s*(['"])([^'"]*)$/);
                if (nameMatch) {
                    const partial = nameMatch[2] || '';
                    const registryIndexer = getOdooRegistryIndexer();
                    return registryIndexer.getEntriesByCategory('public_components')
                        .filter((entry: RegistryEntry) => entry.id.startsWith(partial))
                        .map((entry: RegistryEntry) => {
                            const item = new vscode.CompletionItem(entry.id, vscode.CompletionItemKind.Value);
                            item.detail = `Module: ${entry.moduleName}`;
                            item.documentation = new vscode.MarkdownString(`**Component:** ${entry.component}\n\n**File:** ${entry.filePath}:${entry.line}`);
                            return item;
                        });
                }
            }
        }

        // Generic tag and attribute completions
        const currentLine = document.lineAt(position).text;
        const tagMatch = /<([^>]*)$/.exec(currentLine);
        if (tagMatch) {
            return this.provideTagCompletions(tagMatch[1]);
        }

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
        if (!attributes.includes('widget')) {
            attributes.push('widget');
        }
        return attributes
            .filter(attr => attr.startsWith(partialAttribute))
            .map(attr => {
                const item = new vscode.CompletionItem(attr, vscode.CompletionItemKind.Property);
                item.insertText = new vscode.SnippetString(`${attr}="$1"`);
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
