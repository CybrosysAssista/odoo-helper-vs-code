const vscode = require('vscode');
const { registerModelProviders } = require('./src/providers/odooModelProvider');
const { registerFieldProviders } = require('./src/providers/odooCompletionProvider');
const { registerCommands } = require('./src/commands/commandHandlers');
const { runOdooLint } = require('./src/services/odooLinter');
const modelIndexService = require('./src/services/modelIndexService');
const templateIndexService = require('./src/services/templateIndexService');
const OdooXmlCompletionProvider = require('./src/providers/xml/xmlCompletionProvider');
const RelationalFieldCompletionProvider = require('./src/providers/completion/relationalFieldProvider');
const ImportCompletionProvider = require('./src/providers/completion/importCompletionProvider');
const ManifestDependsCompletionProvider = require('./src/providers/completion/manifestDependsCompletionProvider');
const OdooDefinitionProvider = require('./src/providers/odooDefinitionProvider');
const { getOdooVersion, clearCache } = require('./src/services/versionService');
const fs = require('fs');
const path = require('path');

function activate(context) {
    // Initialize index services
    modelIndexService.initialize();
    modelIndexService.buildCache();
    templateIndexService.initialize();

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

    // ✅ Register import completion provider (was missing in second version)
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

    // Register versioned snippet providers for XML and Python
    registerVersionedSnippets(context);

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

async function registerVersionedSnippets(context) {
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
                    const items = [];
                    for (const [name, def] of Object.entries(snippets)) {
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
                    const items = [];
                    for (const [name, def] of Object.entries(snippets)) {
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

function deactivate() {
    modelIndexService.dispose();
}

module.exports = {
    activate,
    deactivate
};
