import * as vscode from 'vscode';
import { CssClassIndexer } from './services/cssClassIndexer';
import * as fs from 'fs';
import * as path from 'path';
import { registerModelProviders } from './providers/odooModelProvider';
import { registerFieldProviders } from './providers/odooCompletionProvider';
import { registerCommands } from './commands/commandHandlers';
import { runOdooLint } from './services/odooLinter';
import modelIndexService from './services/modelIndexService';
import fieldIndexService from './services/fieldIndexService';
import functionIndexService from './services/functionIndexService';
import moduleIndexService from './services/moduleIndexService';
import templateIndexService from './services/templateIndexService';
import { OdooXmlCompletionProvider } from './providers/xml/xmlCompletionProvider';
import { RelationalFieldCompletionProvider } from './providers/completion/relationalFieldProvider';
import { ImportCompletionProvider } from './providers/completion/importCompletionProvider';
import { ManifestDependsCompletionProvider } from './providers/completion/manifestDependsCompletionProvider';
import { OdooDefinitionProvider } from './providers/odooDefinitionProvider';
import { ModelInheritCompletionProvider } from './providers/completion/modelInheritCompletionProvider';
import { PythonInheritedFunctionProvider } from './providers/completion/pythonInheritedFunctionProvider';
import { getOdooVersion, clearCache } from './services/versionService';
import { getPythonParserService } from './services/pythonParserService';

import { addCurrentFileToManifest } from './commands/addToManifest';
import { ManifestPathCompletionProvider } from './providers/manifestPathCompletionProvider';
import { CssClassCompletionProvider } from './providers/completion/cssClassCompletionProvider';
import { getJavaScriptParserService } from './services/javascriptParserService';
import { getOdooRegistryIndexer } from './services/odooRegistryIndexer';
import { persistenceService } from './services/persistenceService';
import { OdooPythonUtils } from './utils/odooPythonUtils';
import { ConfigViewProvider } from './providers/configViewProvider';

