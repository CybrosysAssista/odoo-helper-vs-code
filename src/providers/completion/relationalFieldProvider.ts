import * as vscode from 'vscode';
import modelIndexService from '../../services/modelIndexService';

export class RelationalFieldCompletionProvider implements vscode.CompletionItemProvider {
    private fieldTypes: string[];

    constructor() {
        this.fieldTypes = ['Many2one', 'One2many', 'Many2many'];
    }

    provideCompletionItems(document: vscode.TextDocument, position: vscode.Position): vscode.CompletionItem[] {
        const currentLine = document.lineAt(position).text;

        // Check if we're in a fields.Many2one, fields.One2many, or fields.Many2many definition
        const fieldMatch = /fields\.(Many2one|One2many|Many2many)\s*\(\s*['"]([^'"]*)$/.exec(currentLine);
        if (fieldMatch) {
            const fieldType = fieldMatch[1];
            const partialModel = fieldMatch[2];
            return this.provideModelCompletions(partialModel);
        }

        // Check if we're in a compute or inverse method
        const methodMatch = /def\s+(_compute_|_inverse_|_search_)(\w*)$/.exec(currentLine);
        if (methodMatch) {
            return this.provideFieldCompletions(document, position.line, methodMatch[2]);
        }

        return [];
    }

    provideModelCompletions(partialModel: string): vscode.CompletionItem[] {
        const models = modelIndexService.getAllModelNames();
        return models
            .filter(model => model.startsWith(partialModel))
            .map(model => {
                const item = new vscode.CompletionItem(model, vscode.CompletionItemKind.Class);
                item.detail = 'Odoo Model';
                item.documentation = new vscode.MarkdownString(`Model: ${model}`);
                return item;
            });
    }

    /** Fields declared in the class around `line` (from its `class` line to the next top-level statement). */
    provideFieldCompletions(document: vscode.TextDocument, line: number, partialField: string): vscode.CompletionItem[] {
        let start = line;
        while (start >= 0 && !/^class\s+\w+/.test(document.lineAt(start).text)) start--;
        if (start < 0) return [];
        const fields: string[] = [];
        for (let i = start + 1; i < document.lineCount; i++) {
            const text = document.lineAt(i).text;
            if (/^\S/.test(text)) break;  // next top-level class or statement
            const field = /^\s+(\w+)\s*=\s*fields\./.exec(text);
            if (field) fields.push(field[1]);
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
