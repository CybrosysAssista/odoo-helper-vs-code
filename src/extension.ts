import * as vscode from 'vscode';
import { CssClassIndexer } from './services/cssClassIndexer';
import * as fs from 'fs';
import * as path from 'path';
import { registerModelProviders } from './providers/odooModelProvider';
import { registerFieldProviders } from './providers/odooCompletionProvider';
import { registerCommands } from './commands/registerCommands';
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
import { byVersion, clearCache, getOdooVersion, OdooVersion } from './services/versionService';
import { getPythonParserService } from './services/pythonParserService';
import { getXmlParserService } from './services/xmlParserService';

import { addCurrentFileToManifest } from './commands/addToManifest';
import { ManifestPathCompletionProvider } from './providers/manifestPathCompletionProvider';
import { CssClassCompletionProvider } from './providers/completion/cssClassCompletionProvider';
import { getOdooRegistryIndexer } from './services/odooRegistryIndexer';
import { initIndexer } from './indexer/indexer';
import { setIndexTrigger } from './indexer/trigger';
import { persistenceService } from './services/persistenceService';
import { OdooPythonUtils } from './utils/odooPythonUtils';
import { ConfigViewProvider } from './providers/configViewProvider';

export async function activate(context: vscode.ExtensionContext): Promise<void> {
    // Initialize Persistence Service
    persistenceService.init(context);

    // Editor features, commands and status items are registered first and answer from the indexes.
    // The indexes load and refresh in a background process, starting once the window has settled
    // (or when a feature first needs them), so opening the editor never competes with indexing.
    initIndexer(context);
    let indexingStarted = false;
    const startIndexingOnce = () => {
        if (!indexingStarted) {
            indexingStarted = true;
            clearTimeout(startTimer);
            void startIndexing(context);
        }
    };
    const startTimer = setTimeout(startIndexingOnce, INDEXING_DELAY_MS);
    context.subscriptions.push({ dispose: () => clearTimeout(startTimer) });
    setIndexTrigger(startIndexingOnce);

    // The in-editor parser (cursor context, completions) is separate from indexing and loads now.
    getPythonParserService().init(context).catch(error => {
        console.error('[Extension] Failed to initialize Python parser:', error);
        vscode.window.showWarningMessage('Tree-sitter parser failed to initialize. Some features may be limited.');
    });

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
                { label: 'Odoo 20', value: '20' },
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

    // Only Python and XML files are linted, and edits are linted once typing pauses.
    const lintTimers = new Map<string, NodeJS.Timeout>();
    const lint = (doc: vscode.TextDocument, delayMs = 0) => {
        if (doc.uri.scheme !== 'file' || (doc.languageId !== 'python' && doc.languageId !== 'xml')) return;
        const key = doc.uri.toString();
        clearTimeout(lintTimers.get(key));
        lintTimers.set(key, setTimeout(() => {
            lintTimers.delete(key);
            if (!doc.isClosed) runOdooLint(doc, diagnosticCollection);
        }, delayMs));
    };
    context.subscriptions.push({ dispose: () => lintTimers.forEach(timer => clearTimeout(timer)) });

    vscode.workspace.textDocuments.forEach(doc => lint(doc));

    vscode.workspace.onDidOpenTextDocument(
        doc => lint(doc),
        null,
        context.subscriptions
    );

    vscode.workspace.onDidChangeTextDocument(
        e => lint(e.document, 400),
        null,
        context.subscriptions
    );

    vscode.workspace.onDidSaveTextDocument(
        doc => lint(doc),
        null,
        context.subscriptions
    );

    vscode.workspace.onDidCloseTextDocument(
        doc => diagnosticCollection.delete(doc.uri),
        null,
        context.subscriptions
    );

    // Re-run linting when relevant config changes
    vscode.workspace.onDidChangeConfiguration(
        e => {
            if (e.affectsConfiguration('cybrosys-assista-odoo-helper.enableCodeStandardWarnings')) {
                vscode.workspace.textDocuments.forEach(doc => lint(doc));
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

    // Context Key Management for Odoo Model Tools. Recomputed once the cursor settles, and the
    // context key is only set when its value actually changes.
    let isOdooModel: boolean | undefined;
    let modelContextTimer: NodeJS.Timeout | undefined;
    const setIsOdooModel = (value: boolean) => {
        if (value !== isOdooModel) {
            isOdooModel = value;
            vscode.commands.executeCommand('setContext', 'cybrosys-assista-odoo-helper.isOdooModel', value);
        }
    };
    const updateOdooModelContext = async () => {
        const editor = vscode.window.activeTextEditor;
        if (editor && editor.document.languageId === 'python' && editor.document.uri.scheme === 'file') {
            const modelContext = await OdooPythonUtils.getModelAtContext(editor.document.uri, editor.selection.active);
            setIsOdooModel(modelContext.valid);
        } else {
            setIsOdooModel(false);
        }
    };
    const scheduleOdooModelContext = () => {
        clearTimeout(modelContextTimer);
        modelContextTimer = setTimeout(updateOdooModelContext, 250);
    };
    context.subscriptions.push({ dispose: () => clearTimeout(modelContextTimer) });

    vscode.window.onDidChangeActiveTextEditor(scheduleOdooModelContext, null, context.subscriptions);
    vscode.window.onDidChangeTextEditorSelection(scheduleOdooModelContext, null, context.subscriptions);
    scheduleOdooModelContext();

    // Register Configurations View
    const configProvider = new ConfigViewProvider(context.extensionUri);
    context.subscriptions.push(
        vscode.window.registerWebviewViewProvider(ConfigViewProvider.viewType, configProvider)
    );
}

/** How long after activation indexing starts, unless a feature needs an index sooner. */
const INDEXING_DELAY_MS = 3000;

const INDEX_IDS = ['moduleIndex', 'modelIndex', 'fieldIndex', 'functionIndex', 'templateIndex', 'registryIndex', 'cssIndex'] as const;
type IndexId = typeof INDEX_IDS[number];

interface PersistedIndex {
    isDirty(): boolean;
    getState(): unknown;
    loadState(state: unknown): void;
}

function indexes(): Record<IndexId, PersistedIndex> {
    return {
        moduleIndex: moduleIndexService,
        modelIndex: modelIndexService,
        fieldIndex: fieldIndexService,
        functionIndex: functionIndexService,
        templateIndex: templateIndexService,
        registryIndex: getOdooRegistryIndexer(),
        cssIndex: CssClassIndexer.getInstance(),
    };
}

/** Writes the indexes that changed since they were last saved or loaded. */
async function saveChangedIndexes(ids: readonly IndexId[]): Promise<void> {
    const all = indexes();
    for (const id of ids) {
        if (all[id].isDirty()) {
            await persistenceService.save(id, all[id].getState());
        }
    }
}

/**
 * Loads the saved indexes, starts watching for changes and brings the indexes up to date. Only
 * files that changed since the last session are parsed again.
 */
async function startIndexing(context: vscode.ExtensionContext): Promise<void> {
    const states = await Promise.all(INDEX_IDS.map(id => persistenceService.load<unknown>(id)));

    // The module index goes first: the model index restores each model's module dependencies from it.
    const all = indexes();
    for (const [i, id] of INDEX_IDS.entries()) {
        if (states[i]) {
            all[id].loadState(states[i]);
            await new Promise<void>(resolve => setImmediate(resolve));
        }
    }

    // Loaded now, while idle, rather than on the first XML keystroke.
    getXmlParserService();

    // Keep the indexes current. Started after loading, so the loaded state can't overwrite updates.
    fieldIndexService.initialize();
    functionIndexService.initialize();
    modelIndexService.initialize();
    moduleIndexService.initialize();
    templateIndexService.initialize();
    context.subscriptions.push(
        modelIndexService,
        moduleIndexService,
        templateIndexService,
        getOdooRegistryIndexer().initialize(),
        CssClassIndexer.getInstance().initialize(),
    );

    // Silent: indexing runs in a low-priority background process, so it shows no status-bar progress.
    {
        const config = vscode.workspace.getConfiguration('cybrosys-assista-odoo-helper');
        const enableCore = config.get<boolean>('indexing.enableCoreIndexing', true);
        const enableRegistry = config.get<boolean>('indexing.enableRegistryIndexing', true);

        try {
            await moduleIndexService.reindex();
            if (!moduleIndexService.hasModules()) {
                return; // Not an Odoo workspace: nothing else to index.
            }

            // Cheap stages first (seconds of background CPU at most), then models, which take longest
            // on a first open. Each stage is saved as soon as it is done, so a window closed mid-way
            // doesn't lose the work.
            await templateIndexService.buildCache();
            await saveChangedIndexes(['moduleIndex', 'templateIndex']);

            await CssClassIndexer.getInstance().indexWorkspace();
            await saveChangedIndexes(['cssIndex']);

            if (enableCore) {
                await modelIndexService.buildCache();
            }
            await saveChangedIndexes(['modelIndex', 'fieldIndex', 'functionIndex']);

            if (enableRegistry) {
                await getOdooRegistryIndexer().scanWorkspace();
                await saveChangedIndexes(['registryIndex']);
            }
        } catch (e) {
            console.error('[Extension] Indexing failed:', e);
        }
    }
}

/** Parsed snippet files, by path. They ship with the extension and never change while it runs. */
const snippetCache = new Map<string, { label: string; name: string; body: string; description?: string }[]>();

function loadSnippets(snippetPath: string) {
    let snippets = snippetCache.get(snippetPath);
    if (!snippets) {
        snippets = [];
        try {
            const raw = JSON.parse(fs.readFileSync(snippetPath, 'utf8'));
            for (const [name, def] of Object.entries(raw) as [string, any][]) {
                snippets.push({
                    label: def.prefix || name,
                    name,
                    body: Array.isArray(def.body) ? def.body.join('\n') : String(def.body || ''),
                    description: def.description
                });
            }
        } catch {
            // Missing or unreadable snippet file: no snippets.
        }
        snippetCache.set(snippetPath, snippets);
    }
    return snippets;
}

async function registerVersionedSnippets(context: vscode.ExtensionContext): Promise<void> {
    const extensionPath = context.extensionPath;

    // Snippets for the detected Odoo version, read once per file.
    const provider = (files: Record<OdooVersion, string>) => ({
        async provideCompletionItems() {
            const version = await getOdooVersion();
            const snippets = loadSnippets(path.join(extensionPath, byVersion(version, files)));
            return snippets.map(snippet => {
                const item = new vscode.CompletionItem(snippet.label, vscode.CompletionItemKind.Snippet);
                item.insertText = new vscode.SnippetString(snippet.body);
                item.detail = snippet.name;
                if (snippet.description) item.documentation = snippet.description;
                return item;
            });
        }
    });

    context.subscriptions.push(
        vscode.languages.registerCompletionItemProvider(
            { scheme: 'file', language: 'xml' },
            provider({ 18: 'snippets/xml18.json', 19: 'snippets/xml19.json', 20: 'snippets/xml20.json' })
        ),
        vscode.languages.registerCompletionItemProvider(
            { scheme: 'file', language: 'python' },
            provider({ 18: 'snippets/python18.json', 19: 'snippets/python19.json', 20: 'snippets/python20.json' })
        )
    );
}

export function deactivate(): void { }