export async function activate(context: vscode.ExtensionContext): Promise<void> {
    // Initialize Persistence Service
    persistenceService.init(context);

    // Initialize Tree-sitter Python Parser
    // console.log('[Extension] Initializing Python Parser Service...');
    const pythonParser = getPythonParserService();
    try {
        await pythonParser.init(context);
        // console.log('[Extension] Python Parser Service initialized');
    } catch (error) {
        console.error('[Extension] Failed to initialize Python Parser:', error);
        vscode.window.showWarningMessage('Tree-sitter parser failed to initialize. Some features may be limited.');
    }

    // Initialize Tree-sitter JavaScript Parser
    // console.log('[Extension] Initializing JavaScript Parser Service...');
    const jsParser = getJavaScriptParserService();
    try {
        await jsParser.init(context);
        // console.log('[Extension] JavaScript Parser Service initialized');
    } catch (error) {
        console.error('[Extension] Failed to initialize JavaScript Parser:', error);
        vscode.window.showWarningMessage('JavaScript parser failed to initialize. Some features may be limited.');
    }

    // Initialize index services
    modelIndexService.initialize();
    fieldIndexService.initialize();
    functionIndexService.initialize();
    moduleIndexService.initialize();
    templateIndexService.initialize();

    const registryIndexer = getOdooRegistryIndexer();

    let isCached = false;
    // 🚀 Phase 3: Fast Bootstrap - Load previous index synchronously
    const loadStatusBar = vscode.window.setStatusBarMessage("Cybrosys Assista: Loading cached index...");
    await (async () => {
        try {
            const models = await persistenceService.load<any>('modelIndex');
            const fields = await persistenceService.load<any>('fieldIndex');
            const functions = await persistenceService.load<any>('functionIndex');
            const modules = await persistenceService.load<any>('moduleIndex');
            const templates = await persistenceService.load<any>('templateIndex');
            const registry = await persistenceService.load<any>('registryIndex');
            const css = await persistenceService.load<any>('cssIndex');

            if (models) {
                modelIndexService.loadState(models);
                isCached = true;
            }
            if (fields) fieldIndexService.loadState(fields);
            if (functions) functionIndexService.loadState(functions);
            if (modules) moduleIndexService.loadState(modules);
            if (templates) templateIndexService.loadState(templates);
            if (registry) registryIndexer.loadState(registry);
            if (css) CssClassIndexer.getInstance().loadState(css);

            // console.log('[Extension] Cached index loaded successfully');
        } catch (e) {
            console.error('[Extension] Failed to load cached index:', e);
        } finally {
            loadStatusBar.dispose();
        }
    })();

    // Background indexing refresh
    vscode.window.withProgress({
        location: vscode.ProgressLocation.Window,
        title: isCached ? "Cybrosys Assista: Refreshing index data.." : "Cybrosys Assista: Indexing..",
        cancellable: false
    }, async (progress) => {
        const config = vscode.workspace.getConfiguration('cybrosys-assista-odoo-helper');
        const enableCore = config.get<boolean>('indexing.enableCoreIndexing', true);
        const enableRegistry = config.get<boolean>('indexing.enableRegistryIndexing', true);

        // Incremental cache refresh
        if (enableCore) {
            await fieldIndexService.buildCache(progress);
            await functionIndexService.buildCache(progress);
        }

        // Templates are generally safe and fast enough
        await templateIndexService.buildCache(progress);

        // Orchestrate unified indexing pass
        if (enableCore) {
            await moduleIndexService.reindex(progress);
            await modelIndexService.buildCache(progress);
        }

        if (enableRegistry) {
            await registryIndexer.scanWorkspace(progress);
        }

        await CssClassIndexer.getInstance().indexWorkspace(progress);

        // 💾 Save updated index back to disk
        const saveStatusBar = vscode.window.setStatusBarMessage("Cybrosys Assista: Storing index to disk...");
        try {
            await persistenceService.save('modelIndex', modelIndexService.getState());
            await persistenceService.save('fieldIndex', fieldIndexService.getState());
            await persistenceService.save('functionIndex', functionIndexService.getState());
            await persistenceService.save('moduleIndex', moduleIndexService.getState());
            await persistenceService.save('templateIndex', templateIndexService.getState());
            await persistenceService.save('registryIndex', registryIndexer.getState());
            await persistenceService.save('cssIndex', CssClassIndexer.getInstance().getState());
        } catch (e) {
            console.error('[Extension] Failed to save index:', e);
        } finally {
            saveStatusBar.dispose();
        }

        return Promise.resolve();
    });

    // Watch for JS file changes to update the registry index
    const jsWatcher = vscode.workspace.createFileSystemWatcher('**/*.js');

    jsWatcher.onDidChange(uri => {
        const config = vscode.workspace.getConfiguration('cybrosys-assista-odoo-helper');
        if (config.get<boolean>('indexing.enableRegistryIndexing', true)) {
            registryIndexer.indexFile(uri);
        }
    });
    jsWatcher.onDidCreate(uri => {
        const config = vscode.workspace.getConfiguration('cybrosys-assista-odoo-helper');
        if (config.get<boolean>('indexing.enableRegistryIndexing', true)) {
            registryIndexer.indexFile(uri);
        }
    });
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

    // Register import completion provider
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

    // Register Python Inherited Function completion provider
    const pythonInheritedFuncProvider = new PythonInheritedFunctionProvider();
    context.subscriptions.push(
        vscode.languages.registerCompletionItemProvider(
            { scheme: 'file', language: 'python' },
            pythonInheritedFuncProvider,
            ' '
        )
    );

    // Register CSS Class completion provider
    const cssClassProvider = new CssClassCompletionProvider();
    context.subscriptions.push(
        vscode.languages.registerCompletionItemProvider(
            { scheme: 'file', language: 'xml' },
            cssClassProvider,
            '"', "'", " "
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

    // Odoo Server Configuration Status Bar Item
    const odooServerStatusItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 101);
    odooServerStatusItem.command = 'cybrosys-assista-odoo-helper.updateOdooServerConfig';
    context.subscriptions.push(odooServerStatusItem);

    async function updateOdooServerStatus() {
        const config = await persistenceService.load<any>('odoo_server_config');
        if (config && config.url) {
            try {
                const url = new URL(config.url);
                odooServerStatusItem.text = `$(server) Odoo: ${url.hostname}`;
                odooServerStatusItem.tooltip = `Connected to ${config.db} at ${config.url}\nUser: ${config.email}\nClick to update settings`;
            } catch (e) {
                odooServerStatusItem.text = `$(server) Odoo Server`;
                odooServerStatusItem.tooltip = `Click to configure Odoo server`;
            }
        } else {
            odooServerStatusItem.text = `$(link-external) Odoo Server`;
            odooServerStatusItem.tooltip = 'Click to configure Odoo server';
        }
        odooServerStatusItem.show();
    }
    updateOdooServerStatus();

    const updateServerCmd = vscode.commands.registerCommand('cybrosys-assista-odoo-helper.updateOdooServerConfig', async () => {
        let config = await persistenceService.load<any>('odoo_server_config') || {};

        // 1. Odoo URL
        const url = await vscode.window.showInputBox({
            prompt: 'Enter Odoo Server URL',
            placeHolder: 'e.g. http://localhost:8069',
            value: config.url || '',
            ignoreFocusOut: true
        });
        if (url === undefined) return;

        // 2. Database
        const db = await vscode.window.showInputBox({
            prompt: 'Enter Odoo Database Name',
            placeHolder: 'e.g. my_database',
            value: config.db || '',
            ignoreFocusOut: true
        });
        if (db === undefined) return;

        // 3. Email / Username
        const email = await vscode.window.showInputBox({
            prompt: 'Enter Odoo Admin Email / Username',
            placeHolder: 'e.g. admin',
            value: config.email || '',
            ignoreFocusOut: true
        });
        if (email === undefined) return;

        // 4. Password
        const password = await vscode.window.showInputBox({
            prompt: 'Enter Odoo Password',
            placeHolder: '••••••••',
            value: config.password || '',
            password: true,
            ignoreFocusOut: true
        });
        if (password === undefined) return;

        // Save all together
        config = { url, db, email, password };
        await persistenceService.save('odoo_server_config', config);
        updateOdooServerStatus();
        configProvider.refresh();
        vscode.window.showInformationMessage(`Odoo server configuration updated successfully.`);
    });
    context.subscriptions.push(updateServerCmd);

    context.subscriptions.push(vscode.commands.registerCommand('cybrosys-assista-odoo-helper.refreshStatusBar', () => {
        updateOdooServerStatus();
    }));

    const clearIndexCmd = vscode.commands.registerCommand('cybrosys-assista-odoo-helper.clearIndexData', async () => {
        const confirm = await vscode.window.showWarningMessage(
            'Are you sure you want to remove all index data? This will clear the local cache and require a full re-index.',
            { modal: true },
            'Yes'
        );

        if (confirm !== 'Yes') return;

        const indices = [
            'modelIndex', 'fieldIndex', 'functionIndex', 'moduleIndex',
            'templateIndex', 'registryIndex', 'cssIndex'
        ];

        for (const index of indices) {
            await persistenceService.clear(index);
        }

        vscode.window.showInformationMessage('Assista: Index data cleared. Please restart VS Code or trigger a refresh to rebuild the index.');
    });
    context.subscriptions.push(clearIndexCmd);

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
            if (e.affectsConfiguration('cybrosys-assista-odoo-helper.odoo_server_config')) {
                updateOdooServerStatus();
            }
        },
        null,
        context.subscriptions
    );

    // Context Key Management for Odoo Model Tools
    const updateOdooModelContext = async () => {
        const editor = vscode.window.activeTextEditor;
        if (editor && editor.document.languageId === 'python') {
            const context = await OdooPythonUtils.getModelAtContext(editor.document.uri, editor.selection.active);
            vscode.commands.executeCommand('setContext', 'cybrosys-assista-odoo-helper.isOdooModel', context.valid);
        } else {
            vscode.commands.executeCommand('setContext', 'cybrosys-assista-odoo-helper.isOdooModel', false);
        }
    };

    vscode.window.onDidChangeActiveTextEditor(updateOdooModelContext, null, context.subscriptions);
    vscode.window.onDidChangeTextEditorSelection(updateOdooModelContext, null, context.subscriptions);
    updateOdooModelContext();

    // Register Configurations View
    const configProvider = new ConfigViewProvider(context.extensionUri);
    context.subscriptions.push(
        vscode.window.registerWebviewViewProvider(ConfigViewProvider.viewType, configProvider)
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
    functionIndexService.dispose();
    moduleIndexService.dispose();
}
