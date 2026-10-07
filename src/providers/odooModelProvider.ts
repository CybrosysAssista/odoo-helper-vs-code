import * as vscode from 'vscode';
import modelIndexService from '../services/modelIndexService';
import fieldIndexService from '../services/fieldIndexService';

interface FieldMeta {
    type: string;
    related: string | null;
}

const RELATIONAL_TYPES = new Set(['Many2one', 'One2many', 'Many2many']);

/**
 * Fields of `modelName` across every module that defines or extends it, from the field index.
 * Built per request from that one model's entries, so nothing is scanned and nothing goes stale.
 */
function fieldsOf(modelName: string): { [fieldName: string]: FieldMeta } | undefined {
    const fields = fieldIndexService.getFieldsForModel(modelName);
    if (fields.length === 0) return undefined;
    const result: { [fieldName: string]: FieldMeta } = {};
    for (const field of fields) {
        result[field.fieldName] = {
            type: field.fieldType,
            related: RELATIONAL_TYPES.has(field.fieldType) ? field.attributes['comodel_name'] || null : null
        };
    }
    return result;
}

export function registerModelProviders(context: vscode.ExtensionContext) {

    // Python: model names for _inherit or env[...] 
    const ModelProvider = vscode.languages.registerCompletionItemProvider(
        'python',
        {
            provideCompletionItems(document, position) {
                const line = document.lineAt(position);
                const textBefore = line.text.substring(0, position.character);

                const inheritContextRegex = /_inherit\s*=\s*(\[.*)?['"]?[^'"]*$/;
                const envContextRegex = /env\[\s*['"]?[^'"]*$/;
                const fieldModelRegex = /fields\.(Many2one|One2many|Many2many)\(\s*['"]?[^'"]*$/;
                const comodelNameRegex = /comodel_name\s*=\s*['"]?[^'"]*$/;

                if (
                    !inheritContextRegex.test(textBefore) &&
                    !envContextRegex.test(textBefore) &&
                    !fieldModelRegex.test(textBefore) &&
                    !comodelNameRegex.test(textBefore)
                ) {
                    return;
                }

                return modelIndexService.getAllModelNames().map(name => {
                    const item = new vscode.CompletionItem(`'${name}'`, vscode.CompletionItemKind.Value);
                    const lastChar = textBefore.trim().slice(-1);
                    item.insertText = (lastChar === `'` || lastChar === `"`) ? name : `'${name}'`;
                    item.detail = 'Odoo Models';
                    return item;
                });
            }
        },
        "'", '"'
    );

    const InverseNameProvider = vscode.languages.registerCompletionItemProvider(
        'python',
        {
            provideCompletionItems(document, position) {
                const lineText = document.lineAt(position.line).text;
                const textBefore = lineText.substring(0, position.character);

                let comodelName: string | null = null;
                let partial = '';

                // Case 1: Keyword argument - comodel_name="...", inverse_name="partial"
                let kwMatch = textBefore.match(/comodel_name\s*=\s*['"]([^'\"]+)['"][^\n]*inverse_name\s*=\s*['"]([^'\"]*)$/);
                if (kwMatch) {
                    comodelName = kwMatch[1];
                    partial = kwMatch[2] || '';
                } else {
                    // Case 2: Positional argument - fields.One2many('comodel', 'partial_inverse_name')
                    let posMatch = textBefore.match(/fields\.One2many\s*\(\s*['"]([^'\"]+)['"]\s*,\s*['"]([^'\"]*)$/);
                    if (posMatch) {
                        comodelName = posMatch[1];
                        partial = posMatch[2] || '';
                    }
                }

                if (!comodelName) return;

                const fullText = document.getText();
                // Find the current model name (_name or _inherit)
                let modelName: string | null = null;
                let nameMatch = fullText.match(/_name\s*=\s*['"]([^'"]+)['"]/);
                let inheritMatch = fullText.match(/_inherit\s*=\s*['"]([^'"]+)['"]/);
                if (nameMatch) {
                    modelName = nameMatch[1];
                } else if (inheritMatch) {
                    modelName = inheritMatch[1];
                }
                if (!modelName) return;

                const fieldsMap = fieldsOf(comodelName);
                if (!fieldsMap) return;

                // Only suggest Many2one fields whose related matches the current model
                return Object.entries(fieldsMap)
                    .filter(([fieldName, meta]) =>
                        meta.type === 'Many2one' &&
                        meta.related === modelName &&
                        fieldName.startsWith(partial)
                    )
                    .map(([fieldName, meta]) => {
                        const item = new vscode.CompletionItem(fieldName, vscode.CompletionItemKind.Field);
                        item.insertText = fieldName;
                        item.detail = `Type: ${meta.type}` + (meta.related ? ` → ${meta.related}` : '');
                        return item;
                    });
            }
        },
        "'", '"' // Trigger completion inside quotes
    );

    const RelatedFieldProvider = vscode.languages.registerCompletionItemProvider(
        'python',
        {
            provideCompletionItems(document, position) {
                // Only after a dot; checked first so other keystrokes cost nothing.
                if (!document.lineAt(position).text.substring(0, position.character).endsWith('.')) return;

                const fullText = document.getText();
                const lines = fullText.split('\n');
                const aliasMap: { [key: string]: string | null } = { self: null }; // Track alias to chain

                // Step 1: Find all alias assignments in for-loops
                const forLoopRegex = /for\s+([a-zA-Z_][\w]*)\s+in\s+([\w\.]+)/;
                for (const line of lines) {
                    const match = line.match(forLoopRegex);
                    if (match) {
                        const [_, alias, origin] = match;
                        aliasMap[alias] = origin;
                    }
                }

                // Step 2: Get the current line and match variable access
                const line = document.lineAt(position);
                const textBefore = line.text.substring(0, position.character);

                // Build alias regex from known variables
                const aliases = Object.keys(aliasMap).join('|');
                const match = textBefore.match(new RegExp(`\\b(${aliases})((?:\\.[a-zA-Z_][\\w]*)*)\\.$`));
                if (!match) return;

                let [_, alias, suffix] = match;
                let fullChain: string | null = alias;

                // Resolve chain recursively
                while (fullChain && aliasMap[fullChain]) {
                    fullChain = aliasMap[fullChain];
                }
                if (!fullChain) return;

                const fullFieldChain = (fullChain + suffix).split('.').filter(Boolean); // ['self', 'order_line', 'product_id']

                // Step 3: Find root model name
                const nameMatch = fullText.match(/_name\s*=\s*['"]([^'"]+)['"]/);
                const inheritMatch = fullText.match(/_inherit\s*=\s*['"]([^'"]+)['"]/);
                let modelName = nameMatch?.[1] || inheritMatch?.[1];
                if (!modelName) return;

                // Step 4: Traverse fields along the chain
                let fields = fieldsOf(modelName);
                for (let i = 1; i < fullFieldChain.length; i++) {
                    const field = fullFieldChain[i];
                    if (!fields?.[field]) return;
                    const related = fields[field].related;
                    if (!related) return;
                    modelName = related;
                    fields = fieldsOf(modelName);
                    if (!fields) return;
                }
                if (!fields) return;

                // Step 5: Suggest fields
                return Object.entries(fields).map(([fieldName, meta]) => {
                    const item = new vscode.CompletionItem(fieldName, vscode.CompletionItemKind.Field);
                    item.insertText = fieldName;
                    item.detail = `Type: ${meta.type}` + (meta.related ? ` → ${meta.related}` : '');
                    return item;
                });
            }
        },
        '.' // Trigger on dot
    );

    // Field name auto-suggestion for @api.onchange and @api.depends
    const ApiDecoratorFieldProvider = vscode.languages.registerCompletionItemProvider(
        'python',
        {
            provideCompletionItems(document, position) {
                const line = document.lineAt(position.line).text;
                // Check if inside @api.onchange or @api.depends decorator
                const decoratorLine = line.trim();
                if (!decoratorLine.startsWith('@api.onchange') && !decoratorLine.startsWith('@api.depends')) return;
                const fullText = document.getText();

                // Find the current model name (_name or _inherit)
                let modelName: string | null = null;
                let nameMatch = fullText.match(/_name\s*=\s*['"]([^'"]+)['"]/);
                let inheritMatch = fullText.match(/_inherit\s*=\s*['"]([^'"]+)['"]/);
                if (nameMatch) {
                    modelName = nameMatch[1];
                } else if (inheritMatch) {
                    modelName = inheritMatch[1];
                }
                if (!modelName) return;

                const fieldsMap = fieldsOf(modelName);
                if (!fieldsMap) return;

                // Suggest all field names
                return Object.entries(fieldsMap).map(([fieldName, meta]) => {
                    const item = new vscode.CompletionItem(fieldName, vscode.CompletionItemKind.Field);
                    item.insertText = fieldName;
                    item.detail = `Type: ${meta.type}` + (meta.related ? ` → ${meta.related}` : '');
                    return item;
                });
            }
        },
        "'", '"' // Trigger completion inside quotes
    );

    context.subscriptions.push(RelatedFieldProvider);
    context.subscriptions.push(ModelProvider);
    context.subscriptions.push(InverseNameProvider);
    //    context.subscriptions.push(One2manyInverseProvider);
    context.subscriptions.push(ApiDecoratorFieldProvider);
}
