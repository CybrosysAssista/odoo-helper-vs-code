import * as vscode from 'vscode';
import { CssClassIndexer } from './services/cssClassIndexer';
import * as fs from 'fs';
import * as path from 'path';
import { registerModelProviders } from './providers/odooModelProvider';
import { registerFieldProviders } from './providers/odooCompletionProvider';
import { registerCommands } from './commands/commandHandlers';
import { runOdooLint } from './services/odooLinter';
import modelIndexService from './services/modelIndexService';
import moduleIndexService from './services/moduleIndexService';
import templateIndexService from './services/templateIndexService';
import { OdooXmlCompletionProvider } from './providers/xml/xmlCompletionProvider';
import { RelationalFieldCompletionProvider } from './providers/completion/relationalFieldProvider';
import { ImportCompletionProvider } from './providers/completion/importCompletionProvider';
import { ManifestDependsCompletionProvider } from './providers/completion/manifestDependsCompletionProvider';
import { OdooDefinitionProvider } from './providers/odooDefinitionProvider';
import { ModelInheritCompletionProvider } from './providers/completion/modelInheritCompletionProvider';
import { getOdooVersion, clearCache } from './services/versionService';
import { getPythonParserService } from './services/pythonParserService';
import { testTreeSitterParser } from './commands/testTreeSitter';
import { addCurrentFileToManifest } from './commands/addToManifest';
import { ManifestPathCompletionProvider } from './providers/manifestPathCompletionProvider';
import { CssClassCompletionProvider } from './providers/completion/cssClassCompletionProvider';
import { getJavaScriptParserService } from './services/javascriptParserService';
import { getOdooRegistryIndexer } from './services/odooRegistryIndexer';

