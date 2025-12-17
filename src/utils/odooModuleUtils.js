const vscode = require('vscode');
const path = require('path');
const fs = require('fs');
class OdooModuleUtils {
    /**
     * Get the root directory of the Odoo module containing the given URI.
     * @param {vscode.Uri} uri - The URI of a file or directory within the module.
     * @returns {Promise<vscode.Uri|null>} The URI of the module root, or null if not found.
     */
    static async getModuleRoot(uri) {
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

module.exports = OdooModuleUtils;
