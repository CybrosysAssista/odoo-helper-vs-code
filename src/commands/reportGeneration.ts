import * as fs from 'fs';
import * as path from 'path';
import * as vscode from 'vscode';
import { create } from 'xmlbuilder2';
import { OdooPythonUtils } from '../utils/odooPythonUtils';
import { FieldInfo } from '../services/fieldIndexService';
import { OdooModuleUtils } from '../utils/odooModuleUtils';
import { getPythonParserService } from '../services/pythonParserService';
import { getOdooVersion } from '../services/versionService';

interface ViewOption extends vscode.QuickPickItem {
    id: 'pdf' | 'html';
}

export async function handleCreateReport(uri: vscode.Uri): Promise<void> {
    const editor = vscode.window.activeTextEditor;
    if (!editor) return;

    const moduleRoot = await OdooModuleUtils.getModuleRoot(editor.document.uri);
    if (!moduleRoot) {
        vscode.window.showWarningMessage('Create Report can only be used inside an Odoo Module.');
        return;
    }

    const context = await OdooPythonUtils.getModelAtContext(uri || editor.document.uri, editor.selection.active);
    if (!context.valid) {
        vscode.window.showWarningMessage('Create Report can only be used inside an Odoo Model class.');
        return;
    }

    const modelTechnicalName = context.modelName;
    const modelName = modelTechnicalName.replace(/\./g, '_');

    const reportOptions: ViewOption[] = [
        {
            label: 'PDF Report',
            detail: `Create Qweb PDF for ${modelName}`,
            id: 'pdf',
        },
        {
            label: 'HTML',
            detail: `Create Qweb HTML for ${modelName}`,
            id: 'html',
        },
    ];

    const reportType = await vscode.window.showQuickPick<ViewOption>(
        reportOptions,
        {
            title: 'Select Report Type',
            placeHolder: 'Choose the report type',
        }
    );

    if (!reportType) return;




}
