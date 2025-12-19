"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.registerCommands = registerCommands;
const vscode = __importStar(require("vscode"));
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const scaffold_1 = require("../modules/scaffold");
const odooModuleUtils_1 = require("../utils/odooModuleUtils");
const utils_1 = require("../utils/utils");
// eslint-disable-next-line @typescript-eslint/no-var-requires
const templates = require('./templates');
function capitalize(text) {
    return text
        .split('_')
        .map(word => word.charAt(0).toUpperCase() + word.slice(1))
        .join('');
}
async function handleCreateModule(uri, type) {
    if (!uri || !uri.fsPath) {
        vscode.window.showErrorMessage(`Right‑click a folder and choose "Create ${type} Module".`);
        return;
    }
    const moduleName = await vscode.window.showInputBox({
        prompt: `New Odoo module name (${type})`,
        validateInput: v => /^[a-z_]+$/.test(v) ? null : 'Only small letters and underscores allowed'
    });
    if (!moduleName)
        return;
    const targetUri = vscode.Uri.joinPath(uri, moduleName);
    try {
        await vscode.workspace.fs.stat(targetUri);
        vscode.window.showErrorMessage(`Module "${moduleName}" already exists.`);
        return;
    }
    catch { }
    try {
        await vscode.window.withProgress({
            location: vscode.ProgressLocation.Notification,
            title: `Creating ${type} Odoo module "${moduleName}"…`,
            cancellable: false
        }, async () => {
            await vscode.workspace.fs.createDirectory(targetUri);
            await (0, scaffold_1.createOdooScaffold)(targetUri, moduleName, type);
        });
        await vscode.commands.executeCommand('workbench.files.action.refreshFilesExplorer');
        const manifestUri = vscode.Uri.joinPath(targetUri, '__manifest__.py');
        await vscode.window.showTextDocument(manifestUri);
        vscode.window.showInformationMessage(`${type} Odoo module "${moduleName}" created successfully!`);
    }
    catch (err) {
        vscode.window.showErrorMessage(`Failed to create module: ${err.message}`);
    }
}
async function handleCreateOdooModelFile(uri) {
    try {
        const moduleRoot = await odooModuleUtils_1.OdooModuleUtils.getModuleRoot(uri);
        const fileType = await vscode.window.showQuickPick(['__init__', '__manifest__', 'Odoo Model', 'Odoo Controller'], {
            placeHolder: 'Select the type of Odoo file to create',
            ignoreFocusOut: true
        });
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
            fileContent = `# -*- coding: utf-8 -*-
from . import `;
        }
        else if (fileType === '__manifest__') {
            fullFileName = '__manifest__.py';
            fileContent = `# -*- coding: utf-8 -*-
{
    'name': 'Module Name',
    'version': '1.0',
    'category': 'Uncategorized',
    'summary': 'Module Summary',
    'description': '''Module Description''',
    'author': 'Your Company',
    'website': 'https://www.yourcompany.com',
    'depends': ['base'],
    'data': [
        'security/ir.model.access.csv',
        'views/views.xml',
    ],
    'installable': True,
    'application': False,
    'auto_install': False,
}`;
        }
        else {
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
                fileContent = `# -*- coding: utf-8 -*-
from odoo import fields,models

class ${capitalize(fileName)}(models.Model):
    _name = '${modelName}'

    name = fields.Char(string='Name')`;
            }
            else if (fileType === 'Odoo Controller') {
                fileContent = `# -*- coding: utf-8 -*-
from odoo import http
from odoo.http import request


class MainController(http.Controller):
    """Controller class to handle HTTP routes."""
    @http.route('/controller', auth='public', website=True)
    def index(self, **kw):
        return request.render('your_module.template_id', {'sample_data': 'Sample Data'})`;
            }
        }
        const filePath = path.join(folderPath, fullFileName);
        if (fs.existsSync(filePath)) {
            vscode.window.showWarningMessage(`File "${fullFileName}" already exists.`);
            return;
        }
        fs.writeFileSync(filePath, fileContent, 'utf8');
        vscode.window.showInformationMessage(`Created ${fullFileName} successfully.`);
    }
    catch (error) {
        vscode.window.showErrorMessage('Error creating file: ' + error.message);
    }
}
async function handleCreateOdooViewFile(uri, preSelectedType, reportType = 'qweb-pdf') {
    const moduleRoot = await odooModuleUtils_1.OdooModuleUtils.getModuleRoot(uri);
    if (!moduleRoot || uri.path === moduleRoot.path) {
        vscode.window.showErrorMessage('View Creation is not allowed in module root directory or outside of module directory.');
        return;
    }
    try {
        let fileType = preSelectedType;
        if (!fileType) {
            fileType = await vscode.window.showQuickPick(['Empty View', 'Basic View', 'Advanced View', 'Inherit View', 'Report View',
                'Security Group View', 'Security Rule View', 'Sequence View', 'Settings View', 'Cron Job View'], {
                placeHolder: 'Select the type of Odoo file to create',
                ignoreFocusOut: true
            });
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
        const pureName = fileName.replace('.xml', '').replace('_views', '_view');
        const modelDotName = pureName.replace(/_/g, '.');
        const modelTitle = pureName
            .replace(/_/g, ' ')
            .replace(/\b\w/g, c => c.toUpperCase());
        switch (fileType) {
            case 'Empty View':
                fileContent = `<?xml version="1.0" encoding="utf-8"?>
<odoo>
    <data>
        <!-- Your custom views here -->
    </data>
</odoo>`;
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
                fileContent = await templates.getReportViewTemplate(pureName, modelDotName, modelTitle, reportType);
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
    }
    catch (error) {
        vscode.window.showErrorMessage('Error creating file: ' + error.message);
    }
}
async function handleCreateOdooAccessFile(uri) {
    const moduleRoot = await odooModuleUtils_1.OdooModuleUtils.getModuleRoot(uri);
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
        const fileName = 'ir.model.access.csv';
        const filePath = path.join(securityDir, fileName);
        let fileContent = '';
        if (fs.existsSync(filePath)) {
            fileContent = fs.readFileSync(filePath, 'utf8');
            if (!fileContent.endsWith('\n')) {
                fileContent += '\n';
            }
        }
        else {
            fileContent = 'id,name,model_id:id,group_id:id,perm_read,perm_write,perm_create,perm_unlink\n';
        }
        const accessId = `access_${modelName.replace('.', '_')}`;
        const newLine = `${accessId},${modelName.replace('.', ' ')} access,model_${modelName.replace('.', '_')},base.group_user,1,1,1,1\n`;
        fileContent += newLine;
        fs.writeFileSync(filePath, fileContent, 'utf8');
        await vscode.window.showTextDocument(vscode.Uri.file(filePath));
        vscode.window.showInformationMessage(`Created/Updated ${fileName} successfully.`);
    }
    catch (error) {
        vscode.window.showErrorMessage('Error creating access file: ' + error.message);
    }
}
async function handleAddToInit(uri) {
    if (!uri || !uri.fsPath)
        return;
    try {
        const stats = fs.statSync(uri.fsPath);
        const isDirectory = stats.isDirectory();
        const dirPath = isDirectory ? uri.fsPath : path.dirname(uri.fsPath);
        const fileName = isDirectory ? null : path.basename(uri.fsPath, '.py');
        const initPath = path.join(dirPath, '__init__.py');
        let content = '';
        if (fs.existsSync(initPath)) {
            content = fs.readFileSync(initPath, 'utf8');
        }
        else {
            content = '# -*- coding: utf-8 -*-\n';
        }
        if (fileName && fileName !== '__init__' && fileName !== '__manifest__') {
            const importLine = `from . import ${fileName}`;
            if (!content.includes(importLine)) {
                if (content && !content.endsWith('\n'))
                    content += '\n';
                content += `${importLine}\n`;
                fs.writeFileSync(initPath, content, 'utf8');
                vscode.window.showInformationMessage(`Added "${fileName}" to __init__.py`);
            }
            else {
                vscode.window.showInformationMessage(`"${fileName}" is already in __init__.py`);
            }
        }
        else if (isDirectory) {
            if (!fs.existsSync(initPath)) {
                fs.writeFileSync(initPath, '# -*- coding: utf-8 -*-\n', 'utf8');
                vscode.window.showInformationMessage(`Created __init__.py in ${path.basename(dirPath)}`);
            }
        }
    }
    catch (error) {
        vscode.window.showErrorMessage('Error adding to init: ' + error.message);
    }
}
async function handleCreateOwlComponentCreation(uri, type) {
    const moduleRoot = await odooModuleUtils_1.OdooModuleUtils.getModuleRoot(uri);
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
            const result = await utils_1.helperUtils.createRecursiveDirectory(moduleRoot, structure);
            if (result.success) {
                vscode.window.showInformationMessage(`Owl Component "${componentName}" created successfully.`);
                await vscode.commands.executeCommand('workbench.files.action.refreshFilesExplorer');
            }
            else {
                vscode.window.showErrorMessage(`Failed to create component: ${result.message.join(', ')}`);
            }
        }
        else {
            vscode.window.showErrorMessage('Could not load Owl component template structure.');
        }
    }
    catch (error) {
        vscode.window.showErrorMessage(`Error creating Owl component: ${error.message}`);
    }
}
async function handleCreatePosComponentCreation(uri, type) {
    const moduleRoot = await odooModuleUtils_1.OdooModuleUtils.getModuleRoot(uri);
    if (!moduleRoot) {
        vscode.window.showWarningMessage('POS component creation is only allowed in a valid Odoo module.');
        return;
    }
    try {
        const moduleName = path.basename(moduleRoot.fsPath);
        const componentInstance = await templates.getPosComponentTemplate(moduleName, type);
        if (componentInstance && componentInstance.getCompleteDirectoryStructure) {
            const structure = componentInstance.getCompleteDirectoryStructure();
            const result = await utils_1.helperUtils.createRecursiveDirectory(moduleRoot, structure);
            console.log(result);
            if (result.success) {
                vscode.window.showInformationMessage(`POS Component created successfully. \n ${result.message.join('\n')}`);
                await vscode.commands.executeCommand('workbench.files.action.refreshFilesExplorer');
            }
            else {
                vscode.window.showErrorMessage(`Failed to create POS component: ${result.message.join(', ')}`);
            }
        }
        else {
            vscode.window.showErrorMessage('Could not load POS component template structure.');
        }
    }
    catch (error) {
        vscode.window.showErrorMessage(`Error creating POS component: ${error.message}`);
    }
}
function registerCommands(context) {
    const commands = [
        {
            command: 'cybrosys-assista-odoo-helper.createModuleBasic',
            handler: (uri) => handleCreateModule(uri, 'basic')
        },
        {
            command: 'cybrosys-assista-odoo-helper.createModuleAdvanced',
            handler: (uri) => handleCreateModule(uri, 'advanced')
        },
        {
            command: 'cybrosys-assista-odoo-helper.createModuleowlBasic',
            handler: (uri) => handleCreateModule(uri, 'owl_basic')
        },
        {
            command: 'cybrosys-assista-odoo-helper.createModuleowlAdvanced',
            handler: (uri) => handleCreateModule(uri, 'owl_advanced')
        },
        {
            command: 'cybrosys-assista-odoo-helper.createModuleWithSystrayMenu',
            handler: (uri) => handleCreateModule(uri, 'systray_module')
        },
        {
            command: 'cybrosys-assista-odoo-helper.createModuleWebsiteTheme',
            handler: (uri) => handleCreateModule(uri, 'website_theme')
        },
        {
            command: 'cybrosys-assista-odoo-helper.createOdooModelFile',
            handler: handleCreateOdooModelFile
        },
        {
            command: 'cybrosys-assista-odoo-helper.createOdooViewFile',
            handler: (uri) => handleCreateOdooViewFile(uri)
        },
        {
            command: 'cybrosys-assista-odoo-helper.createOdooViewBasic',
            handler: (uri) => handleCreateOdooViewFile(uri, 'Basic View')
        },
        {
            command: 'cybrosys-assista-odoo-helper.createOdooViewAdvanced',
            handler: (uri) => handleCreateOdooViewFile(uri, 'Advanced View')
        },
        {
            command: 'cybrosys-assista-odoo-helper.createOdooViewInherit',
            handler: (uri) => handleCreateOdooViewFile(uri, 'Inherit View')
        },
        {
            command: 'cybrosys-assista-odoo-helper.createOdooReportFile',
            handler: (uri) => handleCreateOdooViewFile(uri, 'Report View')
        },
        {
            command: 'cybrosys-assista-odoo-helper.createOdooReportPdf',
            handler: (uri) => handleCreateOdooViewFile(uri, 'Report View', 'qweb-pdf')
        },
        {
            command: 'cybrosys-assista-odoo-helper.createOdooReportHtml',
            handler: (uri) => handleCreateOdooViewFile(uri, 'Report View', 'qweb-html')
        },
        {
            command: 'cybrosys-assista-odoo-helper.createOdooViewSecurityGroup',
            handler: (uri) => handleCreateOdooViewFile(uri, 'Security Group View')
        },
        {
            command: 'cybrosys-assista-odoo-helper.createOdooViewSecurityRule',
            handler: (uri) => handleCreateOdooViewFile(uri, 'Security Rule View')
        },
        {
            command: 'cybrosys-assista-odoo-helper.createOdooViewSequence',
            handler: (uri) => handleCreateOdooViewFile(uri, 'Sequence View')
        },
        {
            command: 'cybrosys-assista-odoo-helper.createOdooViewSettings',
            handler: (uri) => handleCreateOdooViewFile(uri, 'Settings View')
        },
        {
            command: 'cybrosys-assista-odoo-helper.createOdooViewCron',
            handler: (uri) => handleCreateOdooViewFile(uri, 'Cron Job View')
        },
        {
            command: 'cybrosys-assista-odoo-helper.createOdooAccessFile',
            handler: handleCreateOdooAccessFile
        },
        {
            command: 'cybrosys-assista-odoo-helper.addToInit',
            handler: handleAddToInit
        },
        {
            command: 'cybrosys-assista-odoo-helper.createOwlCommonComponent',
            handler: (uri) => handleCreateOwlComponentCreation(uri, 'commonComponent')
        },
        {
            command: 'cybrosys-assista-odoo-helper.createOwlFieldWidgetComponent',
            handler: (uri) => handleCreateOwlComponentCreation(uri, 'fieldWidgetComponent')
        },
        {
            command: 'cybrosys-assista-odoo-helper.createOwlPublicComponent',
            handler: (uri) => handleCreateOwlComponentCreation(uri, 'publicComponent')
        },
        {
            command: 'cybrosys-assista-odoo-helper.createOwlOdooService',
            handler: (uri) => handleCreateOwlComponentCreation(uri, 'serviceTemplate')
        },
        {
            command: 'cybrosys-assista-odoo-helper.extendPosProductScreen',
            handler: (uri) => handleCreatePosComponentCreation(uri, 'extendProductScreen')
        },
        {
            command: 'cybrosys-assista-odoo-helper.extendPosPartnerListScreen',
            handler: (uri) => handleCreatePosComponentCreation(uri, 'extendPartnerListScreen')
        },
        {
            command: 'cybrosys-assista-odoo-helper.extendPosPaymentScreen',
            handler: (uri) => handleCreatePosComponentCreation(uri, 'extendPaymentScreen')
        },
        {
            command: 'cybrosys-assista-odoo-helper.extendPosReceiptScreen',
            handler: (uri) => handleCreatePosComponentCreation(uri, 'extendReceiptScreen')
        },
        {
            command: 'cybrosys-assista-odoo-helper.extendPosTicketScreen',
            handler: (uri) => handleCreatePosComponentCreation(uri, 'extendTicketScreen')
        }
    ];
    commands.forEach(({ command, handler }) => {
        const disposable = vscode.commands.registerCommand(command, handler);
        context.subscriptions.push(disposable);
    });
}
//# sourceMappingURL=commandHandlers.js.map