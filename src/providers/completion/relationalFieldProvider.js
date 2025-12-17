const vscode = require('vscode');
const modelIndexService = require('../../services/modelIndexService');

class RelationalFieldCompletionProvider {
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
        const models = modelIndexService.getAllModels();
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
        if (!classMatch) return [];

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

module.exports = RelationalFieldCompletionProvider; 