import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { createOdooScaffold } from '../modules/scaffold';
import { OdooModuleUtils } from '../utils/odooModuleUtils';
import modelIndexService from '../services/modelIndexService';
import { accessCsvSpec } from '../utils/accessCsv';
import { getOdooVersion } from '../services/versionService';
import fieldIndexService, { FieldInfo } from '../services/fieldIndexService';
import { OdooPythonUtils } from '../utils/odooPythonUtils';
import { OdooCsvParser } from '../utils/csvUtils';
import { helperUtils } from '../utils/utils';
import { getPythonParserService } from '../services/pythonParserService';


// eslint-disable-next-line @typescript-eslint/no-var-requires
const templates = require('./templates');
import { handleCreateViews } from './viewGeneration';
import { handleCreateReport } from './reportGeneration';
import { installModule } from '../server_access/install_module';
import { handleShowDependencyGraph } from './dependencyGraph';
import { handleShowModelInheritanceGraph } from './modelInheritanceGraph';


function capitalize(text: string): string {
    return text
        .split('_')
        .map(word => word.charAt(0).toUpperCase() + word.slice(1))
        .join('');
}

export async function handleCreateModule(uri: vscode.Uri, type: string): Promise<void> {
    if (!uri || !uri.fsPath) {
        vscode.window.showErrorMessage(
            `Right‑click a folder and choose "Create ${type} Module".`
        );
        return;
    }

    const moduleName = await vscode.window.showInputBox({
        prompt: `New Odoo module name (${type})`,
        validateInput: v =>
            /^[a-z_]+$/.test(v) ? null : 'Only small letters and underscores allowed'
    });
    if (!moduleName) return;

    const targetUri = vscode.Uri.joinPath(uri, moduleName);
    try {
        await vscode.workspace.fs.stat(targetUri);
        vscode.window.showErrorMessage(`Module "${moduleName}" already exists.`);
        return;
    } catch { }

    try {
        await vscode.window.withProgress({
            location: vscode.ProgressLocation.Notification,
            title: `Creating ${type} Odoo module "${moduleName}"…`,
            cancellable: false
        }, async () => {
            await vscode.workspace.fs.createDirectory(targetUri);
            await createOdooScaffold(targetUri, moduleName, type);
        });
        await vscode.commands.executeCommand('workbench.files.action.refreshFilesExplorer');
        const manifestUri = vscode.Uri.joinPath(targetUri, '__manifest__.py');
        await vscode.window.showTextDocument(manifestUri);
        vscode.window.showInformationMessage(`${type} Odoo module "${moduleName}" created successfully!`);
    } catch (err: any) {
        vscode.window.showErrorMessage(`Failed to create module: ${err.message} `);
    }
}

