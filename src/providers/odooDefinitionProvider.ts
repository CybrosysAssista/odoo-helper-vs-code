import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import moduleIndexService from '../services/moduleIndexService';
import modelIndexService from '../services/modelIndexService';
import fieldIndexService from '../services/fieldIndexService';
import functionIndexService from '../services/functionIndexService';
import { getPythonParserService } from '../services/pythonParserService';
import { ManifestParser, ParsedManifest } from '../services/manifestParser';

import { OdooModuleUtils } from '../utils/odooModuleUtils';
import { CssClassIndexer } from '../services/cssClassIndexer';
import { getOdooRegistryIndexer } from '../services/odooRegistryIndexer';
import { getXmlParserService } from '../services/xmlParserService';
import templateIndexService, { TemplateLocation } from '../services/templateIndexService';

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
                const methods = modelName ? await this.findPythonMethodInModel(modelName, word) : null;
                if (methods) {
                    return methods;
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
                const parentMenu = parentMatch && parentMatch[1] === word ? await this.findXmlRecord(word) : null;
                if (parentMenu) {
                    return parentMenu;
                }
            }
            // QWeb t-call and t-name navigation
            if (/t-call\s*=\s*["']([^"']+)["']/.test(line) || /t-name\s*=\s*["']([^"']+)["']/.test(line)) {
                // Only trigger if cursor is on the value
                if (word) {
                    return await this.findQWebTemplate(word);
                }
            }
            // model="..." or res_model="..." (Using Parser for model="..." in <record>)
            const offset = document.offsetAt(position);
            const xmlParser = getXmlParserService();
            const node = xmlParser.findNodeAtOffset(documentText, offset);

            if (node && node.tag === 'record') {
                const textUntilCursor = documentText.slice(node.start, offset);
                const modelMatch = textUntilCursor.match(/model\s*=\s*(['"])([^'"]*)$/);
                if (modelMatch && word) {
                    const moduleRoot = await OdooModuleUtils.getModuleRoot(document.uri);
                    const currentModuleName = moduleRoot ? path.basename(moduleRoot.fsPath) : '';
                    return await this.handleModelDefinitionMultiLookup(word, currentModuleName);
                }
            }

            if (node && (node.tag === 'field' || node.tag === 'filter') && word) {

                const viewModel = OdooModuleUtils.findViewModel(node, documentText);
                if (viewModel) {
                    const moduleRoot = await OdooModuleUtils.getModuleRoot(document.uri);
                    const currentModuleName = moduleRoot ? path.basename(moduleRoot.fsPath) : '';
                    const attrs = xmlParser.getAttributes(documentText, node);
                    const fieldName = attrs['name'];
                    if (fieldName === word) {
                        const fields = fieldIndexService.getFieldsForModel(viewModel);
                        const candidates = fields.filter(f =>
                            f.fieldName === word && (
                                !f.isInherited ||
                                (currentModuleName && f.moduleName === currentModuleName)
                            )
                        );

                        if (candidates.length > 0) {
                            if (candidates.length === 1) {
                                return new vscode.Location(
                                    vscode.Uri.file(candidates[0].filePath),
                                    new vscode.Position(candidates[0].line, candidates[0].character)
                                );
                            }

                            // Several definitions: VS Code lists them in its peek view.
                            return candidates.map(f => new vscode.Location(vscode.Uri.file(f.filePath), new vscode.Position(f.line, f.character)));
                        }
                    }
                }

                // Check if we are in the content area of the field
                if (node.startTagEnd !== undefined && offset >= node.startTagEnd && (node.endTagStart === undefined || offset <= node.endTagStart)) {
                    const attrs = xmlParser.getAttributes(documentText, node);
                    if (attrs['name'] === 'model' || attrs['name'] === 'res_model') {
                        const recordModel = OdooModuleUtils.getRecordModel(node, documentText);
                        if (recordModel === 'ir.ui.view' || recordModel === 'ir.actions.act_window') {
                            const moduleRoot = await OdooModuleUtils.getModuleRoot(document.uri);
                            const currentModuleName = moduleRoot ? path.basename(moduleRoot.fsPath) : '';
                            return await this.handleModelDefinitionMultiLookup(word, currentModuleName);
                        }
                    }



                    if (attrs['name'] === 'tag') {
                        const recordModel = OdooModuleUtils.getRecordModel(node, documentText);
                        if (recordModel === 'ir.actions.client') {
                            const registryIndexer = getOdooRegistryIndexer();
                            const entries = registryIndexer.getEntriesByCategory('actions').filter(e => e.id === word);

                            if (entries.length === 0) return null;
                            if (entries.length === 1) {
                                return new vscode.Location(
                                    vscode.Uri.file(entries[0].filePath),
                                    new vscode.Position(entries[0].line, 0)
                                );
                            }

                            // Several definitions: VS Code lists them in its peek view.
                            return entries.map(e => new vscode.Location(vscode.Uri.file(e.filePath), new vscode.Position(e.line, 0)));
                        }
                    }
                }
            }

            if (node?.tag === 'button' && word) {
                const viewModel = OdooModuleUtils.findViewModel(node, documentText);
                if (viewModel) {
                    const moduleRoot = await OdooModuleUtils.getModuleRoot(document.uri);
                    const currentModuleName = moduleRoot ? path.basename(moduleRoot.fsPath) : '';
                    const attrs = xmlParser.getAttributes(documentText, node);
                    const buttonName = attrs['name'];
                    const buttonType = attrs['type']?.toLowerCase();

                    // Methods are used when type="object"
                    if (buttonName === word && buttonType === 'object') {
                        const functions = functionIndexService.getFunctionsForModel(viewModel);
                        const candidates = functions.filter(f =>
                            f.functionName === word && (
                                !f.isInherited ||
                                (currentModuleName && f.moduleName === currentModuleName)
                            )
                        );

                        if (candidates.length > 0) {
                            if (candidates.length === 1) {
                                return new vscode.Location(
                                    vscode.Uri.file(candidates[0].filePath),
                                    new vscode.Position(candidates[0].line, candidates[0].character)
                                );
                            }

                            // Several definitions: VS Code lists them in its peek view.
                            return candidates.map(f => new vscode.Location(vscode.Uri.file(f.filePath), new vscode.Position(f.line, f.character)));
                        }
                    }
                }
            }

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
            if (!OdooModuleUtils.getModuleRootPath(document.uri.fsPath)) return null;

            // Handle _inherit navigation using Tree-sitter
            const pythonParser = getPythonParserService();
            if (pythonParser.isInitialized()) {
                const offset = document.offsetAt(position);
                const inheritedModel = pythonParser.withTree(documentText, tree => {
                    const node = tree.rootNode.descendantForIndex(Math.max(0, offset - 1));
                    return node && this.isModelInheritContext(node) ? node.text.replace(/['"]/g, '') : '';
                });
                if (inheritedModel) {
                    return await this.handleModelDefinitionMultiLookup(inheritedModel);
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
                                                    // console.log(`[OdooDefinitionProvider] Resolved path: ${fullPath}`);
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

        const identRange = document.getWordRangeAtPosition(position);
        if (!identRange) return null;
        const ident = document.getText(identRange);
        const currentModel = this.getPythonModelContext(documentText, position.line);

        // env['model.name'], with the cursor inside the string
        for (const match of line.matchAll(/env\[\s*['"]([^'"]+)['"]\s*\]/g)) {
            const start = match.index! + match[0].indexOf(match[1]);
            if (position.character >= start && position.character <= start + match[1].length) {
                return await this.findModelDefinition(match[1]);
            }
        }

        // related='partner_id.country_id': a field chain from the current model
        for (const match of line.matchAll(/related\s*=\s*['"]([^'"]+)['"]/g)) {
            const start = match.index! + match[0].indexOf(match[1]);
            if (currentModel && position.character >= start && position.character <= start + match[1].length) {
                const segments = match[1].split('.');
                const index = match[1].slice(0, position.character - start).split('.').length - 1;
                const model = this.resolveFieldChain(currentModel, segments.slice(0, index));
                return model ? await this.findFieldDefinition(null, segments[index], model) : null;
            }
        }

        // self.field, self.method(), self.partner_id.name...: resolve the chain up to the identifier
        const chain = line.slice(0, identRange.end.character).match(/\bself((?:\.\w+)*)$/);
        if (chain && currentModel) {
            const segments = chain[1].split('.').filter(Boolean);
            const model = this.resolveFieldChain(currentModel, segments.slice(0, -1));
            if (model) {
                const found = await this.findFieldDefinition(null, ident, model) ?? await this.findPythonMethodInModel(model, ident);
                if (found) return found;
            }
        }
        return null;
    }

    /** The model reached by following relational `fields` from `model`, or null if the chain breaks. */
    private resolveFieldChain(model: string, fields: string[]): string | null {
        let current = model;
        for (const name of fields) {
            const comodel = fieldIndexService.getFieldsForModel(current).find(f => f.fieldName === name && f.attributes['comodel_name'])?.attributes['comodel_name'];
            if (!comodel) return null;
            current = comodel;
        }
        return current;
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
        // The model of the class enclosing the line: its `_name`, else its (first) `_inherit`.
        const lines = documentText.split('\n');
        let classLine = -1;
        for (let i = Math.min(lineNumber, lines.length - 1); i >= 0; i--) {
            if (/^class\s+\w+/.test(lines[i])) { classLine = i; break; }
        }
        if (classLine === -1) return null;
        let inherit: string | null = null;
        for (let i = classLine + 1; i < lines.length && !/^class\s+\w+/.test(lines[i]); i++) {
            const name = lines[i].match(/^\s+_name\s*=\s*['"]([\w.]+)['"]/);
            if (name) return name[1];
            const inh = lines[i].match(/^\s+_inherit\s*=\s*\[?\s*['"]([\w.]+)['"]/);
            if (inh && !inherit) inherit = inh[1];
        }
        return inherit;
    }

    // --- Navigation helpers ---
    async findPythonMethodInModel(modelName: string, methodName: string): Promise<vscode.Location[] | null> {
        const methods = functionIndexService.getFunctionsForModel(modelName).filter(f => f.functionName === methodName);
        return methods.length > 0
            ? methods.map(f => new vscode.Location(vscode.Uri.file(f.filePath), new vscode.Position(f.line, f.character)))
            : null;
    }
    async findFieldDefinition(document: vscode.TextDocument | null, fieldName: string, modelName: string | null = null): Promise<vscode.Location[] | null> {
        if (!modelName && document) {
            modelName = this.getPythonModelContext(document.getText(), document.lineCount - 1);
        }
        if (!modelName) return null;
        const fields = fieldIndexService.getFieldsForModel(modelName).filter(f => f.fieldName === fieldName);
        return fields.length > 0
            ? fields.map(f => new vscode.Location(vscode.Uri.file(f.filePath), new vscode.Position(f.line, f.character)))
            : null;
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
    async findXmlRecord(recordId: string): Promise<vscode.Location[] | null> {
        return this.toLocations(templateIndexService.findXmlId(recordId));
    }
    async findQWebTemplate(templateName: string): Promise<vscode.Location[] | null> {
        return this.toLocations(templateIndexService.findTemplate(templateName));
    }
    private toLocations(found: TemplateLocation[]): vscode.Location[] | null {
        return found.length > 0
            ? found.map(l => new vscode.Location(vscode.Uri.file(l.filePath), new vscode.Position(l.line, 0)))
            : null;
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

    private async handleModelDefinitionMultiLookup(modelName: string, currentModuleName: string = ''): Promise<vscode.Location | vscode.Location[] | null> {
        const modelInfos = modelIndexService.getModelsByName(modelName);

        // Filter: not inherited OR (inherited AND module is current module)
        const candidates = modelInfos.filter(m =>
            !m.isInherited || (m.isInherited && currentModuleName && m.moduleName === currentModuleName)
        );

        if (candidates.length === 0) {
            // Fallback to all models if no filtered candidates found
            if (modelInfos.length === 0) return null;

            if (modelInfos.length === 1) {
                const m = modelInfos[0];
                return new vscode.Location(vscode.Uri.file(m.filePath), new vscode.Position(m.line, m.character));
            }

            // Several definitions: VS Code lists them in its peek view.
            return modelInfos.map(m => new vscode.Location(vscode.Uri.file(m.filePath), new vscode.Position(m.line, m.character)));
        }

        if (candidates.length === 1) {
            const m = candidates[0];
            return new vscode.Location(vscode.Uri.file(m.filePath), new vscode.Position(m.line, m.character));
        }

        // Multiple candidates found, ask user to choose
        // Several definitions: VS Code lists them in its peek view.
        return candidates.map(m => new vscode.Location(vscode.Uri.file(m.filePath), new vscode.Position(m.line, m.character)));
    }
}
