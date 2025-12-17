import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';

export class OdooModuleUtils {
    /**
     * Get the root directory of the Odoo module containing the given URI.
     * @param uri - The URI of a file or directory within the module.
     * @returns The URI of the module root, or null if not found.
     */
    static async getModuleRoot(uri: vscode.Uri): Promise<vscode.Uri | null> {
        let currentFolder = uri.fsPath;
        while (currentFolder) {
            const manifestPath = path.join(currentFolder, '__manifest__.py');
            const initPath = path.join(currentFolder, '__init__.py');
            if (fs.existsSync(manifestPath) || fs.existsSync(initPath)) {
                return vscode.Uri.file(currentFolder);
            }
            const parentFolder = path.dirname(currentFolder);
            if (parentFolder === currentFolder) {
                break;
            }
            currentFolder = parentFolder;
        }
        return null;
    }
}
