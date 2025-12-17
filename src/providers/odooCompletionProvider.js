const vscode = require('vscode');
const { getFieldTypes } = require('./data/fieldTypes');
const { getDecorators } = require('./data/decorators');
const { getFieldAttributes } = require('./data/fieldAttributes');
const { getFieldSnippets } = require('./data/fieldSnippets');
const { getUtilitySnippets } = require('./data/utilitySnippets');
const { getMethodSuggestions } = require('./data/methodSnippets');
const { getModelSnippets } = require('./data/modelSnippets');

function registerFieldProviders(context) {
    const fieldTypeProvider = vscode.languages.registerCompletionItemProvider(
        'python',
        {
            async provideCompletionItems(document, position) {
            const line = document.lineAt(position).text;
            const textBefore = line.substring(0, position.character);

            // Match fields.SomeText, extract "SomeText"
            const match = textBefore.match(/fields\.([a-zA-Z]*)$/);
            if (!match) return undefined;

            const typed = match[1];

            const types = await getFieldTypes();
            return types
                .filter(type => type.toLowerCase().startsWith(typed.toLowerCase()))
                .map(type => {
                const item = new vscode.CompletionItem(type, vscode.CompletionItemKind.Property);
                item.insertText = new vscode.SnippetString(`${type}(string="$1")`);
                item.detail = 'Odoo Field Type';
                item.documentation = `odoo.fields.${type}`;
                return item;
                });
            }
        },
        "."
    );
    context.subscriptions.push(fieldTypeProvider);

    const methodDecoratorProvider = vscode.languages.registerCompletionItemProvider(
        'python',
        {
            async provideCompletionItems(document, position) {
                const line = document.lineAt(position);
                const textBefore = line.text.substring(0, position.character);
                if (!textBefore.trim().endsWith("@")) return undefined;
                const decorators = await getDecorators();
                return decorators.map(type => {
                    const item = new vscode.CompletionItem(type, vscode.CompletionItemKind.Keyword);
                    item.insertText = type;
                    item.detail = 'Odoo Method Decorators';
                    item.documentation = `Decorator for Odoo method: ${type}`;
                    return item;
                });
            }
        },
        "@"
    );
    context.subscriptions.push(methodDecoratorProvider);

    const fieldAttributesProvider = vscode.languages.registerCompletionItemProvider(
        'python',
        {
            async provideCompletionItems(document, position) {
                const line = document.lineAt(position);
                const textBefore = line.text.substring(0, position.character);
                if (!textBefore.includes('fields.')) return undefined;
                
                const attrs = await getFieldAttributes();
                return attrs.map(attr => {
                    const item = new vscode.CompletionItem(attr, vscode.CompletionItemKind.Property);
                    item.insertText = `${attr}=`;
                    item.detail = 'Odoo Field Attribute';
                    item.documentation = `Field attribute: ${attr}`;
                    return item;
                });
            }
        },
        "="
    );
    context.subscriptions.push(fieldAttributesProvider);
// const MethodProvider = vscode.languages.registerCompletionItemProvider(
//     'python',
//     {
//         async provideCompletionItems(document, position) {
//             const fileContent = document.getText();

//             // Match both _inherit and _name to ensure coverage
//             const modelRegex = /_(inherit|name)\s*=\s*['"]([\w.]+)['"]/g;
//             const matchedModels = new Set();
//             let match;
//             while ((match = modelRegex.exec(fileContent)) !== null) {
//                 matchedModels.add(match[2]); // e.g., 'res.partner'
//             }

//             const allMethods = new Map(); // methodName -> fullSignature
//             for (const model of matchedModels) {
//                 const pythonFileName = `${model.replace(/\./g, '_')}.py`;
//                 const modelFiles = await vscode.workspace.findFiles(`**/${pythonFileName}`);

//                 for (const file of modelFiles) {
//                     try {
//                         const content = (await vscode.workspace.fs.readFile(file)).toString();

//                         // Match def method_name(self, arg1, arg2): or @api.depends(...) def method...
//                         const methodRegex = /def\s+([a-zA-Z_][\w]*)\s*\(([^)]*)\)/g;
//                         let methodMatch;
//                         while ((methodMatch = methodRegex.exec(content)) !== null) {
//                             const methodName = methodMatch[1];
//                             const params = methodMatch[2];

//                             if (!methodName.startsWith('__')) {
//                                 const fullSig = `def ${methodName}(${params})`;
//                                 allMethods.set(methodName, fullSig);
//                             }
//                         }
//                     } catch (err) {
//                         console.warn(`Failed to read model file ${file.fsPath}:`, err);
//                     }
//                 }
//             }

//             return [...allMethods.entries()].map(([methodName, fullSig]) => {
//                 const item = new vscode.CompletionItem(methodName, vscode.CompletionItemKind.Method);
//                 item.insertText = new vscode.SnippetString(`${fullSig}:\n    $0`);
//                 item.detail = `Method: ${methodName}`;
//                 item.documentation = `Auto-suggested from inherited/base model(s)`;
//                 return item;
//             });
//         }
//     },
//     "f" // trigger when typing 'f'
// );

// context.subscriptions.push(MethodProvider);

const odooKeywordProvider = vscode.languages.registerCompletionItemProvider(
    'python',
    {
        async provideCompletionItems(document, position) {
            const line = document.lineAt(position);
            line.text.substring(0, position.character);

            const suggestions = [];

            // Add model snippets
            (await getModelSnippets()).forEach(snippet => {
                const item = new vscode.CompletionItem(snippet.label, vscode.CompletionItemKind.Class);
                item.sortText = snippet.sortText;
                item.insertText = new vscode.SnippetString(snippet.insertText);
                item.detail = snippet.detail;
                item.documentation = new vscode.MarkdownString(snippet.documentation);
                suggestions.push(item);
            });

            // Add all decorators with enhanced documentation
            (await getDecorators()).forEach(decorator => {
                const item = new vscode.CompletionItem(`@${decorator}`, vscode.CompletionItemKind.Snippet);
                item.sortText = `odoo_decorator_${String(decorator).toLowerCase()}`;
                
                item.insertText = new vscode.SnippetString(
                    `@${decorator}\n` +
                    `def \${1:method_name}(self):\n` +
                    `    \${0:pass}`
                );

                item.detail = 'Odoo Method Decorator';
                item.documentation = new vscode.MarkdownString(
                    `### \`@${decorator}\`\n\n` +
                    `Odoo method decorator for specific behaviors.\n\n` +
                    `**Usage:**\n` +
                    '```python\n' +
                    `@${decorator}\n` +
                    `def your_method(self):\n` +
                    `    pass\n` +
                    '```\n\n' +
                    (decorator === 'api.model' ? '**Used for methods that don\'t need access to a recordset (no `self` loop).**' :
                    decorator === 'api.depends' ? '**Used to specify fields this method depends on.**' :
                    decorator === 'api.onchange' ? '**Used for methods triggered by field changes in forms.**' :
                    decorator === 'api.constrains' ? '**Used for validation constraints on field values.**' :
                    '**Standard Odoo API decorator.**')
                );
                suggestions.push(item);
            });

            // Add all field snippets with enhanced documentation
            (await getFieldSnippets()).forEach(snippet => {
                const item = new vscode.CompletionItem(snippet.label, vscode.CompletionItemKind.Field);
                item.sortText = `odoo field ${String(snippet.label).toLowerCase()}`;
                item.insertText = snippet.insertText;
                item.detail = snippet.detail;
                item.documentation = new vscode.MarkdownString(
                    `### ${snippet.label}\n\n` +
                    `${snippet.documentation}`
                );
                suggestions.push(item);
            });

            (await getUtilitySnippets()).forEach(snippet => {
                const item = new vscode.CompletionItem(snippet.label, vscode.CompletionItemKind.Field);
                item.sortText = `odoo ${String(snippet.label).toLowerCase()}`;
                item.insertText = snippet.insertText;
                item.detail = snippet.detail;
                item.documentation = new vscode.MarkdownString(
                    `### ${snippet.label}\n\n` +
                    `${snippet.documentation}`
                );
                suggestions.push(item);
            });

            // Add method suggestions
            (await getMethodSuggestions()).forEach(method => {
                const item = new vscode.CompletionItem(method.label, vscode.CompletionItemKind.Method);
                item.sortText = `odoo method ${String(method.label).toLowerCase()}`;
                item.insertText = new vscode.SnippetString(method.insertText);
                item.detail = method.detail;

                const markdown = new vscode.MarkdownString(
                    `### ${method.label}\n\n` +
                    '```python\n' +
                    `${method.documentation}\n` +
                    '```'
                );
                markdown.supportHtml = true;
                markdown.isTrusted = true;

                item.documentation = markdown;
                suggestions.push(item);
            });

            return suggestions;
        }
    },
    'o'
);
context.subscriptions.push(odooKeywordProvider);
}

module.exports = {  
    registerFieldProviders
}; 