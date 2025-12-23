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
exports.activate = activate;
exports.deactivate = deactivate;
const vscode = __importStar(require("vscode"));
const cssClassIndexer_1 = require("./services/cssClassIndexer");
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const odooModelProvider_1 = require("./providers/odooModelProvider");
const odooCompletionProvider_1 = require("./providers/odooCompletionProvider");
const commandHandlers_1 = require("./commands/commandHandlers");
const odooLinter_1 = require("./services/odooLinter");
const modelIndexService_1 = __importDefault(require("./services/modelIndexService"));
const moduleIndexService_1 = __importDefault(require("./services/moduleIndexService"));
const templateIndexService_1 = __importDefault(require("./services/templateIndexService"));
const xmlCompletionProvider_1 = require("./providers/xml/xmlCompletionProvider");
const relationalFieldProvider_1 = require("./providers/completion/relationalFieldProvider");
const importCompletionProvider_1 = require("./providers/completion/importCompletionProvider");
const manifestDependsCompletionProvider_1 = require("./providers/completion/manifestDependsCompletionProvider");
const odooDefinitionProvider_1 = require("./providers/odooDefinitionProvider");
const versionService_1 = require("./services/versionService");
const pythonParserService_1 = require("./services/pythonParserService");
const testTreeSitter_1 = require("./commands/testTreeSitter");
const addToManifest_1 = require("./commands/addToManifest");
const manifestPathCompletionProvider_1 = require("./providers/manifestPathCompletionProvider");
const cssClassCompletionProvider_1 = require("./providers/completion/cssClassCompletionProvider");
const javascriptParserService_1 = require("./services/javascriptParserService");
const odooRegistryIndexer_1 = require("./services/odooRegistryIndexer");
async function activate(context) {
    // Initialize Tree-sitter Python Parser
    console.log('[Extension] Initializing Python Parser Service...');
    const pythonParser = (0, pythonParserService_1.getPythonParserService)();
    try {
        await pythonParser.init(context);
        console.log('[Extension] Python Parser Service initialized');
    }
    catch (error) {
        console.error('[Extension] Failed to initialize Python Parser:', error);
        vscode.window.showWarningMessage('Tree-sitter parser failed to initialize. Some features may be limited.');
    }
    // Initialize Tree-sitter JavaScript Parser
    console.log('[Extension] Initializing JavaScript Parser Service...');
    const jsParser = (0, javascriptParserService_1.getJavaScriptParserService)();
    try {
        await jsParser.init(context);
        console.log('[Extension] JavaScript Parser Service initialized');
    }
    catch (error) {
        console.error('[Extension] Failed to initialize JavaScript Parser:', error);
        vscode.window.showWarningMessage('JavaScript parser failed to initialize. Some features may be limited.');
    }
    // Initialize index services
    modelIndexService_1.default.initialize();
    moduleIndexService_1.default.initialize();
    templateIndexService_1.default.initialize();
    // Start Odoo Indexing with progress
    vscode.window.withProgress({
        location: vscode.ProgressLocation.Notification,
        title: "Cybrosys Assista: Odoo Helper",
        cancellable: false
    }, async (progress) => {
        progress.report({ message: "Indexing Odoo Models..." });
        await modelIndexService_1.default.buildCache();
        progress.report({ message: "Indexing Odoo Modules..." });
        await moduleIndexService_1.default.reindex();
        progress.report({ message: "Indexing Odoo Templates..." });
        await templateIndexService_1.default.buildCache();
        progress.report({ message: "Indexing Odoo Registry..." });
        const registryIndexer = (0, odooRegistryIndexer_1.getOdooRegistryIndexer)();
        await registryIndexer.scanWorkspace();
        progress.report({ message: "Indexing CSS Classes..." });
        await cssClassIndexer_1.CssClassIndexer.getInstance().indexWorkspace();
        return Promise.resolve();
    });
    // Start Odoo Registry Indexing helper for watchers
    const registryIndexer = (0, odooRegistryIndexer_1.getOdooRegistryIndexer)();
    // Watch for JS file changes to update the registry index
    const jsWatcher = vscode.workspace.createFileSystemWatcher('**/*.js');
    jsWatcher.onDidChange(uri => registryIndexer.indexFile(uri));
    jsWatcher.onDidCreate(uri => registryIndexer.indexFile(uri));
    jsWatcher.onDidDelete(uri => registryIndexer.removeFile(uri));
    context.subscriptions.push(jsWatcher);
    // Register model providers
    (0, odooModelProvider_1.registerModelProviders)(context);
    // Register field providers
    (0, odooCompletionProvider_1.registerFieldProviders)(context);
    // Register XML completion provider
    const xmlProvider = new xmlCompletionProvider_1.OdooXmlCompletionProvider();
    context.subscriptions.push(vscode.languages.registerCompletionItemProvider({ scheme: 'file', language: 'xml' }, xmlProvider, '"', "'", '=', ' ', '>'));
    // Register relational field completion provider
    const relationalFieldProvider = new relationalFieldProvider_1.RelationalFieldCompletionProvider();
    context.subscriptions.push(vscode.languages.registerCompletionItemProvider({ scheme: 'file', language: 'python' }, relationalFieldProvider));
    // ✅ Register import completion provider
    const importProvider = new importCompletionProvider_1.ImportCompletionProvider();
    context.subscriptions.push(vscode.languages.registerCompletionItemProvider({ scheme: 'file', language: 'python' }, importProvider));
    // Register manifest depends completion provider
    const manifestDependsProvider = new manifestDependsCompletionProvider_1.ManifestDependsCompletionProvider();
    context.subscriptions.push(vscode.languages.registerCompletionItemProvider([
        { scheme: 'file', language: '*', pattern: '**/__manifest__.py' },
        { scheme: 'file', language: '*', pattern: '**/__manifest__.json' }
    ], manifestDependsProvider, "'", '"', ',', '[', ' '));
    // Register manifest path completion provider
    const manifestPathProvider = new manifestPathCompletionProvider_1.ManifestPathCompletionProvider();
    context.subscriptions.push(vscode.languages.registerCompletionItemProvider({ scheme: 'file', pattern: '**/__manifest__.py' }, manifestPathProvider, "'", '"', '/', ',', '[', ' ', 'a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j', 'k', 'l', 'm', 'n', 'o', 'p', 'q', 'r', 's', 't', 'u', 'v', 'w', 'x', 'y', 'z', 'A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L', 'M', 'N', 'O', 'P', 'Q', 'R', 'S', 'T', 'U', 'V', 'W', 'X', 'Y', 'Z', '0', '1', '2', '3', '4', '5', '6', '7', '8', '9', '_', '-', '.'));
    // Register versioned snippet providers for XML and Python
    registerVersionedSnippets(context);
    // Register CSS Class completion provider
    const cssClassProvider = new cssClassCompletionProvider_1.CssClassCompletionProvider();
    context.subscriptions.push(vscode.languages.registerCompletionItemProvider({ scheme: 'file', language: 'xml' }, cssClassProvider, '"', "'"));
    // Register Odoo definition provider
    const odooDefProvider = new odooDefinitionProvider_1.OdooDefinitionProvider();
    context.subscriptions.push(vscode.languages.registerDefinitionProvider({ scheme: 'file', language: 'xml' }, odooDefProvider));
    context.subscriptions.push(vscode.languages.registerDefinitionProvider({ scheme: 'file', language: 'python' }, odooDefProvider));
    // Register commands
    (0, commandHandlers_1.registerCommands)(context);
    // Register Tree-sitter test command
    context.subscriptions.push(vscode.commands.registerCommand('cybrosys-assista-odoo-helper.testTreeSitter', testTreeSitter_1.testTreeSitterParser));
    // Register add file to manifest command
    context.subscriptions.push(vscode.commands.registerCommand('cybrosys-assista-odoo-helper.addFileToManifest', addToManifest_1.addCurrentFileToManifest));
    // Status bar: Odoo version indicator and quick switch
    const odooVersionStatusItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
    odooVersionStatusItem.command = 'cybrosys-assista-odoo-helper.setOdooVersion';
    context.subscriptions.push(odooVersionStatusItem);
    async function updateOdooVersionStatus() {
        try {
            const v = await (0, versionService_1.getOdooVersion)();
            const cfg = vscode.workspace.getConfiguration('cybrosys-assista-odoo-helper');
            const raw = String(cfg.get('odooVersion', 'auto'));
            const mode = (raw === 'auto') ? 'Auto' : 'Manual';
            odooVersionStatusItem.text = `Odoo v${v} (${mode})`;
            odooVersionStatusItem.tooltip = 'Click to change Odoo version';
            odooVersionStatusItem.show();
        }
        catch (e) {
            odooVersionStatusItem.text = 'Odoo (unknown)';
            odooVersionStatusItem.show();
        }
    }
    updateOdooVersionStatus();
    const setVersionCmd = vscode.commands.registerCommand('cybrosys-assista-odoo-helper.setOdooVersion', async () => {
        const pick = await vscode.window.showQuickPick([
            { label: 'Auto (detect from odoo/release.py)', value: 'auto' },
            { label: 'Odoo 19', value: '19' },
            { label: 'Odoo 18', value: '18' }
        ], { placeHolder: 'Select target Odoo version' });
        if (!pick)
            return;
        const cfg = vscode.workspace.getConfiguration('cybrosys-assista-odoo-helper');
        await cfg.update('odooVersion', pick.value, vscode.ConfigurationTarget.Workspace);
        updateOdooVersionStatus();
        vscode.window.showInformationMessage(`Odoo version set to: ${pick.label}`);
    });
    context.subscriptions.push(setVersionCmd);
    // Odoo Linting Setup
    const diagnosticCollection = vscode.languages.createDiagnosticCollection("odooLint");
    context.subscriptions.push(diagnosticCollection);
    vscode.workspace.textDocuments.forEach(doc => (0, odooLinter_1.runOdooLint)(doc, diagnosticCollection));
    vscode.workspace.onDidOpenTextDocument(doc => (0, odooLinter_1.runOdooLint)(doc, diagnosticCollection), null, context.subscriptions);
    vscode.workspace.onDidChangeTextDocument(e => (0, odooLinter_1.runOdooLint)(e.document, diagnosticCollection), null, context.subscriptions);
    vscode.workspace.onDidSaveTextDocument(doc => (0, odooLinter_1.runOdooLint)(doc, diagnosticCollection), null, context.subscriptions);
    // Re-run linting when relevant config changes
    vscode.workspace.onDidChangeConfiguration(e => {
        if (e.affectsConfiguration('cybrosys-assista-odoo-helper.enableCodeStandardWarnings')) {
            vscode.workspace.textDocuments.forEach(doc => (0, odooLinter_1.runOdooLint)(doc, diagnosticCollection));
        }
        if (e.affectsConfiguration('cybrosys-assista-odoo-helper.odooVersion') ||
            e.affectsConfiguration('cybrosys-assista-odoo-helper.odooSourcePath')) {
            // Clear version cache when configuration changes to ensure fresh detection
            (0, versionService_1.clearCache)();
            updateOdooVersionStatus();
        }
    }, null, context.subscriptions);
}
async function registerVersionedSnippets(context) {
    try {
        const extensionPath = context.extensionPath;
        // XML snippets provider - reads version dynamically
        const xmlProvider = {
            async provideCompletionItems() {
                try {
                    const version = await (0, versionService_1.getOdooVersion)();
                    const xmlFile = version === '18' ? 'snippets/xml18.json' : 'snippets/xml19.json';
                    const xmlPath = path.join(extensionPath, xmlFile);
                    if (!fs.existsSync(xmlPath))
                        return [];
                    const raw = fs.readFileSync(xmlPath, 'utf8');
                    const snippets = JSON.parse(raw);
                    const items = [];
                    for (const [name, def] of Object.entries(snippets)) {
                        const label = def.prefix || name;
                        const item = new vscode.CompletionItem(label, vscode.CompletionItemKind.Snippet);
                        const body = Array.isArray(def.body) ? def.body.join('\n') : String(def.body || '');
                        item.insertText = new vscode.SnippetString(body);
                        item.detail = name;
                        if (def.description)
                            item.documentation = def.description;
                        items.push(item);
                    }
                    return items;
                }
                catch (e) {
                    return [];
                }
            }
        };
        context.subscriptions.push(vscode.languages.registerCompletionItemProvider({ scheme: 'file', language: 'xml' }, xmlProvider));
        // Python snippets provider - reads version dynamically
        const pyProvider = {
            async provideCompletionItems() {
                try {
                    const version = await (0, versionService_1.getOdooVersion)();
                    const pyFile = version === '18' ? 'snippets/python18.json' : 'snippets/python19.json';
                    const pyPath = path.join(extensionPath, pyFile);
                    if (!fs.existsSync(pyPath))
                        return [];
                    const raw = fs.readFileSync(pyPath, 'utf8');
                    const snippets = JSON.parse(raw);
                    const items = [];
                    for (const [name, def] of Object.entries(snippets)) {
                        const label = def.prefix || name;
                        const item = new vscode.CompletionItem(label, vscode.CompletionItemKind.Snippet);
                        const body = Array.isArray(def.body) ? def.body.join('\n') : String(def.body || '');
                        item.insertText = new vscode.SnippetString(body);
                        item.detail = name;
                        if (def.description)
                            item.documentation = def.description;
                        items.push(item);
                    }
                    return items;
                }
                catch (e) {
                    return [];
                }
            }
        };
        context.subscriptions.push(vscode.languages.registerCompletionItemProvider({ scheme: 'file', language: 'python' }, pyProvider));
    }
    catch (e) {
        // best-effort; ignore
    }
}
function deactivate() {
    modelIndexService_1.default.dispose();
    moduleIndexService_1.default.dispose();
}
//# sourceMappingURL=extension.js.map