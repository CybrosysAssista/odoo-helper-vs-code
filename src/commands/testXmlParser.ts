import * as vscode from 'vscode';
import { getXmlParserService } from '../services/xmlParserService';

export async function testXmlParser() {
    const editor = vscode.window.activeTextEditor;
    if (!editor) {
        vscode.window.showErrorMessage('Open an XML file first');
        return;
    }

    const doc = editor.document;
    if (doc.languageId !== 'xml') {
        vscode.window.showErrorMessage('Current file is not XML');
        return;
    }

    const xmlParser = getXmlParserService();
    const text = doc.getText();
    const cursorOffset = doc.offsetAt(editor.selection.active);

    const outputChannel = vscode.window.createOutputChannel('Assista: XML Parser Test');
    outputChannel.show();

    outputChannel.appendLine(`Testing XML Parser at offset ${cursorOffset}...`);

    try {
        // 1. Find node at cursor
        const node = xmlParser.findNodeAtOffset(text, cursorOffset);
        if (node) {
            outputChannel.appendLine(`Node at cursor: ${node.tag}`);
            const attrs = xmlParser.getAttributes(text, node);
            outputChannel.appendLine(`Attributes: ${JSON.stringify(attrs, null, 2)}`);
        } else {
            outputChannel.appendLine('No node found at cursor.');
        }

        // 2. Find all records
        const records = xmlParser.findRecords(text);
        outputChannel.appendLine(`\nFound ${records.length} records:`);
        records.forEach(r => {
            outputChannel.appendLine(`- ID: ${r.id}, Model: ${r.model}`);
        });

        // 3. Find all templates
        const templates = xmlParser.findTemplates(text);
        outputChannel.appendLine(`\nFound ${templates.length} templates:`);
        templates.forEach(t => {
            outputChannel.appendLine(`- ID: ${t.id}`);
        });

    } catch (error) {
        outputChannel.appendLine(`Error: ${error}`);
    }
}
