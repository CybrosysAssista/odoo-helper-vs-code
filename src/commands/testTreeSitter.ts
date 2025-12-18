import * as vscode from 'vscode';
import { getPythonParserService } from '../services/pythonParserService';

/**
 * Test command to verify Tree-sitter parser functionality
 */
export async function testTreeSitterParser(): Promise<void> {
    const parser = getPythonParserService();

    if (!parser.isInitialized()) {
        vscode.window.showErrorMessage('Tree-sitter parser is not initialized');
        return;
    }

    const editor = vscode.window.activeTextEditor;
    if (!editor) {
        vscode.window.showErrorMessage('No active editor');
        return;
    }

    const document = editor.document;
    if (document.languageId !== 'python') {
        vscode.window.showErrorMessage('Current file is not a Python file');
        return;
    }

    const text = document.getText();

    // Test 1: Find Odoo models
    const models = parser.findOdooModels(text);
    console.log('Found models:', models);

    // Test 2: Find fields
    const fields = parser.findFields(text);
    console.log('Found fields:', fields);

    // Show results
    const modelNames = models.map(m => m.name).join(', ');
    const fieldNames = fields.map(f => `${f.name} (${f.type})`).join(', ');

    vscode.window.showInformationMessage(
        `Tree-sitter Parser Test:\n` +
        `Models: ${modelNames || 'None'}\n` +
        `Fields: ${fieldNames || 'None'}`,
        { modal: true }
    );
}