export async function handleCreateOdooModelFile(uri: vscode.Uri): Promise<void> {
    try {
        const moduleRoot = await OdooModuleUtils.getModuleRoot(uri);

        const fileType = await vscode.window.showQuickPick(
            ['__init__', '__manifest__', 'Odoo Model', 'Odoo Controller'],
            {
                placeHolder: 'Select the type of Odoo file to create',
                ignoreFocusOut: true
            }
        );

        if (!fileType) {
            vscode.window.showWarningMessage('You must select a file type.');
            return;
        }

        let fileName = '';
        let fullFileName = '';
        let fileContent = '';
        const folderPath = uri.fsPath;

        if (fileType === '__init__') {
            fullFileName = '__init__.py';
            fileContent = `# -*- coding: utf-8 -*-\n\nfrom . import `;
        } else if (fileType === '__manifest__') {
            fullFileName = '__manifest__.py';
            const access = accessCsvSpec(await getOdooVersion());
            fileContent = `# -*- coding: utf-8 -*-\n{\n    'name': 'Module Name',\n    'version': '1.0',\n    'category': 'Uncategorized',\n    'summary': 'Module Summary',\n    'description': '''Module Description''',\n    'author': 'Your Company',\n    'website': 'https://www.yourcompany.com',\n    'depends': ['base'],\n    'data': [\n        'security/${access.fileName}',\n        'views/views.xml',\n    ],\n    'license': 'LGPL-3',\n    'installable': True,\n    'application': False,\n    'auto_install': False,\n}`;
        } else {
            if (!moduleRoot || uri.path === moduleRoot.path) {
                vscode.window.showErrorMessage(`${fileType} Creation is not allowed in module root directory or outside of module directory.`);
                return;
            }

            const input = await vscode.window.showInputBox({
                placeHolder: 'Enter the name of the file (without extension)',
                prompt: 'Example: sale_order, project_task (no dots or spaces)',
                validateInput: (value) => {
                    if (!/^[a-z_]+$/.test(value)) {
                        return 'Only lowercase letters and underscores allowed';
                    }
                    return null;
                },
                ignoreFocusOut: true
            });

            if (!input) {
                vscode.window.showWarningMessage('File name is required.');
                return;
            }
            fileName = input;
            fullFileName = `${fileName}.py`;

            if (fileType === 'Odoo Model') {
                const modelName = fileName.replace(/_/g, '.');
                fileContent = `# -*- coding: utf-8 -*-\nfrom odoo import fields, models\n\n\nclass ${capitalize(fileName)}(models.Model):\n    _name = '${modelName}'\n\n    name = fields.Char(string='Name')\n`;
            } else if (fileType === 'Odoo Controller') {
                fileContent = `# -*- coding: utf-8 -*-\nfrom odoo import http\nfrom odoo.http import request\n\n\nclass MainController(http.Controller):\n    @http.route('/my_module/my_module', auth='public')\n    def index(self, **kw):\n        return "Hello, world"\n`;
            }
        }

        const filePath = path.join(folderPath, fullFileName);

        if (fs.existsSync(filePath)) {
            vscode.window.showWarningMessage(`File "${fullFileName}" already exists.`);
            return;
        }

        fs.writeFileSync(filePath, fileContent, 'utf8');
        vscode.window.showInformationMessage(`Created ${fullFileName} successfully.`);

    } catch (error: any) {
        vscode.window.showErrorMessage('Error creating file: ' + error.message);
    }
}

export async function handleCreateOdooViewFile(uri: vscode.Uri, preSelectedType?: string, reportType = 'qweb-pdf'): Promise<void> {
    const moduleRoot = await OdooModuleUtils.getModuleRoot(uri);
    if (!moduleRoot || uri.path === moduleRoot.path) {
        vscode.window.showErrorMessage('View Creation is not allowed in module root directory or outside of module directory.');
        return;
    }
    try {
        let fileType = preSelectedType;
        if (!fileType) {
            fileType = await vscode.window.showQuickPick(
                ['Empty View', 'Basic View', 'Advanced View', 'Inherit View', 'Report View',
                    'Security Group View', 'Security Rule View', 'Sequence View', 'Settings View', 'Cron Job View'],
                {
                    placeHolder: 'Select the type of Odoo file to create',
                    ignoreFocusOut: true
                }
            );
        }

        if (!fileType) {
            vscode.window.showWarningMessage('You must select a file type.');
            return;
        }

        const fileName = await vscode.window.showInputBox({
            placeHolder: 'Enter the name of the file (without extension)',
            prompt: 'Example: sale_order_views, project_task_views (no dots or spaces)',
            validateInput: (value) => {
                if (!/^[a-z_]+$/.test(value)) {
                    return 'Only lowercase letters and underscores allowed';
                }
                return null;
            },
            ignoreFocusOut: true
        });

        if (!fileName) {
            vscode.window.showWarningMessage('File name is required.');
            return;
        }

        const fullFileName = fileName.endsWith('.xml') ? fileName : `${fileName}.xml`;
        const folderPath = uri.fsPath;
        const filePath = path.join(folderPath, fullFileName);

        if (fs.existsSync(filePath)) {
            vscode.window.showWarningMessage(`File "${fullFileName}" already exists.`);
            return;
        }

        let fileContent = '';
        // "sale_order_views" -> model sale.order: the indexed model whose name matches, else dots for underscores.
        const pureName = fileName.replace(/\.xml$/, '').replace(/_(views?|templates?|data|reports?|security|menus?)$/, '');
        const modelDotName = modelIndexService.getAllModelNames().find(m => m.replace(/\./g, '_') === pureName)
            ?? pureName.replace(/_/g, '.');
        const modelTitle = pureName
            .replace(/_/g, ' ')
            .replace(/\b\w/g, c => c.toUpperCase());
        const moduleName = path.basename(moduleRoot.fsPath);

        switch (fileType) {
            case 'Empty View':
                fileContent = `<?xml version="1.0" encoding="utf-8"?>
<odoo>
    <!-- Your records, views and menus here -->
</odoo>
`;
                break;

            case 'Basic View':
                fileContent = await templates.getBasicViewTemplate(pureName, modelDotName, modelTitle);
                break;

            case 'Advanced View':
                fileContent = await templates.getAdvancedViewTemplate(pureName, modelDotName, modelTitle);
                break;

            case 'Inherit View':
                fileContent = await templates.getInheritViewTemplate(pureName, modelDotName);
                break;

            case 'Report View':
                fileContent = await templates.getReportViewTemplate(pureName, modelDotName, modelTitle, reportType, moduleName);
                break;

            case 'Security Group View':
                fileContent = await templates.getSecurityGroupViewTemplate(pureName, modelTitle);
                break;

            case 'Security Rule View':
                fileContent = await templates.getSecurityRuleViewTemplate(pureName, modelDotName);
                break;

            case 'Sequence View':
                fileContent = await templates.getSequenceViewTemplate(pureName, modelDotName, modelTitle);
                break;

            case 'Settings View':
                fileContent = await templates.getSettingsViewTemplate(pureName, modelDotName, modelTitle);
                break;

            case 'Cron Job View':
                fileContent = await templates.getCronViewTemplate(pureName, modelDotName, modelTitle);
                break;
        }

        fs.writeFileSync(filePath, fileContent, 'utf8');
        await vscode.window.showTextDocument(vscode.Uri.file(filePath));
        vscode.window.showInformationMessage(`Created ${fullFileName} successfully.`);

    } catch (error: any) {
        vscode.window.showErrorMessage('Error creating file: ' + error.message);
    }
}

