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
            return templateIndexService_1.default.getAllTemplates()
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
    provideTagCompletions(partialTag) {
        return this.xmlTags
            .filter(tag => tag.startsWith(partialTag))
            .map(tag => new vscode.CompletionItem(tag, vscode.CompletionItemKind.Class));
    }
    provideAttributeCompletions(tagName, partialAttribute) {
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
    getCurrentTag(text) {
        const tagMatch = /<([^/\s>]+)[^>]*$/.exec(text);
        return tagMatch ? tagMatch[1].toLowerCase() : null;
    }
}
exports.OdooXmlCompletionProvider = OdooXmlCompletionProvider;
//# sourceMappingURL=xmlCompletionProvider.js.map