export async function activate(context: vscode.ExtensionContext): Promise<void> {
    // Initialize Tree-sitter Python Parser
    console.log('[Extension] Initializing Python Parser Service...');
    const pythonParser = getPythonParserService();
    try {
        await pythonParser.init(context);
        console.log('[Extension] Python Parser Service initialized');
    } catch (error) {
        console.error('[Extension] Failed to initialize Python Parser:', error);
        vscode.window.showWarningMessage('Tree-sitter parser failed to initialize. Some features may be limited.');
    }

    // Initialize Tree-sitter JavaScript Parser
    console.log('[Extension] Initializing JavaScript Parser Service...');
    const jsParser = getJavaScriptParserService();
    try {
        await jsParser.init(context);
        console.log('[Extension] JavaScript Parser Service initialized');
    } catch (error) {
        console.error('[Extension] Failed to initialize JavaScript Parser:', error);
        vscode.window.showWarningMessage('JavaScript parser failed to initialize. Some features may be limited.');
    }

    // Initialize index services
    modelIndexService.initialize();
    moduleIndexService.initialize();
    templateIndexService.initialize();

    // Start Odoo Indexing with progress
    vscode.window.withProgress({
        location: vscode.ProgressLocation.Notification,
        title: "Cybrosys Assista: Odoo Helper",
        cancellable: false
    }, async (progress) => {
        progress.report({ message: "Indexing Odoo Models..." });
        await modelIndexService.buildCache();

        progress.report({ message: "Indexing Odoo Modules..." });
        await moduleIndexService.reindex();

        progress.report({ message: "Indexing Odoo Templates..." });
        await templateIndexService.buildCache();

        progress.report({ message: "Indexing Odoo Registry..." });
        const registryIndexer = getOdooRegistryIndexer();
        await registryIndexer.scanWorkspace();

        progress.report({ message: "Indexing CSS Classes..." });
        await CssClassIndexer.getInstance().indexWorkspace();

        return Promise.resolve();
    });

    // Start Odoo Registry Indexing helper for watchers
    const registryIndexer = getOdooRegistryIndexer();

    // Watch for JS file changes to update the registry index
    const jsWatcher = vscode.workspace.createFileSystemWatcher('**/*.js');

    jsWatcher.onDidChange(uri => registryIndexer.indexFile(uri));
    jsWatcher.onDidCreate(uri => registryIndexer.indexFile(uri));
    jsWatcher.onDidDelete(uri => registryIndexer.removeFile(uri));

    context.subscriptions.push(jsWatcher);

    // Register model providers
    registerModelProviders(context);

    // Register field providers
    registerFieldProviders(context);

    // Register XML completion provider
    const xmlProvider = new OdooXmlCompletionProvider();
    context.subscriptions.push(
        vscode.languages.registerCompletionItemProvider(
            { scheme: 'file', language: 'xml' },
            xmlProvider,
            '"', "'", '=', ' ', '>'
        )
    );

    // Register relational field completion provider
    const relationalFieldProvider = new RelationalFieldCompletionProvider();
    context.subscriptions.push(
        vscode.languages.registerCompletionItemProvider(
            { scheme: 'file', language: 'python' },
            relationalFieldProvider
        )
    );

    // ✅ Register import completion provider
    const importProvider = new ImportCompletionProvider();
    context.subscriptions.push(
        vscode.languages.registerCompletionItemProvider(
            { scheme: 'file', language: 'python' },
            importProvider
        )
    );

    // Register manifest depends completion provider
    const manifestDependsProvider = new ManifestDependsCompletionProvider();
    context.subscriptions.push(
        vscode.languages.registerCompletionItemProvider(
            [
                { scheme: 'file', language: '*', pattern: '**/__manifest__.py' },
                { scheme: 'file', language: '*', pattern: '**/__manifest__.json' }
            ],
            manifestDependsProvider,
            "'", '"', ',', '[', ' '
        )
    );

    // Register manifest path completion provider
    const manifestPathProvider = new ManifestPathCompletionProvider();
    context.subscriptions.push(
        vscode.languages.registerCompletionItemProvider(
            { scheme: 'file', pattern: '**/__manifest__.py' },
            manifestPathProvider,
            "'", '"', '/', ',', '[', ' ',
            'a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j', 'k', 'l', 'm', 'n', 'o', 'p', 'q', 'r', 's', 't', 'u', 'v', 'w', 'x', 'y', 'z',
            'A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L', 'M', 'N', 'O', 'P', 'Q', 'R', 'S', 'T', 'U', 'V', 'W', 'X', 'Y', 'Z',
            '0', '1', '2', '3', '4', '5', '6', '7', '8', '9', '_', '-', '.'
        )
    );

    // Register versioned snippet providers for XML and Python
    registerVersionedSnippets(context);

    // Register Odoo Model Inherit completion provider
    const modelInheritProvider = new ModelInheritCompletionProvider();
    context.subscriptions.push(
        vscode.languages.registerCompletionItemProvider(
            { scheme: 'file', language: 'python' },
            modelInheritProvider,
            '"', "'"
        )
    );

    // Register CSS Class completion provider
    const cssClassProvider = new CssClassCompletionProvider();
    context.subscriptions.push(
        vscode.languages.registerCompletionItemProvider(
            { scheme: 'file', language: 'xml' },
            cssClassProvider,
            '"', "'"
        )
    );

    // Register Odoo definition provider
    const odooDefProvider = new OdooDefinitionProvider();
    context.subscriptions.push(
        vscode.languages.registerDefinitionProvider(
            { scheme: 'file', language: 'xml' },
            odooDefProvider
        )
    );
    context.subscriptions.push(
        vscode.languages.registerDefinitionProvider(
            { scheme: 'file', language: 'python' },
            odooDefProvider
        )
    );

    // Register commands
    registerCommands(context);

    // Register Tree-sitter test command
    context.subscriptions.push(
        vscode.commands.registerCommand('cybrosys-assista-odoo-helper.testTreeSitter', testTreeSitterParser)
    );

    // Register add file to manifest command
    context.subscriptions.push(
        vscode.commands.registerCommand('cybrosys-assista-odoo-helper.addFileToManifest', addCurrentFileToManifest)
    );

    // Status bar: Odoo version indicator and quick switch
    const odooVersionStatusItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
    odooVersionStatusItem.command = 'cybrosys-assista-odoo-helper.setOdooVersion';
    context.subscriptions.push(odooVersionStatusItem);

    async function updateOdooVersionStatus() {
        try {
            const v = await getOdooVersion();
            const cfg = vscode.workspace.getConfiguration('cybrosys-assista-odoo-helper');
            const raw = String(cfg.get('odooVersion', 'auto'));
            const mode = (raw === 'auto') ? 'Auto' : 'Manual';
            odooVersionStatusItem.text = `Odoo v${v} (${mode})`;
            odooVersionStatusItem.tooltip = 'Click to change Odoo version';
            odooVersionStatusItem.show();
        } catch (e) {
            odooVersionStatusItem.text = 'Odoo (unknown)';
            odooVersionStatusItem.show();
        }
    }
    updateOdooVersionStatus();

    const setVersionCmd = vscode.commands.registerCommand('cybrosys-assista-odoo-helper.setOdooVersion', async () => {
        const pick = await vscode.window.showQuickPick(
            [
                { label: 'Auto (detect from odoo/release.py)', value: 'auto' },
                { label: 'Odoo 19', value: '19' },
                { label: 'Odoo 18', value: '18' }
            ],
            { placeHolder: 'Select target Odoo version' }
        );
        if (!pick) return;
        const cfg = vscode.workspace.getConfiguration('cybrosys-assista-odoo-helper');
        await cfg.update('odooVersion', pick.value, vscode.ConfigurationTarget.Workspace);
        updateOdooVersionStatus();
        vscode.window.showInformationMessage(`Odoo version set to: ${pick.label}`);
    });
    context.subscriptions.push(setVersionCmd);

    // Odoo Linting Setup
    const diagnosticCollection = vscode.languages.createDiagnosticCollection("odooLint");
    context.subscriptions.push(diagnosticCollection);

    vscode.workspace.textDocuments.forEach(doc => runOdooLint(doc, diagnosticCollection));

    vscode.workspace.onDidOpenTextDocument(
        doc => runOdooLint(doc, diagnosticCollection),
        null,
        context.subscriptions
    );

    vscode.workspace.onDidChangeTextDocument(
        e => runOdooLint(e.document, diagnosticCollection),
        null,
        context.subscriptions
    );

    vscode.workspace.onDidSaveTextDocument(
        doc => runOdooLint(doc, diagnosticCollection),
        null,
        context.subscriptions
    );

    // Re-run linting when relevant config changes
    vscode.workspace.onDidChangeConfiguration(
        e => {
            if (e.affectsConfiguration('cybrosys-assista-odoo-helper.enableCodeStandardWarnings')) {
                vscode.workspace.textDocuments.forEach(doc => runOdooLint(doc, diagnosticCollection));
            }
            if (
                e.affectsConfiguration('cybrosys-assista-odoo-helper.odooVersion') ||
                e.affectsConfiguration('cybrosys-assista-odoo-helper.odooSourcePath')
            ) {
                // Clear version cache when configuration changes to ensure fresh detection
                clearCache();
                updateOdooVersionStatus();
            }
        },
        null,
        context.subscriptions
    );
}