export async function handleCreateOdooAccessFile(uri: vscode.Uri): Promise<void> {
    const moduleRoot = await OdooModuleUtils.getModuleRoot(uri);
    if (!moduleRoot) {
        vscode.window.showWarningMessage('Security file creation is only allowed inside a valid Odoo module.');
        return;
    }
    const securityDir = path.join(moduleRoot.fsPath, 'security');
    if (securityDir !== uri.fsPath) {
        vscode.window.showWarningMessage('Security file creation is only allowed in the security directory inside a valid Odoo module.');
        return;
    }

    try {
        const modelName = await vscode.window.showInputBox({
            placeHolder: 'Enter the model name (e.g., sale.order)',
            prompt: 'Enter the technical name of your model',
            ignoreFocusOut: true
        });

        if (!modelName) {
            vscode.window.showWarningMessage('Model name is required.');
            return;
        }

        if (!fs.existsSync(securityDir)) {
            fs.mkdirSync(securityDir, { recursive: true });
        }

        const access = accessCsvSpec(await getOdooVersion());
        const fileName = access.fileName;
        const filePath = path.join(securityDir, fileName);

        let fileContent = '';
        if (fs.existsSync(filePath)) {
            fileContent = fs.readFileSync(filePath, 'utf8');
            if (!fileContent.endsWith('\n')) {
                fileContent += '\n';
            }
        } else {
            fileContent = access.header.join(',') + '\n';
        }
        fileContent += access.row(modelName).join(',') + '\n';

        fs.writeFileSync(filePath, fileContent, 'utf8');
        await vscode.window.showTextDocument(vscode.Uri.file(filePath));
        vscode.window.showInformationMessage(`Created/Updated ${fileName} successfully.`);

    } catch (error: any) {
        vscode.window.showErrorMessage('Error creating access file: ' + error.message);
    }
}

