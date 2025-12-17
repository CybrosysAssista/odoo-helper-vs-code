const vscode = require('vscode');
const fs = require('fs');
const path = require('path');

// Parse model names and fields
function getAllModelData(workspaceFolders) {
    const modelData = {}; // { 'model.name': Set(fields) }

    // More precise class detection - handles inheritance and multiple base classes
    const classRegex = /class\s+([\w_]+)\s*\(\s*([^)]*(?:models\.(?:Model|AbstractModel|TransientModel))[^)]*)\s*\):/g;
    
    // Enhanced model name regex - handles various formats and edge cases
    const modelNameRegex = /^\s*(_name|_inherit|_inherits)\s*=\s*(?:['"]([^'"]+)['"]|\[([^\]]+)\])/gm;
    
    // Improved field regex - handles multiline definitions, various field types, and edge cases
    const fieldRegex = /^\s*([a-zA-Z_][a-zA-Z0-9_]*)\s*=\s*fields\.([A-Z][a-zA-Z0-9_]*)\s*\(([^)]*)\)/gm;
    
    // More comprehensive field types for validation
    const validFieldTypes = new Set([
        'Boolean', 'Integer', 'Float', 'Monetary', 'Char', 'Text', 'Html',
        'Date', 'Datetime', 'Binary', 'Image', 'Selection', 'Reference',
        'Many2one', 'One2many', 'Many2many', 'Json'
    ]);

    // Directories to ignore during walk
    const IGNORED_DIRS = new Set(['venv', '.venv', 'env', '.env', '__pycache__', 'node_modules']);

    const walk = (dir) => {
        const files = fs.readdirSync(dir);
        for (const file of files) {
            const fullPath = path.join(dir, file);
            let stat;
            try {
                stat = fs.statSync(fullPath);
            } catch (err) {
                // Skip files/dirs that can't be stat'ed (e.g., broken symlinks)
                continue;
            }

            if (stat.isDirectory()) {
                // Skip known venv/caches and any directory containing pyvenv.cfg (Python venv)
                if (
                    IGNORED_DIRS.has(file) ||
                    fs.existsSync(path.join(fullPath, 'pyvenv.cfg'))
                ) continue;
                walk(fullPath);
            } else if (stat.isFile() && file.endsWith('.py')) {
                try {
                    const content = fs.readFileSync(fullPath, 'utf8');
                    
                    // Quick check if file contains model classes
                    if (!content.includes('models.Model') && 
                        !content.includes('models.AbstractModel') && 
                        !content.includes('models.TransientModel')) {
                        continue;
                    }

                    processFile(content, fullPath);
                } catch (err) {
                    console.warn(`Failed to read ${fullPath}:`, err.message);
                }
            }
        }
    };

    const processFile = (content, filePath) => {
        // Reset regex lastIndex to avoid issues with global regexes
        classRegex.lastIndex = 0;
        
        // Find all model classes in the file
        const modelClasses = [];
        let classMatch;
        while ((classMatch = classRegex.exec(content)) !== null) {
            modelClasses.push({
                name: classMatch[1],
                startIndex: classMatch.index,
                bases: classMatch[2]
            });
        }

        if (modelClasses.length === 0) return;

        // For each model class, extract its specific model names and fields
        for (let i = 0; i < modelClasses.length; i++) {
            const currentClass = modelClasses[i];
            const nextClass = modelClasses[i + 1];
            
            // Get the content of this specific class
            const classStartIndex = currentClass.startIndex;
            const classEndIndex = nextClass ? nextClass.startIndex : content.length;
            const classContent = content.substring(classStartIndex, classEndIndex);
            
            // Extract model names for this specific class
            const modelNames = extractModelNames(classContent);
            
            // Extract fields for this specific class
            const fields = extractFields(classContent);

            // Associate fields with model names
            for (const modelName of modelNames) {
                if (!modelData[modelName]) {
                    modelData[modelName] = {};
                }
                for (const [fieldName, fieldInfo] of Object.entries(fields)) {
                    modelData[modelName][fieldName] = fieldInfo;
                }
            }
        }
    };

    const extractModelNames = (classContent) => {
        const modelNames = [];
        modelNameRegex.lastIndex = 0;
        
        let nameMatch;
        while ((nameMatch = modelNameRegex.exec(classContent)) !== null) {
            const attribute = nameMatch[1];
            const singleValue = nameMatch[2];
            const listValue = nameMatch[3];
            
            if (singleValue) {
                modelNames.push(singleValue);
            } else if (listValue && (attribute === '_inherit' || attribute === '_inherits')) {
                // Handle list format: _inherit = ['model1', 'model2']
                const listItems = listValue.match(/['"]([^'"]+)['"]/g);
                if (listItems) {
                    for (const item of listItems) {
                        const cleanItem = item.replace(/['"]/g, '');
                        if (cleanItem) modelNames.push(cleanItem);
                    }
                }
            }
        }
        
        return [...new Set(modelNames)]; // Remove duplicates
    };

const extractFields = (classContent) => {
    const fields = {}; // { fieldName: { type: 'Char', related: 'res.partner' } }
    fieldRegex.lastIndex = 0;

    let fieldMatch;
    while ((fieldMatch = fieldRegex.exec(classContent)) !== null) {
        const fieldName = fieldMatch[1];
        const fieldType = fieldMatch[2];

        if (!validFieldTypes.has(fieldType) || isPrivateOrSpecialMethod(fieldName) || isCommonFalsePositive(fieldName)) {
            continue;
        }

        fields[fieldName] = { type: fieldType, related: null };

        // Find the full argument list inside parentheses after the fieldType
        // Start index is right after fieldType
        const startIndex = classContent.indexOf('(', fieldMatch.index);
        if (startIndex === -1) continue;

        // We want to extract the balanced parentheses content (handle multiline)
        let openParens = 1;
        let endIndex = startIndex + 1;
        while (endIndex < classContent.length && openParens > 0) {
            const char = classContent[endIndex];
            if (char === '(') openParens++;
            else if (char === ')') openParens--;
            endIndex++;
        }

        if (openParens !== 0) {
            // Unbalanced parentheses, skip this field
            continue;
        }

        const argsContent = classContent.slice(startIndex + 1, endIndex - 1);

        if (['Many2one', 'One2many', 'Many2many'].includes(fieldType)) {
            // Try to match comodel_name param or first argument string inside argsContent
            const comodelMatch = argsContent.match(
                /comodel_name\s*=\s*["']([^"']+)["']|^\s*["']([^"']+)["']/
            );

            if (comodelMatch) {
                fields[fieldName].related = comodelMatch[1] || comodelMatch[2];
            }
        }
    }

    return fields;
};

    const isPrivateOrSpecialMethod = (name) => {
        return name.startsWith('_') || 
               name === 'self' || 
               name === 'cls' ||
               name.includes('__');
    };

    const isCommonFalsePositive = (name) => {
        // Common variable names that aren't fields
        const falsePositives = new Set([
            'result', 'value', 'data', 'record', 'records', 'model',
            'field', 'fields', 'domain', 'context', 'args', 'kwargs'
        ]);
        return falsePositives.has(name);
    };

    // Process all workspace folders
    for (const folder of workspaceFolders) {
        walk(folder.uri.fsPath);
    }

    // Convert Sets to Arrays and sort for consistent output
    const result = {};
    for (const [modelName, fieldsSet] of Object.entries(modelData)) {
        result[modelName] = Object.fromEntries(
            Object.entries(fieldsSet).sort(([a], [b]) => a.localeCompare(b))
        );
    }

    return result;
}


function registerModelProviders(context) {
    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (!workspaceFolders) return;

    let modelDataCache = getAllModelData(workspaceFolders);
    let modelNamesCache = Object.keys(modelDataCache);

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

                return modelNamesCache.map(name => {
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
                const fullText = document.getText();

                let comodelName = null;
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

                // Find the current model name (_name or _inherit)
                let modelName = null;
                let nameMatch = fullText.match(/_name\s*=\s*['"]([^'"]+)['"]/);
                let inheritMatch = fullText.match(/_inherit\s*=\s*['"]([^'"]+)['"]/);
                if (nameMatch) {
                    modelName = nameMatch[1];
                } else if (inheritMatch) {
                    modelName = inheritMatch[1];
                }
                if (!modelName) return;

                const fieldsMap = modelDataCache[comodelName];
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

    // XML: model name inside <field name="model">
    const XmlModelProvider = vscode.languages.registerCompletionItemProvider(
        'xml',
        {
            provideCompletionItems(document, position) {
                const line = document.lineAt(position);
                const textBefore = line.text.substring(0, position.character);
                const insideModelFieldRegex = /<field\s+[^>]*name\s*=\s*["']model["']\s*>([^<]*)$/;

                if (!insideModelFieldRegex.test(textBefore)) return;

                return modelNamesCache.map(name => {
                    const item = new vscode.CompletionItem(name, vscode.CompletionItemKind.Value);
                    item.insertText = name;
                    item.detail = 'Odoo Model';
                    return item;
                });
            }
        },
        '>'
    );

    // XML: field name suggestion for <field name="...">
    const XmlFieldProvider = vscode.languages.registerCompletionItemProvider(
        'xml',
        {
            provideCompletionItems(document, position) {
                const text = document.getText();
                document.getText(new vscode.Range(new vscode.Position(0, 0), position));
                const modelMatch = text.match(/<field\s+name=["']model["']\s*>([\w.]+)<\/field>/);
                if (!modelMatch) return;

                const modelName = modelMatch[1];
                const fieldsMap = modelDataCache[modelName];
                if (!fieldsMap) return;

                return Object.entries(fieldsMap).map(([fieldName, meta]) => {
                    const item = new vscode.CompletionItem(fieldName, vscode.CompletionItemKind.Field);
                    item.insertText = fieldName;
                    item.detail = `Type: ${meta.type}` + (meta.related ? ` → ${meta.related}` : '');
                    return item;
                });
            }
        },
        '"'
    );
    const RelatedFieldProvider = vscode.languages.registerCompletionItemProvider(
        'python',
        {
            provideCompletionItems(document, position) {
                const fullText = document.getText();
                const lines = fullText.split('\n');
                const aliasMap = { self: null }; // Track alias to chain

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
                let fullChain = alias;

                // Resolve chain recursively
                while (aliasMap[fullChain]) {
                    fullChain = aliasMap[fullChain];
                }

                const fullFieldChain = (fullChain + suffix).split('.').filter(Boolean); // ['self', 'order_line', 'product_id']

                // Step 3: Find root model name
                const nameMatch = fullText.match(/_name\s*=\s*['"]([^'"]+)['"]/);
                const inheritMatch = fullText.match(/_inherit\s*=\s*['"]([^'"]+)['"]/);
                let modelName = nameMatch?.[1] || inheritMatch?.[1];
                if (!modelName) return;

                // Step 4: Traverse fields along the chain
                let fields = modelDataCache[modelName];
                for (let i = 1; i < fullFieldChain.length; i++) {
                    const field = fullFieldChain[i];
                    if (!fields?.[field]) return;
                    const related = fields[field].related;
                    if (!related || !modelDataCache[related]) return;
                    modelName = related;
                    fields = modelDataCache[modelName];
                }

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
    
//    // Simple and robust One2many inverse_name auto-suggestion
//    const One2manyInverseProvider = vscode.languages.registerCompletionItemProvider(
//        'python',
//        {
//            provideCompletionItems(document, position) {
//                // Get up to 5 lines above and below the current line for context
//                const startLine = Math.max(0, position.line - 4);
//                const endLine = Math.min(document.lineCount - 1, position.line + 4);
//                let contextText = '';
//                for (let i = startLine; i <= endLine; i++) {
//                    contextText += document.lineAt(i).text + '\n';
//                }
//
//                // Try to match positional: fields.One2many('comodel', 'inverse_name'
//                let posMatch = contextText.match(/fields\.One2many\s*\(\s*['"]([^'"]+)['"]\s*,\s*['"]([^'"]*)$/);
//                let comodelName, partial;
//                if (posMatch) {
//                    comodelName = posMatch[1];
//                    partial = posMatch[2] || '';
//                } else {
//                    // Try to match keyword: comodel_name='...', inverse_name='...'
//                    let kwMatch = contextText.match(/comodel_name\s*=\s*['"]([^'"]+)['"][^)]*inverse_name\s*=\s*['"]([^'"]*)$/);
//                    if (kwMatch) {
//                        comodelName = kwMatch[1];
//                        partial = kwMatch[2] || '';
//                    }
//                }
//                if (!comodelName) return;
//
//                // Find the current model name (_name or _inherit)
//                const fullText = document.getText();
//                let modelName = null;
//                let nameMatch = fullText.match(/_name\s*=\s*['"]([^'"]+)['"];/);
//                let inheritMatch = fullText.match(/_inherit\s*=\s*['"]([^'"]+)['"];/);
//                if (nameMatch) {
//                    modelName = nameMatch[1];
//                } else if (inheritMatch) {
//                    modelName = inheritMatch[1];
//                }
//                if (!modelName) return;
//
//                // Use the modelDataCache from the closure
//                const fieldsMap = modelDataCache[comodelName];
//                if (!fieldsMap) return;
//
//                // Only suggest Many2one fields whose related matches the current model
//                return Object.entries(fieldsMap)
//                    .filter(([fieldName, meta]) =>
//                        meta.type === 'Many2one' &&
//                        meta.related === modelName &&
//                        fieldName.startsWith(partial)
//                    )
//                    .map(([fieldName, meta]) => {
//                        const item = new vscode.CompletionItem(fieldName, vscode.CompletionItemKind.Field);
//                        item.insertText = fieldName;
//                        item.detail = `Type: ${meta.type}` + (meta.related ? ` → ${meta.related}` : '');
//                        return item;
//                    });
//            }
//        },
//        "'", '"' // Trigger completion inside quotes
//    );
//
    // Field name auto-suggestion for @api.onchange and @api.depends
    const ApiDecoratorFieldProvider = vscode.languages.registerCompletionItemProvider(
        'python',
        {
            provideCompletionItems(document, position) {
                const line = document.lineAt(position.line).text;
                const textBefore = line.substring(0, position.character);
                const fullText = document.getText();

                // Check if inside @api.onchange or @api.depends decorator
                const decoratorLine = line.trim();
                if (!decoratorLine.startsWith('@api.onchange') && !decoratorLine.startsWith('@api.depends')) return;

                // Find the current model name (_name or _inherit)
                let modelName = null;
                let nameMatch = fullText.match(/_name\s*=\s*['"]([^'"]+)['"]/);
                let inheritMatch = fullText.match(/_inherit\s*=\s*['"]([^'"]+)['"]/);
                if (nameMatch) {
                    modelName = nameMatch[1];
                } else if (inheritMatch) {
                    modelName = inheritMatch[1];
                }
                if (!modelName) return;

                // Use the modelDataCache from the closure
                const fieldsMap = modelDataCache[modelName];
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
    context.subscriptions.push(XmlModelProvider);
    context.subscriptions.push(XmlFieldProvider);
    context.subscriptions.push(InverseNameProvider);
//    context.subscriptions.push(One2manyInverseProvider);
    context.subscriptions.push(ApiDecoratorFieldProvider);

    // Watch for changes
    const watcher = vscode.workspace.createFileSystemWatcher('**/*.py');
    const updateModelCache = () => {
        modelDataCache = getAllModelData(workspaceFolders);
        modelNamesCache = Object.keys(modelDataCache);
    };
    watcher.onDidChange(updateModelCache);
    watcher.onDidCreate(updateModelCache);
    watcher.onDidDelete(updateModelCache);
    context.subscriptions.push(watcher);

    return {
        getAllModelData
    };
}

module.exports = {
    registerModelProviders,
    getAllModelData
};