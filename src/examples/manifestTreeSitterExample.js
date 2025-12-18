const vscode = require('vscode');
const path = require('path');
const { getPythonParserService } = require('../services/pythonParserService');

/**
 * Example: Add a file to the manifest 'data' list using Tree-sitter
 * 
 * This demonstrates how to:
 * 1. Parse the manifest file
 * 2. Check if the file already exists
 * 3. Find the correct insertion point
 * 4. Add the file with proper formatting
 */
async function addFileToManifestData(manifestUri, relativeFilePath) {
    const parser = getPythonParserService();

    if (!parser.isInitialized()) {
        vscode.window.showErrorMessage('Tree-sitter parser not initialized');
        return false;
    }

    try {
        // 1. Open and read the manifest file
        const document = await vscode.workspace.openTextDocument(manifestUri);
        const text = document.getText();
        const lines = text.split('\n');

        // 2. Check if file already exists in 'data' list
        if (parser.manifestListContains(text, 'data', relativeFilePath)) {
            vscode.window.showInformationMessage(`${relativeFilePath} already exists in manifest`);
            return false;
        }

        // 3. Find the insertion position
        const position = parser.findManifestListInsertPosition(text, 'data');

        if (!position) {
            vscode.window.showErrorMessage('Could not find "data" key in manifest');
            return false;
        }

        // 4. Calculate indentation from the existing line
        const currentLine = lines[position.line];
        const indentMatch = currentLine.match(/^(\s*)/);
        const indent = indentMatch ? indentMatch[1] : '        '; // Default to 8 spaces

        // 5. Create the edit
        const edit = new vscode.WorkspaceEdit();
        const insertPos = new vscode.Position(position.line, position.character);

        // Add comma after previous item and new line with the file
        const newContent = `,\n${indent}'${relativeFilePath}'`;

        edit.insert(manifestUri, insertPos, newContent);

        // 6. Apply the edit
        const success = await vscode.workspace.applyEdit(edit);

        if (success) {
            await document.save();
            vscode.window.showInformationMessage(`✅ Added ${relativeFilePath} to manifest`);
            return true;
        } else {
            vscode.window.showErrorMessage('Failed to update manifest');
            return false;
        }

    } catch (error) {
        console.error('Error adding file to manifest:', error);
        vscode.window.showErrorMessage(`Error: ${error.message}`);
        return false;
    }
}

/**
 * Example: Add multiple files to manifest at once
 */
async function addMultipleFilesToManifest(manifestUri, filePaths) {
    const parser = getPythonParserService();

    if (!parser.isInitialized()) {
        vscode.window.showErrorMessage('Tree-sitter parser not initialized');
        return;
    }

    const document = await vscode.workspace.openTextDocument(manifestUri);
    const text = document.getText();

    // Filter out files that already exist
    const newFiles = filePaths.filter(file =>
        !parser.manifestListContains(text, 'data', file)
    );

    if (newFiles.length === 0) {
        vscode.window.showInformationMessage('All files already exist in manifest');
        return;
    }

    // Add each file
    for (const file of newFiles) {
        await addFileToManifestData(manifestUri, file);
    }

    vscode.window.showInformationMessage(`✅ Added ${newFiles.length} file(s) to manifest`);
}

/**
 * Command handler: Add current file to manifest
 */
async function handleAddCurrentFileToManifest(uri) {
    try {
        // Get the current file
        const currentFile = uri || vscode.window.activeTextEditor?.document.uri;

        if (!currentFile) {
            vscode.window.showErrorMessage('No file selected');
            return;
        }

        // Find the module root
        const OdooModuleUtils = require('../utils/odooModuleUtils');
        const moduleRoot = await OdooModuleUtils.getModuleRoot(currentFile);

        if (!moduleRoot) {
            vscode.window.showErrorMessage('Not inside an Odoo module');
            return;
        }

        // Calculate relative path from module root
        const relativePath = path.relative(moduleRoot.fsPath, currentFile.fsPath);

        // Find manifest file
        const manifestPath = path.join(moduleRoot.fsPath, '__manifest__.py');
        const manifestUri = vscode.Uri.file(manifestPath);

        // Add to manifest
        await addFileToManifestData(manifestUri, relativePath);

    } catch (error) {
        console.error('Error in handleAddCurrentFileToManifest:', error);
        vscode.window.showErrorMessage(`Error: ${error.message}`);
    }
}

/**
 * Advanced example: Add file to manifest with smart detection
 * Automatically determines if it should go in 'data', 'demo', or 'assets'
 */
async function addFileToManifestSmart(manifestUri, relativeFilePath) {
    const parser = getPythonParserService();

    if (!parser.isInitialized()) {
        return false;
    }

    // Determine which list to add to based on file path
    let targetList = 'data';

    if (relativeFilePath.includes('/demo/')) {
        targetList = 'demo';
    } else if (relativeFilePath.includes('/static/')) {
        // For static files, we might want to add to assets instead
        vscode.window.showInformationMessage(
            'Static files should typically be added to "assets" in manifest. ' +
            'This example adds to "data" - extend this for assets support.'
        );
    }

    const document = await vscode.workspace.openTextDocument(manifestUri);
    const text = document.getText();

    // Check if already exists
    if (parser.manifestListContains(text, targetList, relativeFilePath)) {
        vscode.window.showInformationMessage(`File already in ${targetList} list`);
        return false;
    }

    // Find insertion position
    const position = parser.findManifestListInsertPosition(text, targetList);

    if (!position) {
        vscode.window.showWarningMessage(`No "${targetList}" key found in manifest`);
        return false;
    }

    // Add the file
    const lines = text.split('\n');
    const currentLine = lines[position.line];
    const indent = currentLine.match(/^(\s*)/)?.[1] || '        ';

    const edit = new vscode.WorkspaceEdit();
    const insertPos = new vscode.Position(position.line, position.character);
    edit.insert(manifestUri, insertPos, `,\n${indent}'${relativeFilePath}'`);

    const success = await vscode.workspace.applyEdit(edit);
    if (success) {
        await document.save();
        vscode.window.showInformationMessage(`✅ Added to ${targetList} list`);
    }

    return success;
}

module.exports = {
    addFileToManifestData,
    addMultipleFilesToManifest,
    handleAddCurrentFileToManifest,
    addFileToManifestSmart
};
