import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import moduleIndexService from '../services/moduleIndexService';
import modelIndexService from '../services/modelIndexService';
import { getPythonParserService } from '../services/pythonParserService';
import { ManifestParser, ParsedManifest } from '../services/manifestParser';

import { OdooModuleUtils } from '../utils/odooModuleUtils';
import { CssClassIndexer } from '../services/cssClassIndexer';
import { getOdooRegistryIndexer } from '../services/odooRegistryIndexer';

function escapeRegExp(str: string): string {
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export class OdooDefinitionProvider implements vscode.DefinitionProvider {
    async provideDefinition(document: vscode.TextDocument, position: vscode.Position, token: vscode.CancellationToken): Promise<vscode.Location | vscode.Location[] | null | undefined> {
        const wordRange = document.getWordRangeAtPosition(position, /[\w.\-_]+/);
        if (!wordRange) return null;
        const word = document.getText(wordRange);
        const line = document.lineAt(position.line).text;
        const documentText = document.getText();
        const languageId = document.languageId;

        if (languageId === 'xml') {

            // CSS Class Navigation
            // Check if cursor is inside class="..." or class='...'
            const linePrefix = document.getText(new vscode.Range(new vscode.Position(position.line, 0), position));
            const lineSuffix = document.getText(new vscode.Range(position, new vscode.Position(position.line, line.length)));

            // Reconstruct the full attribute context around the cursor
            // This is a simple regex approach; for robustness, looking at the whole line is often enough for simple attributes
            const fullLine = document.lineAt(position.line).text;
            const classAttrRegex = /class\s*=\s*["']([^"']+)["']/;
            const classMatch = fullLine.match(classAttrRegex);

            if (classMatch) {
                // Determine if the click was actually *inside* the class string
                const attrStart = fullLine.indexOf(classMatch[0]);
                const valueStart = fullLine.indexOf(classMatch[1], attrStart);
                const valueEnd = valueStart + classMatch[1].length;

                if (position.character >= valueStart && position.character <= valueEnd) {
                    const moduleRoot = await OdooModuleUtils.getModuleRoot(document.uri);
                    if (moduleRoot) {
                        const config = vscode.workspace.getConfiguration('cybrosys-assista-odoo-helper');
                        const enableAdvanced = config.get<boolean>('indexing.enableAdvanceCSSIndexing', false);

                        if (enableAdvanced) {
                            const currentModuleName = path.basename(moduleRoot.fsPath);
                            const indexer = CssClassIndexer.getInstance();
                            const definitions = indexer.getClassDefinitions(word);

                            const targetModules = [currentModuleName, 'web', 'mail'];
                            const bestDef = definitions.find(d => targetModules.includes(d.moduleName));

                            if (bestDef) {
                                return new vscode.Location(
                                    vscode.Uri.file(bestDef.filePath),
                                    new vscode.Position(bestDef.lineNumber - 1, 0)
                                );
                            }
                        }
                    }
                }
            }

            // Widget Navigation
            const widgetAttrRegex = /widget\s*=\s*["']([^"']+)["']/;
            const widgetMatch = fullLine.match(widgetAttrRegex);

            if (widgetMatch) {
                const attrStart = fullLine.indexOf(widgetMatch[0]);
                const valueStart = fullLine.indexOf(widgetMatch[1], attrStart);
                const valueEnd = valueStart + widgetMatch[1].length;

                if (position.character >= valueStart && position.character <= valueEnd && widgetMatch[1] === word) {
                    const registryIndexer = getOdooRegistryIndexer();
                    const entry = registryIndexer.getEntryById(word);
                    if (entry) {
                        return new vscode.Location(
                            vscode.Uri.file(entry.filePath),
                            new vscode.Position(entry.line, 0)
                        );
                    }
                }
            }

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
            // Check if it's a valid Odoo module
            const modules = await moduleIndexService.getModules();
            const module = modules.find(m => document.uri.fsPath.startsWith(m.path));
            if (!module) return null;

            // Handle _inherit navigation using Tree-sitter
            const pythonParser = getPythonParserService();
            if (pythonParser.isInitialized()) {
                const tree = pythonParser.parse(document.getText());
                if (tree) {
                    const offset = document.offsetAt(position);
                    const node = tree.rootNode.descendantForIndex(Math.max(0, offset - 1));

                    if (node && this.isModelInheritContext(node)) {
                        const modelName = node.text.replace(/['"]/g, '');
                        if (modelName) {
                            return await this.handleModelDefinitionMultiLookup(modelName);
                        }
                    }
                }
            }

            // Manifest 'depends' key navigation (using Tree-sitter)
            if (document.fileName.endsWith('__manifest__.py') || document.fileName.endsWith('__openerp__.py')) {
                const pythonParser = getPythonParserService();
                if (pythonParser.isInitialized()) {
                    const manifestParser = pythonParser.getManifestParser();
                    if (manifestParser) {
                        const parsed: ParsedManifest | null = manifestParser.parseManifest(document.getText());
                        if (parsed && parsed.data.has('depends')) {
                            const depends = parsed.data.get('depends');
                            if (depends && depends.type === 'list' && depends.items) {
                                for (const item of depends.items) {
                                    if (typeof item.value === 'string') {
                                        const range = new vscode.Range(
                                            item.range.start.line,
                                            item.range.start.character,
                                            item.range.end.line,
                                            item.range.end.character
                                        );
                                        // Check if cursor is contained in the string range
                                        if (range.contains(position)) {
                                            const moduleName = item.value;

                                            // Ensure index is ready
                                            await moduleIndexService.getModules();
                                            const modulePath = moduleIndexService.getModulePath(moduleName);

                                            if (modulePath) {
                                                const possibleManifests = ['__manifest__.py', '__openerp__.py'];
                                                for (const man of possibleManifests) {
                                                    const manPath = path.join(modulePath, man);
                                                    if (fs.existsSync(manPath)) {
                                                        return new vscode.Location(vscode.Uri.file(manPath), new vscode.Position(0, 0));
                                                    }
                                                }
                                            }
                                        }
                                    }
                                }
                            }
                        }

                        // Manifest file path navigation (data, demo, assets)
                        const manifestKeys = ['data', 'demo', 'assets'];
                        for (const keyName of manifestKeys) {
                            if (parsed && parsed.data.has(keyName)) {
                                const keyData = parsed.data.get(keyName);

                                // Handle both simple lists and nested structures (for assets)
                                const processListItems = async (items: any[]) => {
                                    for (const item of items) {
                                        if (typeof item.value === 'string') {
                                            const range = new vscode.Range(
                                                item.range.start.line,
                                                item.range.start.character,
                                                item.range.end.line,
                                                item.range.end.character
                                            );
                                            // Check if cursor is contained in the string range
                                            if (range.contains(position)) {
                                                const dataPath = item.value;
                                                const pathItems = dataPath.split('/');

                                                // Calculate which path segment the cursor is on
                                                const stringStartChar = item.range.start.character + 1; // +1 to skip opening quote
                                                const cursorOffsetInString = position.character - stringStartChar;

                                                // Find which path segment the cursor is in
                                                let currentOffset = 0;
                                                let clickedSegmentIndex = -1;
                                                let clickedSegment = '';

                                                for (let i = 0; i < pathItems.length; i++) {
                                                    const segmentLength = pathItems[i].length;
                                                    const segmentEnd = currentOffset + segmentLength;

                                                    if (cursorOffsetInString >= currentOffset && cursorOffsetInString < segmentEnd) {
                                                        clickedSegmentIndex = i;
                                                        clickedSegment = pathItems[i];
                                                        break;
                                                    }

                                                    // +1 for the '/' separator
                                                    currentOffset = segmentEnd + 1;
                                                }

                                                // Construct the path up to and including the clicked segment
                                                const pathToSegment = clickedSegmentIndex >= 0
                                                    ? pathItems.slice(0, clickedSegmentIndex + 1).join('/')
                                                    : '';

                                                const moduleRootPath = path.dirname(document.fileName);
                                                let fullPath = path.join(moduleRootPath, pathToSegment);

                                                if (!fs.existsSync(fullPath)) {
                                                    const workspaceRoot = path.dirname(moduleRootPath);
                                                    fullPath = path.join(workspaceRoot, pathToSegment);
                                                    console.log(`[OdooDefinitionProvider] Resolved path: ${fullPath}`);
                                                }
                                                // Check if the path exists
                                                if (fs.existsSync(fullPath)) {
                                                    const stats = fs.statSync(fullPath);
                                                    const uri = vscode.Uri.file(fullPath);

                                                    if (stats.isDirectory()) {
                                                        // Focus on the folder in the file explorer
                                                        await vscode.commands.executeCommand('revealInExplorer', uri);
                                                        return null; // Don't return a location for folders
                                                    } else if (stats.isFile()) {
                                                        // Open the file and return its location
                                                        return new vscode.Location(uri, new vscode.Position(0, 0));
                                                    }
                                                }
                                            }
                                        }
                                    }
                                };

                                if (keyData && keyData.type === 'list' && keyData.items) {
                                    const result = await processListItems(keyData.items);
                                    if (result) return result;
                                } else if (keyData && keyData.type === 'dict') {
                                    // For assets, which is a dict with nested lists
                                    // The children property contains the dictionary entries as a Map
                                    const dictData = (keyData as any).children;

                                    if (dictData && (dictData instanceof Map)) {
                                        // Iterate over the Map entries
                                        for (const [assetKey, assetValue] of dictData.entries()) {
                                            // Each asset value should be a list with items
                                            if (assetValue && typeof assetValue === 'object' && 'type' in assetValue && assetValue.type === 'list' && 'items' in assetValue) {
                                                const result = await processListItems((assetValue as any).items);
                                                if (result) return result;
                                            }
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }

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
            const rel = line.match(/related\s*=\s*['"]([^'"]+)['"]/);
            if (rel) {
                const [modelName, fieldName] = rel[1].split('.');
                if (fieldName === word) {
                    return await this.findFieldDefinition(null, fieldName, modelName);
                }
            }
        }
        return null;
    }

    // --- Context helpers ---
    getXmlModelContext(documentText: string, lineNumber: number): string | null {
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
    getPythonModelContext(documentText: string, lineNumber: number): string | null {
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
    async findPythonMethodInModel(modelName: string, methodName: string): Promise<vscode.Location | null> {
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
    async findFieldDefinition(document: vscode.TextDocument | null, fieldName: string, modelName: string | null = null): Promise<vscode.Location | null> {
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
    async findModelDefinition(modelName: string): Promise<vscode.Location | null> {
        const modelInfos = modelIndexService.getModelsByName(modelName);
        if (modelInfos.length > 0) {
            // Prefer the base definition (isInherited = false)
            const baseModel = modelInfos.find(m => !m.isInherited) || modelInfos[0];
            return new vscode.Location(
                vscode.Uri.file(baseModel.filePath),
                new vscode.Position(baseModel.line, baseModel.character)
            );
        }
        return null;
    }
    async findXmlRecord(recordId: string): Promise<vscode.Location | null> {
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
    async findQWebTemplate(templateName: string): Promise<vscode.Location | null> {
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

    private isModelInheritContext(node: any): boolean {
        let current = node;
        let assignmentNode = null;
        let temp = current;
        while (temp) {
            if (temp.type === 'assignment') {
                const left = temp.childForFieldName('left');
                if (left?.text === '_inherit') {
                    assignmentNode = temp;
                    break;
                }
            }
            temp = temp.parent;
        }
        if (!assignmentNode) return false;

        let classNode = assignmentNode.parent;
        while (classNode && classNode.type !== 'class_definition') {
            classNode = classNode.parent;
        }
        if (!classNode) return false;

        const right = assignmentNode.childForFieldName('right');
        if (!right) return false;

        let inSupportedContainer = false;
        temp = current;
        while (temp && temp.startIndex >= right.startIndex && temp.endIndex <= right.endIndex) {
            if (temp.type === 'string' || temp.type === 'list' || temp.type === 'tuple' || temp.type === 'string_content') {
                inSupportedContainer = true;
                break;
            }
            temp = temp.parent;
        }
        return inSupportedContainer;
    }

    private async handleModelDefinitionMultiLookup(modelName: string): Promise<vscode.Location | vscode.Location[] | null> {
        const modelInfos = modelIndexService.getModelsByName(modelName);
        const baseModels = modelInfos.filter(m => !m.isInherited);

        if (baseModels.length === 0) {
            return null;
        }

        if (baseModels.length === 1) {
            const m = baseModels[0];
            return new vscode.Location(vscode.Uri.file(m.filePath), new vscode.Position(m.line, m.character));
        }

        // Multiple base models found, ask user to choose
        const pick = await vscode.window.showQuickPick(
            baseModels.map(m => ({
                label: `${m.modelName} (in ${m.moduleName})`,
                description: m.filePath,
                detail: `Class: ${m.className}`,
                model: m
            })),
            { placeHolder: `Select definition for model: ${modelName}` }
        );

        if (pick) {
            return new vscode.Location(vscode.Uri.file(pick.model.filePath), new vscode.Position(pick.model.line, pick.model.character));
        }

        return null;
    }
}
