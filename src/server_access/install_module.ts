import * as vscode from 'vscode';
import * as fs from 'fs';
import { persistenceService } from '../services/persistenceService';
import { OdooRpc } from '../utils/odooRpc';

/**
 * Handles the installation of an Odoo module.
 * @param uri The URI of the module folder to install.
 */
export async function installModule(uri: vscode.Uri): Promise<void> {
    if (!uri) {
        vscode.window.showErrorMessage('No module folder selected.');
        return;
    }

    try {
        const stat = await vscode.workspace.fs.stat(uri);
        if (stat.type !== vscode.FileType.Directory) {
            vscode.window.showErrorMessage('Installation is only allowed for folders. Please right-click a module directory.');
            return;
        }
    } catch (err) {
        vscode.window.showErrorMessage('Failed to verify selection type.');
        return;
    }

    const initFileUri = vscode.Uri.joinPath(uri, '__init__.py');
    const manifestFileUri = vscode.Uri.joinPath(uri, '__manifest__.py');

    if (!fs.existsSync(initFileUri.fsPath) || !fs.existsSync(manifestFileUri.fsPath)) {
        vscode.window.showErrorMessage('Selected folder is not a valid Odoo module (missing __init__.py or __manifest__.py).');
        return;
    }

    // Logic for module installation
    await vscode.window.withProgress({
        location: vscode.ProgressLocation.Notification,
        title: "Assista: Odoo Module Installation",
        cancellable: false
    }, async (progress) => {
        try {
            const config = await persistenceService.load<any>('odoo_server_config');
            if (!config || !config.url || !config.db || !config.email || !config.password) {
                vscode.window.showErrorMessage('Odoo Server configuration is missing. Please configure it in the "Odoo Configurations" sidebar.');
                return;
            }

            const rpc = new OdooRpc(config);
            progress.report({ message: "Authenticating..." });
            const uid = await rpc.authenticate();

            progress.report({ message: "Updating App List..." });
            await rpc.call(uid, 'ir.module.module', 'update_list', []);

            const moduleName = uri.fsPath.split(/[\\/]/).pop() || '';
            progress.report({ message: `Searching for module "${moduleName}"...` });

            const moduleRecords = await rpc.browseRecord(uid, 'ir.module.module', [['name', '=', moduleName]], ['id', 'name', 'state']);

            if (moduleRecords && moduleRecords.length > 0) {
                const mod = moduleRecords[0];
                if (!mod.id) {
                    vscode.window.showErrorMessage(`Module "${moduleName}" found but its ID is missing. State: ${mod.state}`);
                    return;
                }
                const isInstalled = mod.state === 'installed';
                const actionLabel = isInstalled ? 'Upgrade' : 'Install';
                const method = isInstalled ? 'button_immediate_upgrade' : 'button_immediate_install';

                const confirmInstallation = await vscode.window.showInformationMessage(
                    `Module "${moduleName}" is ${mod.state}. Do you want to ${actionLabel} it?`,
                    'Yes', 'Cancel'
                );

                if (confirmInstallation === 'Yes') {
                    progress.report({ message: `${actionLabel}ing "${moduleName}"...` });
                    await rpc.functionCaller(uid, 'ir.module.module', method, [mod.id]);
                    vscode.window.showInformationMessage(`Module "${moduleName}" ${actionLabel.toLowerCase()}ed successfully!`);
                }
            } else {
                vscode.window.showWarningMessage(`Module "${moduleName}" not found on server. Ensure the folder name matches the technical name and is in the addons path.`);
            }
        } catch (err: any) {
            vscode.window.showErrorMessage(`Odoo Error: ${err.message}`);
        }
    });
}
