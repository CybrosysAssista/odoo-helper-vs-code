import * as vscode from 'vscode';
import { getPythonParserService } from './pythonParserService';

/**
 * Helper service for manipulating Odoo manifest files using Tree-sitter
 */
export class ManifestHelper {
    /**
     * Add a file to the 'data' list in __manifest__.py
     */
    static async addToDataList(manifestUri: vscode.Uri, filePath: string): Promise<boolean> {
        const parser = getPythonParserService();
        if (!parser.isInitialized()) {
            vscode.window.showErrorMessage('Parser not initialized');
            return false;
        }

        const document = await vscode.workspace.openTextDocument(manifestUri);
        const text = document.getText();

        // Check if already exists
        if (parser.manifestListContains(text, 'data', filePath)) {
            vscode.window.showInformationMessage(`${filePath} already exists in manifest`);
            return false;
        }

        // Find insert position
        const position = parser.findManifestListInsertPosition(text, 'data');
        if (!position) {
            vscode.window.showErrorMessage('Could not find "data" key in manifest');
            return false;
        }

        // Create edit
        const edit = new vscode.WorkspaceEdit();
        const insertPos = new vscode.Position(position.line, position.character);
        edit.insert(manifestUri, insertPos, `,\n        '${filePath}'`);

        // Apply edit
        const success = await vscode.workspace.applyEdit(edit);
        if (success) {
            await document.save();
            vscode.window.showInformationMessage(`Added ${filePath} to manifest`);
        }

        return success;
    }

    /**
     * Add a file to assets bundle in __manifest__.py
     * Example: addToAssets(uri, 'web.assets_backend', 'my_module/static/src/js/file.js')
     */
    static async addToAssets(
        manifestUri: vscode.Uri,
        bundleName: string,
        assetCategory: 'assets_frontend' | 'assets_backend' | 'assets_common' | 'pos_assets',
        filePath: string
    ): Promise<boolean> {
        const parser = getPythonParserService();
        if (!parser.isInitialized()) {
            vscode.window.showErrorMessage('Parser not initialized');
            return false;
        }

        const document = await vscode.workspace.openTextDocument(manifestUri);
        const text = document.getText();
        const tree = parser.parse(text);

        if (!tree) {
            vscode.window.showErrorMessage('Failed to parse manifest');
            return false;
        }


        vscode.window.showInformationMessage('Assets manipulation coming soon!');
        return false;
    }

    /**
     * Add a module to the 'depends' list
     */
    static async addDependency(manifestUri: vscode.Uri, moduleName: string): Promise<boolean> {
        const parser = getPythonParserService();
        if (!parser.isInitialized()) {
            vscode.window.showErrorMessage('Parser not initialized');
            return false;
        }

        const document = await vscode.workspace.openTextDocument(manifestUri);
        const text = document.getText();

        // Check if already exists
        if (parser.manifestListContains(text, 'depends', moduleName)) {
            vscode.window.showInformationMessage(`${moduleName} already in dependencies`);
            return false;
        }

        // Find insert position
        const position = parser.findManifestListInsertPosition(text, 'depends');
        if (!position) {
            vscode.window.showErrorMessage('Could not find "depends" key in manifest');
            return false;
        }

        // Create edit
        const edit = new vscode.WorkspaceEdit();
        const insertPos = new vscode.Position(position.line, position.character);
        edit.insert(manifestUri, insertPos, `,\n        '${moduleName}'`);

        // Apply edit
        const success = await vscode.workspace.applyEdit(edit);
        if (success) {
            await document.save();
            vscode.window.showInformationMessage(`Added ${moduleName} to dependencies`);
        }

        return success;
    }
}