export async function handleAddToInit(uri: vscode.Uri): Promise<void> {
    const activeEditor = vscode.window.activeTextEditor;
    const targetUri = uri || (activeEditor ? activeEditor.document.uri : null);
    if (!targetUri || !targetUri.fsPath) return;

    try {
        const stats = fs.statSync(targetUri.fsPath);
        const isDirectory = stats.isDirectory();

        let targetName: string;
        let parentDir: string;

        if (isDirectory) {
            targetName = path.basename(targetUri.fsPath);
            parentDir = path.dirname(targetUri.fsPath);
        } else {
            if (!targetUri.fsPath.endsWith('.py')) {
                vscode.window.showWarningMessage('Add to Init only works for Python files and directories.');
                return;
            }
            targetName = path.basename(targetUri.fsPath, '.py');
            if (targetName === '__init__' || targetName === '__manifest__') return;
            parentDir = path.dirname(targetUri.fsPath);
        }

        const initPath = path.join(parentDir, '__init__.py');
        let content = '';
        const exists = fs.existsSync(initPath);

        if (exists) {
            content = fs.readFileSync(initPath, 'utf8');
        } else {
            content = '# -*- coding: utf-8 -*-\n';
        }

        const importLine = `from . import ${targetName}`;
        const importRegex = new RegExp(`^\\s*from\\s+\\.\\s+import\\s+${targetName}\\b`, 'm');

        if (!importRegex.test(content)) {
            if (content && !content.endsWith('\n')) content += '\n';
            content += `${importLine}\n`;
            fs.writeFileSync(initPath, content, 'utf8');
            vscode.window.showInformationMessage(`${exists ? 'Added' : 'Created __init__.py and added'} "${targetName}" to __init__.py`);
        } else {
            if (!exists) {
                fs.writeFileSync(initPath, content, 'utf8');
            }
            vscode.window.showInformationMessage(`"${targetName}" is already imported in __init__.py`);
        }

    } catch (error: any) {
        vscode.window.showErrorMessage('Error adding to init: ' + error.message);
    }
}

export async function handleCreateOwlComponentCreation(uri: vscode.Uri, type: string): Promise<void> {
    const moduleRoot = await OdooModuleUtils.getModuleRoot(uri);
    if (!moduleRoot) {
        vscode.window.showWarningMessage('Owl component creation is only allowed in a valid Odoo module.');
        return;
    }

    const componentName = await vscode.window.showInputBox({
        prompt: 'Enter the Owl component name (e.g. ActionButton)',
        placeHolder: 'MyCustomButton',
    });

    if (!componentName) {
        vscode.window.showWarningMessage('Component name is required.');
        return;
    }

    try {
        const moduleName = path.basename(moduleRoot.fsPath);
        const componentInstance = await templates.getOwlComponentTemplate(componentName, moduleName, type);

        if (componentInstance && componentInstance.getCompleteDirectoryStructure) {
            const structure = componentInstance.getCompleteDirectoryStructure();
            const result = await helperUtils.createRecursiveDirectory(moduleRoot, structure);

            if (result.success) {
                vscode.window.showInformationMessage(`Owl Component "${componentName}" created successfully.`);
                await vscode.commands.executeCommand('workbench.files.action.refreshFilesExplorer');
            } else {
                vscode.window.showErrorMessage(`Failed to create component: ${result.message.join(', ')}`);
            }
        } else {
            vscode.window.showErrorMessage('Could not load Owl component template structure.');
        }
    } catch (error: any) {
        vscode.window.showErrorMessage(`Error creating Owl component: ${error.message}`);
    }
}

export async function handleCreatePosComponentCreation(uri: vscode.Uri, type: string): Promise<void> {
    const moduleRoot = await OdooModuleUtils.getModuleRoot(uri);
    if (!moduleRoot) {
        vscode.window.showWarningMessage('POS component creation is only allowed in a valid Odoo module.');
        return;
    }

    try {
        const moduleName = path.basename(moduleRoot.fsPath);
        const componentInstance = await templates.getPosComponentTemplate(moduleName, type);

        if (componentInstance && componentInstance.getCompleteDirectoryStructure) {
            const structure = componentInstance.getCompleteDirectoryStructure();
            const result = await helperUtils.createRecursiveDirectory(moduleRoot, structure);
            // console.log(result);

            if (result.success) {
                vscode.window.showInformationMessage(`POS Component created successfully. \n ${result.message.join('\n')}`);
                await vscode.commands.executeCommand('workbench.files.action.refreshFilesExplorer');
            } else {
                vscode.window.showErrorMessage(`Failed to create POS component: ${result.message.join(', ')}`);
            }
        } else {
            vscode.window.showErrorMessage('Could not load POS component template structure.');
        }
    } catch (error: any) {
        vscode.window.showErrorMessage(`Error creating POS component: ${error.message}`);
    }
}

