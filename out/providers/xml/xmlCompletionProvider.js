"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.OdooXmlCompletionProvider = void 0;
const vscode = __importStar(require("vscode"));
const templateIndexService_1 = __importDefault(require("../../services/templateIndexService"));
const data_1 = require("./data");
const odooRegistryIndexer_1 = require("../../services/odooRegistryIndexer");
const xmlParserService_1 = require("../../services/xmlParserService");
const fieldIndexService_1 = __importDefault(require("../../services/fieldIndexService"));
const modelIndexService_1 = __importDefault(require("../../services/modelIndexService"));
const odooModuleUtils_1 = require("../../utils/odooModuleUtils");
const path = __importStar(require("path"));
class OdooXmlCompletionProvider {
    xmlTags = [];
    attributes = {};
    constructor() { }
    async provideCompletionItems(document, position) {
        const meta = await (0, data_1.getXmlMeta)();
        this.xmlTags = meta.xmlTags;
        this.attributes = meta.attributes;
        const text = document.getText();
        const offset = document.offsetAt(position);
        // XML Parser based suggestions
        const xmlParser = (0, xmlParserService_1.getXmlParserService)();
        const node = xmlParser.findNodeAtOffset(text, offset);
        if (node) {
            const textUntilCursor = text.slice(node.start, offset);
            // 1. Suggestions inside <field name="...">
            if (node.tag === 'field') {
                const nameAttrMatch = textUntilCursor.match(/name\s*=\s*(['"])([^'"]*)$/);
                if (nameAttrMatch) {
                    const modelData = odooModuleUtils_1.OdooModuleUtils.getModelMetadata(node, text);
                    if (modelData) {
                        const moduleRoot = await odooModuleUtils_1.OdooModuleUtils.getModuleRoot(document.uri);
                        const currentModule = moduleRoot ? path.basename(moduleRoot.fsPath) : '';
                        let fields = fieldIndexService_1.default.getFieldsForModel(modelData.name);
                        if (modelData.isUnique) {
                            fields = fields.filter(f => !f.isInherited);
                        }
                        else {
                            fields = fields.filter(f => !f.isInherited || (f.isInherited && f.moduleName === currentModule));
                        }
                        // Remove duplicates by field name
                        const uniqueFields = new Map();
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
                const recordModel = odooModuleUtils_1.OdooModuleUtils.getRecordModel(node, text);
                if (recordModel) {
                    if ((recordModel === 'ir.ui.view' && attrs['name'] === 'model') ||
                        (recordModel === 'ir.actions.act_window' && attrs['name'] === 'res_model')) {
                        return modelIndexService_1.default.getAllModelNames().map(name => {
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
                            const registryIndexer = (0, odooRegistryIndexer_1.getOdooRegistryIndexer)();
                            return registryIndexer.getEntriesByCategory('actions')
                                .map((entry) => {
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
                    return modelIndexService_1.default.getAllModelNames()
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
                return templateIndexService_1.default.getAllTemplates()
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
                const registryIndexer = (0, odooRegistryIndexer_1.getOdooRegistryIndexer)();
                return registryIndexer.getEntriesByCategory('fields')
                    .filter((entry) => entry.id.startsWith(partial))
                    .map((entry) => {
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
                    const registryIndexer = (0, odooRegistryIndexer_1.getOdooRegistryIndexer)();
                    return registryIndexer.getEntriesByCategory('public_components')
                        .filter((entry) => entry.id.startsWith(partial))
                        .map((entry) => {
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
    provideTagCompletions(partialTag) {
        return this.xmlTags
            .filter(tag => tag.startsWith(partialTag))
            .map(tag => new vscode.CompletionItem(tag, vscode.CompletionItemKind.Class));
    }
    provideAttributeCompletions(tagName, partialAttribute) {
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
    getCurrentTag(text) {
        const tagMatch = /<([^/\s>]+)[^>]*$/.exec(text);
        return tagMatch ? tagMatch[1].toLowerCase() : null;
    }
}
exports.OdooXmlCompletionProvider = OdooXmlCompletionProvider;
//# sourceMappingURL=xmlCompletionProvider.js.map