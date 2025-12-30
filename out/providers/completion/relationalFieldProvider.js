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
exports.RelationalFieldCompletionProvider = void 0;
const vscode = __importStar(require("vscode"));
const modelIndexService_1 = __importDefault(require("../../services/modelIndexService"));
class RelationalFieldCompletionProvider {
    fieldTypes;
    constructor() {
        this.fieldTypes = ['Many2one', 'One2many', 'Many2many'];
    }
    provideCompletionItems(document, position) {
        const textUntilPosition = document.getText(new vscode.Range(new vscode.Position(0, 0), position));
        const currentLine = document.lineAt(position).text;
        // Check if we're in a fields.Many2one, fields.One2many, or fields.Many2many definition
        const fieldMatch = /fields\.(Many2one|One2many|Many2many)\s*\(\s*['"]([^'"]*)$/.exec(currentLine);
        if (fieldMatch) {
            const fieldType = fieldMatch[1];
            const partialModel = fieldMatch[2];
            return this.provideModelCompletions(partialModel);
        }
        // Check if we're in a compute or inverse method
        const methodMatch = /def\s+(_compute_|_inverse_|_search_)([^_]*)$/.exec(currentLine);
        if (methodMatch) {
            const methodType = methodMatch[1];
            const partialField = methodMatch[2];
            return this.provideFieldCompletions(document, partialField);
        }
        return [];
    }
    provideModelCompletions(partialModel) {
        const models = modelIndexService_1.default.getAllModelNames();
        return models
            .filter(model => model.startsWith(partialModel))
            .map(model => {
            const item = new vscode.CompletionItem(model, vscode.CompletionItemKind.Class);
            item.detail = 'Odoo Model';
            item.documentation = new vscode.MarkdownString(`Model: ${model}`);
            return item;
        });
    }
    provideFieldCompletions(document, partialField) {
        const text = document.getText();
        const classMatch = /class\s+(\w+)\s*\([^)]*Model[^)]*\)[^{]*{([^}]*)}/gs.exec(text);
        if (!classMatch)
            return [];
        const classContent = classMatch[2];
        const fieldRegex = /(\w+)\s*=\s*fields\./g;
        let fieldMatch;
        const fields = [];
        while ((fieldMatch = fieldRegex.exec(classContent)) !== null) {
            fields.push(fieldMatch[1]);
        }
        return fields
            .filter(field => field.startsWith(partialField))
            .map(field => {
            const item = new vscode.CompletionItem(field, vscode.CompletionItemKind.Field);
            item.detail = 'Field';
            return item;
        });
    }
}
exports.RelationalFieldCompletionProvider = RelationalFieldCompletionProvider;
//# sourceMappingURL=relationalFieldProvider.js.map