async function handleOdooToolClick(uri: vscode.Uri, toolName: string): Promise<void> {
    const editor = vscode.window.activeTextEditor;
    if (!editor) return;

    const context = await OdooPythonUtils.getModelAtContext(uri || editor.document.uri, editor.selection.active);

    if (context.valid) {
        const inheritMsg = context.isInherited ? '(Inherited)' : '(New Model)';
        vscode.window.showInformationMessage(
            `hi! Tool: ${toolName} | Model: ${context.modelName} ${inheritMsg} | Module: ${context.moduleName}`
        );
    } else {
        vscode.window.showWarningMessage(`Tool "${toolName}" can only be used inside an Odoo Model class.`);
    }
}

export async function handleCreateAccessRight(uri: vscode.Uri): Promise<void> {
    const editor = vscode.window.activeTextEditor;
    if (!editor) return;

    const context = await OdooPythonUtils.getModelAtContext(uri || editor.document.uri, editor.selection.active);
    if (!context.valid) {
        vscode.window.showWarningMessage('Create Access Right can only be used inside an Odoo Model class.');
        return;
    }

    const moduleRoot = await OdooModuleUtils.getModuleRoot(uri || editor.document.uri);
    if (!moduleRoot) {
        vscode.window.showWarningMessage('Create Access Right needs the model to be inside an Odoo module (a folder with __manifest__.py and __init__.py).');
        return;
    }

    const securityDir = path.join(moduleRoot.fsPath, 'security');
    const access = accessCsvSpec(await getOdooVersion());
    const csvPath = path.join(securityDir, access.fileName);

    if (!fs.existsSync(securityDir)) {
        fs.mkdirSync(securityDir, { recursive: true });
    }

    const csvParser = fs.existsSync(csvPath) ? new OdooCsvParser(fs.readFileSync(csvPath, 'utf8')) : new OdooCsvParser();
    const matrix = csvParser.getMatrix();
    const hasCorrectHeaders = matrix.length > 0 && matrix[0].join(',') === access.header.join(',');

    let headersAdded = false;
    if (!hasCorrectHeaders) {
        // Prepend headers if they are missing or incorrect
        csvParser.setMatrix([access.header, ...matrix]);
        headersAdded = true;
    }

    // Check if model already exists in CSV (check in the updated matrix)
    if (csvParser.getMatrix().slice(1).some(row => access.hasModel(row, context.modelName))) {
        if (headersAdded) {
            fs.writeFileSync(csvPath, csvParser.convertMatrixToText(), 'utf8');
        }
        vscode.window.showInformationMessage(`Access rights already exist for model ${context.modelName}`);
        return;
    }

    csvParser.addRow(access.row(context.modelName));
    fs.writeFileSync(csvPath, csvParser.convertMatrixToText(), 'utf8');

    // Automatically add to manifest if it's not there
    const manifestPath = path.join(moduleRoot.fsPath, '__manifest__.py');
    if (fs.existsSync(manifestPath)) {
        const manifestContent = fs.readFileSync(manifestPath, 'utf8');
        const pythonParser = getPythonParserService();
        const manifestParser = pythonParser.getManifestParser();
        if (manifestParser) {
            manifestParser.parseManifest(manifestContent);
            const result = manifestParser.updateManifest({
                type: 'file',
                name: access.fileName,
                content: '',
                updateManifest: true,
                manifestCategory: 'data',
                dataCategory: 'security'
            }, `security/${access.fileName}`);

            if (result.success && result.updatedContent) {
                fs.writeFileSync(manifestPath, result.updatedContent, 'utf8');
            }
        }
    }

    vscode.window.showInformationMessage(`Access right created for "${context.modelName}" in ${access.fileName}`);

    // Open the CSV file
    const doc = await vscode.workspace.openTextDocument(csvPath);
    await vscode.window.showTextDocument(doc);
}

// Implementations behind the commands registered in `registerCommands.ts`, loaded on first use.
export { handleCreateViews, handleCreateReport, installModule, handleShowDependencyGraph, handleShowModelInheritanceGraph };
