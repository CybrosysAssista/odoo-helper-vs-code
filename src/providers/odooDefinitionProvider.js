const vscode = require('vscode');
const fs = require('fs');

function escapeRegExp(str) {
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

class OdooDefinitionProvider {
    async provideDefinition(document, position, token) {
        const wordRange = document.getWordRangeAtPosition(position, /[\w.\-_]+/);
        if (!wordRange) return null;
        const word = document.getText(wordRange);
        const line = document.lineAt(position.line).text;
        const documentText = document.getText();
        const languageId = document.languageId;

        if (languageId === 'xml') {
            // 1. Button action navigation: <button name="...">
            if (/<button[^>]*name\s*=\s*["']([^"']+)["']/.test(line) && word) {
                // Find the model context for this view (look for <field name="model">...)
                const modelName = this.getXmlModelContext(documentText, position.line);
                if (modelName) {
                    // Search all Python files for def <word> in the correct model
                    const files = await vscode.workspace.findFiles('**/*.py');
                    for (const file of files) {
                        const content = fs.readFileSync(file.fsPath, 'utf8');
                        if (!content.includes(`_name = '${modelName}'`) && !content.includes(`_inherit = '${modelName}'`)) continue;
                        const regex = new RegExp('def\\s+' + escapeRegExp(word) + '\\s*\\(');
                        const match = regex.exec(content);
                        if (match) {
                            const idx = content.indexOf(match[0]);
                            const lines = content.slice(0, idx).split('\n');
                            return new vscode.Location(file, new vscode.Position(lines.length - 1, 0));
                        }
                    }
                }
            }
            // 2. Menuitem parent navigation: <menuitem parent="..."> (multi-line support)
            if (/parent\s*=\s*["']([^"']+)["']/.test(line) && word) {
                // Find the full <menuitem ...> element (may be multi-line)
                const lines = document.getText().split('\n');
                let tagStart = position.line;
                while (tagStart > 0 && !lines[tagStart].includes('<menuitem')) tagStart--;
                let tagEnd = position.line;
                while (tagEnd < lines.length && !lines[tagEnd].includes('/>') && !lines[tagEnd].includes('</menuitem>')) tagEnd++;
                const menuitemBlock = lines.slice(tagStart, tagEnd + 1).join(' ');
                // Extract parent attribute value
                const parentMatch = menuitemBlock.match(/parent\s*=\s*["']([^"']+)["']/);
                if (parentMatch && parentMatch[1] === word) {
                    // Search all XML files for <menuitem id="..."> (multi-line aware)
                    const files = await vscode.workspace.findFiles('**/*.xml');
                    for (const file of files) {
                        const content = fs.readFileSync(file.fsPath, 'utf8');
                        // Match <menuitem ... id="..." ...> across multiple lines
                        const regex = new RegExp('<menuitem[^>]*id\s*=\s*["\']' + escapeRegExp(word) + '["\'][^>]*>', 'gms');
                        const match = regex.exec(content);
                        if (match) {
                            const idx = content.indexOf(match[0]);
                            const linesArr = content.slice(0, idx).split('\n');
                            return new vscode.Location(file, new vscode.Position(linesArr.length - 1, 0));
                        }
                    }
                }
            }
            // QWeb t-call and t-name navigation
            if (/t-call\s*=\s*["']([^"']+)["']/.test(line) || /t-name\s*=\s*["']([^"']+)["']/.test(line)) {
                // Only trigger if cursor is on the value
                if (word) {
                    return await this.findQWebTemplate(word);
                }
            }
            // model="..." or res_model="..."
            if ((/model\s*=\s*["']([^"']+)["']/.test(line) || /res_model\s*=\s*["']([^"']+)["']/.test(line)) && word) {
                return await this.findModelDefinition(word);
            }
            // ref, inherit_id, parent, action
            if ((/ref\s*=\s*["']([^"']+)["']/.test(line) || /inherit_id\s*=\s*["']([^"']+)["']/.test(line) || /parent\s*=\s*["']([^"']+)["']/.test(line) || /action\s*=\s*["']([^"']+)["']/.test(line)) && word) {
                return await this.findXmlRecord(word);
            }
            // Field navigation in view: <field name="...">
            if (/<field[^>]*name\s*=\s*["']([^"']+)["']/.test(line) && word) {
                const modelName = this.getXmlModelContext(documentText, position.line);
                if (modelName) {
                    return await this.findFieldDefinition(null, word, modelName);
                }
            }
        }
        if (languageId === 'python') {
            // self.field_name
            if (/self\.(\w+)/.test(line) && line.includes(word)) {
                const modelName = this.getPythonModelContext(documentText, position.line);
                if (modelName) {
                    return await this.findFieldDefinition(document, word, modelName);
                }
            }
            // self.method_name()
            if (/self\.(\w+)\s*\(/.test(line) && line.includes(word)) {
                const modelName = this.getPythonModelContext(documentText, position.line);
                if (modelName) {
                    return await this.findPythonMethodInModel(modelName, word);
                }
            }
            // env['model.name']
            if (/env\[['"]([^'"]+)['"]\]/.test(line) && line.includes(word)) {
                return await this.findModelDefinition(word);
            }
            // related='model.field'
            if (/related\s*=\s*['"]([^'"]+)['"]/.test(line)) {
                const rel = line.match(/related\s*=\s*['"]([^'"]+)['"]/)[1];
                const [modelName, fieldName] = rel.split('.');
                if (fieldName === word) {
                    return await this.findFieldDefinition(null, fieldName, modelName);
                }
            }
        }
        return null;
    }

    // --- Context helpers ---
    getXmlModelContext(documentText, lineNumber) {
        // Look upwards for <field name="model"> or <field name="res_model">
        const lines = documentText.split('\n').slice(0, lineNumber + 1).reverse();
        for (const line of lines) {
            let m = line.match(/<field[^>]*name=["']model["']>([\w.]+)/);
            if (m) return m[1];
            m = line.match(/<field[^>]*name=["']res_model["']>([\w.]+)/);
            if (m) return m[1];
        }
        return null;
    }
    getPythonModelContext(documentText, lineNumber) {
        // Look upwards for _name = 'model.name' or _inherit = 'model.name'
        const lines = documentText.split('\n').slice(0, lineNumber + 1).reverse();
        for (const line of lines) {
            let m = line.match(/_name\s*=\s*['"]([\w.]+)['"]/);
            if (m) return m[1];
            m = line.match(/_inherit\s*=\s*['"]([\w.]+)['"]/);
            if (m) return m[1];
        }
        return null;
    }

    // --- Navigation helpers ---
    async findPythonMethodInModel(modelName, methodName) {
        const files = await vscode.workspace.findFiles('**/*.py');
        for (const file of files) {
            const content = fs.readFileSync(file.fsPath, 'utf8');
            if (!content.includes(`_name = '${modelName}'`) && !content.includes(`_inherit = '${modelName}'`)) continue;
            const regex = new RegExp('def\\s+' + escapeRegExp(methodName) + '\\s*\\(', 'm');
            const match = regex.exec(content);
            if (match) {
                const idx = content.indexOf(match[0]);
                const lines = content.slice(0, idx).split('\n');
                // Place cursor at start of matched line
                return new vscode.Location(file, new vscode.Position(lines.length - 1, 0));
            }
        }
        return null;
    }
    async findFieldDefinition(document, fieldName, modelName = null) {
        if (!modelName && document) {
            modelName = this.getPythonModelContext(document.getText(), document.lineCount - 1);
        }
        if (!modelName) return null;
        const files = await vscode.workspace.findFiles('**/*.py');
        for (const file of files) {
            const content = fs.readFileSync(file.fsPath, 'utf8');
            if (!content.includes(`_name = '${modelName}'`) && !content.includes(`_inherit = '${modelName}'`)) continue;
            // Use a simple, robust regex for field assignment
            const regex = new RegExp('^\\s*' + escapeRegExp(fieldName) + '\\s*=\\s*fields\\.[A-Z][a-zA-Z0-9_]*\\s*\\(', 'm');
            const match = regex.exec(content);
            if (match) {
                const idx = content.indexOf(match[0]);
                const lines = content.slice(0, idx).split('\n');
                // Place cursor at start of matched line
                return new vscode.Location(file, new vscode.Position(lines.length - 1, 0));
            }
        }
        return null;
    }
    async findModelDefinition(modelName) {
        const files = await vscode.workspace.findFiles('**/*.py');
        for (const file of files) {
            const content = fs.readFileSync(file.fsPath, 'utf8');
            const regex = new RegExp('_name\\s*=\\s*[\'\"]' + escapeRegExp(modelName) + '[\'\"]');
            const match = regex.exec(content);
            if (match) {
                const idx = content.indexOf(match[0]);
                const lines = content.slice(0, idx).split('\n');
                // Place cursor at start of matched line
                return new vscode.Location(file, new vscode.Position(lines.length - 1, 0));
            }
        }
        return null;
    }
    async findXmlRecord(recordId) {
        const files = await vscode.workspace.findFiles('**/*.xml');
        for (const file of files) {
            const content = fs.readFileSync(file.fsPath, 'utf8');
            const regex = new RegExp('<record[^>]+id\\s*=\\s*[\'\"]' + escapeRegExp(recordId) + '[\'\"]', 'g');
            const match = regex.exec(content);
            if (match) {
                const idx = content.indexOf(match[0]);
                const lines = content.slice(0, idx).split('\n');
                // Place cursor at start of matched line
                return new vscode.Location(file, new vscode.Position(lines.length - 1, 0));
            }
        }
        return null;
    }
    async findQWebTemplate(templateName) {
        const files = await vscode.workspace.findFiles('**/*.xml');
        for (const file of files) {
            const content = fs.readFileSync(file.fsPath, 'utf8');
            // Match <t t-name="...">
            const regex = new RegExp('<t\\s+t-name\\s*=\\s*[\'\"]' + escapeRegExp(templateName) + '[\'\"]', 'g');
            const match = regex.exec(content);
            if (match) {
                const idx = content.indexOf(match[0]);
                const lines = content.slice(0, idx).split('\n');
                // Place cursor at start of matched line
                return new vscode.Location(file, new vscode.Position(lines.length - 1, 0));
            }
        }
        return null;
    }
}

module.exports = OdooDefinitionProvider; 