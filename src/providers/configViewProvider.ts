import * as vscode from 'vscode';
import { persistenceService } from '../services/persistenceService';

export class ConfigViewProvider implements vscode.WebviewViewProvider {
    public static readonly viewType = 'cybrosys-assista-odoo-helper.configView';
    private _view?: vscode.WebviewView;

    constructor(private readonly _extensionUri: vscode.Uri) { }

    public resolveWebviewView(
        webviewView: vscode.WebviewView,
        context: vscode.WebviewViewResolveContext,
        _token: vscode.CancellationToken,
    ) {
        this._view = webviewView;

        webviewView.webview.options = {
            enableScripts: true,
            localResourceRoots: [this._extensionUri]
        };

        webviewView.webview.html = this._getHtmlForWebview(webviewView.webview);

        webviewView.webview.onDidReceiveMessage(async (data) => {
            switch (data.type) {
                case 'saveConfig':
                    await persistenceService.save('odoo_server_config', data.value);
                    vscode.window.showInformationMessage('Odoo Configuration Saved');
                    vscode.commands.executeCommand('cybrosys-assista-odoo-helper.refreshStatusBar');
                    break;
                case 'getConfig':
                    const config = await persistenceService.load('odoo_server_config');
                    if (config) {
                        this._view?.webview.postMessage({ type: 'setConfig', value: config });
                    }
                    break;
            }
        });

        // Request config on load
        this._view.webview.postMessage({ type: 'requestConfig' });
    }

    public async refresh() {
        if (this._view) {
            const config = await persistenceService.load('odoo_server_config');
            this._view.webview.postMessage({ type: 'setConfig', value: config || {} });
        }
    }

    private _getHtmlForWebview(webview: vscode.Webview) {
        return `<!DOCTYPE html>
            <html lang="en">
            <head>
                <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <title>Odoo Configurations</title>
                <style>
                    body {
                        padding: 10px;
                        color: var(--vscode-foreground);
                        font-family: var(--vscode-font-family);
                    }
                    .form-group {
                        margin-bottom: 15px;
                    }
                    label {
                        display: block;
                        margin-bottom: 5px;
                        font-weight: bold;
                    }
                    input {
                        width: 100%;
                        padding: 8px;
                        box-sizing: border-box;
                        background: var(--vscode-input-background);
                        color: var(--vscode-input-foreground);
                        border: 1px solid var(--vscode-input-border);
                        border-radius: 4px;
                    }
                    button {
                        width: 100%;
                        padding: 10px;
                        background: var(--vscode-button-background);
                        color: var(--vscode-button-foreground);
                        border: none;
                        border-radius: 4px;
                        cursor: pointer;
                        font-weight: bold;
                    }
                    button:hover {
                        background: var(--vscode-button-hoverBackground);
                    }
                </style>
            </head>
            <body>
                <div class="form-group">
                    <label for="url">Odoo URL</label>
                    <input type="text" id="id-url" placeholder="http://localhost:8069">
                </div>
                <div class="form-group">
                    <label for="db">Database</label>
                    <input type="text" id="id-db" placeholder="my_database">
                </div>
                <div class="form-group">
                    <label for="email">Email</label>
                    <input type="email" id="id-email" placeholder="admin@example.com">
                </div>
                <div class="form-group">
                    <label for="password">Password</label>
                    <input type="password" id="id-password" placeholder="••••••••">
                </div>
                <button id="saveBtn">Save Configuration</button>

                <script>
                    const vscode = acquireVsCodeApi();
                    const urlInput = document.getElementById('id-url');
                    const dbInput = document.getElementById('id-db');
                    const emailInput = document.getElementById('id-email');
                    const passwordInput = document.getElementById('id-password');
                    const saveBtn = document.getElementById('saveBtn');

                    window.addEventListener('message', event => {
                        const message = event.data;
                        switch (message.type) {
                            case 'setConfig':
                                urlInput.value = message.value.url || '';
                                dbInput.value = message.value.db || '';
                                emailInput.value = message.value.email || '';
                                passwordInput.value = message.value.password || '';
                                break;
                            case 'requestConfig':
                                vscode.postMessage({ type: 'getConfig' });
                                break;
                        }
                    });

                    saveBtn.addEventListener('click', () => {
                        vscode.postMessage({
                            type: 'saveConfig',
                            value: {
                                url: urlInput.value,
                                db: dbInput.value,
                                email: emailInput.value,
                                password: passwordInput.value
                            }
                        });
                    });

                    // Initial request
                    vscode.postMessage({ type: 'getConfig' });
                </script>
            </body>
            </html>`;
    }
}
