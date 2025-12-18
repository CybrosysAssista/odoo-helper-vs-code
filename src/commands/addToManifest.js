const vscode = require('vscode');
const path = require('path');
const { getPythonParserService } = require('../services/pythonParserService');
const { OdooModuleUtils } = require('../utils/odooModuleUtils');


/**
 * Command: Add current XML/CSV file to manifest data list
 * This uses Tree-sitter to safely add the file
 */
async function addCurrentFileToManifest(uri) {
    const parser = getPythonParserService();

    if (!parser.isInitialized()) {
        vscode.window.showErrorMessage('Tree-sitter parser not ready');
        return;
    }

    try {
        // Get the file to add
        const fileUri = uri || vscode.window.activeTextEditor?.document.uri;

        if (!fileUri) {
            vscode.window.showErrorMessage('No file selected');
            return;
        }

        // Validate file type
        const ext = path.extname(fileUri.fsPath);
        if (!['.xml', '.csv', '.sql'].includes(ext)) {
            vscode.window.showWarningMessage('This command is typically used for XML, CSV, or SQL files');
        }

        // Find module root
        const moduleRoot = await OdooModuleUtils.getModuleRoot(fileUri);

        if (!moduleRoot) {
            vscode.window.showErrorMessage('File is not inside an Odoo module');
            return;
        }

        // Get relative path
        const relativePath = path.relative(moduleRoot.fsPath, fileUri.fsPath);

        // Find manifest
        const manifestPath = path.join(moduleRoot.fsPath, '__manifest__.py');
        const manifestUri = vscode.Uri.file(manifestPath);

        // Read manifest
        const document = await vscode.workspace.openTextDocument(manifestUri);
        const text = document.getText();

        // Check if already exists
        if (parser.manifestListContains(text, 'data', relativePath)) {
            vscode.window.showInformationMessage(`${relativePath} is already in the manifest`);
            return;
        }

        // Find insertion position
        const position = parser.findManifestListInsertPosition(text, 'data');

        if (!position) {
            vscode.window.showErrorMessage('Could not find "data" list in __manifest__.py');
            return;
        }

        // Calculate indentation
        const lines = text.split('\n');
        const currentLine = lines[position.line];
        const indentMatch = currentLine.match(/^(\s*)/);
        const indent = indentMatch ? indentMatch[1] : '        ';

        // Create edit
        const edit = new vscode.WorkspaceEdit();
        const insertPos = new vscode.Position(position.line, position.character);
        const newContent = `,\n${indent}'${relativePath}'`;

        edit.insert(manifestUri, insertPos, newContent);

        // Apply edit
        const success = await vscode.workspace.applyEdit(edit);

        if (success) {
            await document.save();
            vscode.window.showInformationMessage(`✅ Added ${relativePath} to manifest`);
        } else {
            vscode.window.showErrorMessage('Failed to update manifest');
        }

    } catch (error) {
        console.error('[addCurrentFileToManifest] Error:', error);
        vscode.window.showErrorMessage(`Error: ${error.message}`);
    }
}

module.exports = {
    addCurrentFileToManifest
};