async function registerVersionedSnippets(context: vscode.ExtensionContext): Promise<void> {
    try {
        const extensionPath = context.extensionPath;

        // XML snippets provider - reads version dynamically
        const xmlProvider = {
            async provideCompletionItems() {
                try {
                    const version = await getOdooVersion();
                    const xmlFile = version === '18' ? 'snippets/xml18.json' : 'snippets/xml19.json';
                    const xmlPath = path.join(extensionPath, xmlFile);
                    if (!fs.existsSync(xmlPath)) return [];

                    const raw = fs.readFileSync(xmlPath, 'utf8');
                    const snippets = JSON.parse(raw);
                    const items: vscode.CompletionItem[] = [];
                    for (const [name, def] of Object.entries(snippets) as [string, any][]) {
                        const label = def.prefix || name;
                        const item = new vscode.CompletionItem(label, vscode.CompletionItemKind.Snippet);
                        const body = Array.isArray(def.body) ? def.body.join('\n') : String(def.body || '');
                        item.insertText = new vscode.SnippetString(body);
                        item.detail = name;
                        if (def.description) item.documentation = def.description;
                        items.push(item);
                    }
                    return items;
                } catch (e) {
                    return [];
                }
            }
        };
        context.subscriptions.push(
            vscode.languages.registerCompletionItemProvider(
                { scheme: 'file', language: 'xml' },
                xmlProvider
            )
        );

        // Python snippets provider - reads version dynamically
        const pyProvider = {
            async provideCompletionItems() {
                try {
                    const version = await getOdooVersion();
                    const pyFile = version === '18' ? 'snippets/python18.json' : 'snippets/python19.json';
                    const pyPath = path.join(extensionPath, pyFile);
                    if (!fs.existsSync(pyPath)) return [];

                    const raw = fs.readFileSync(pyPath, 'utf8');
                    const snippets = JSON.parse(raw);
                    const items: vscode.CompletionItem[] = [];
                    for (const [name, def] of Object.entries(snippets) as [string, any][]) {
                        const label = def.prefix || name;
                        const item = new vscode.CompletionItem(label, vscode.CompletionItemKind.Snippet);
                        const body = Array.isArray(def.body) ? def.body.join('\n') : String(def.body || '');
                        item.insertText = new vscode.SnippetString(body);
                        item.detail = name;
                        if (def.description) item.documentation = def.description;
                        items.push(item);
                    }
                    return items;
                } catch (e) {
                    return [];
                }
            }
        };
        context.subscriptions.push(
            vscode.languages.registerCompletionItemProvider(
                { scheme: 'file', language: 'python' },
                pyProvider
            )
        );
    } catch (e) {
        // best-effort; ignore
    }
}

export function deactivate(): void {
    modelIndexService.dispose();
    moduleIndexService.dispose();
}
