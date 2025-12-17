const vscode = require('vscode');
const { createOdooScaffold } = require('../modules/scaffold');
const fs = require('fs');
const path = require('path');
const templates = require('./templates');

function capitalize(text) {
    return text
        .split('_')
        .map(word => word.charAt(0).toUpperCase() + word.slice(1))
        .join('');
}

async function handleCreateModule(uri, type) {
    if (!uri || !uri.fsPath) {
        return vscode.window.showErrorMessage(
            `Right‑click a folder and choose "Create ${type} Module".`
        );
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
        return vscode.window.showErrorMessage(`Module "${moduleName}" already exists.`);
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
    } catch (err) {
        vscode.window.showErrorMessage(`Failed to create module: ${err.message}`);
    }
}

async function handleCreateOdooModelFile(uri) {
    try {
        const fileType = await vscode.window.showQuickPick(
            ['__init__', '__manifest__', 'Odoo Model', 'Odoo Controller'],
            {
                placeHolder: 'Select the type of Odoo file to create',
                ignoreFocusOut: true
            }
        );

        if (!fileType) {
            return vscode.window.showWarningMessage('You must select a file type.');
        }

        let fileName = '';
        let fullFileName = '';
        let fileContent = '';
        const folderPath = uri.fsPath;

        if (fileType === '__init__') {
            fullFileName = '__init__.py';
            fileContent = `# -*- coding: utf-8 -*-
from . import `;
        } else if (fileType === '__manifest__') {
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
        } else {
            fileName = await vscode.window.showInputBox({
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

            if (!fileName) {
                return vscode.window.showWarningMessage('File name is required.');
            }

            fullFileName = `${fileName}.py`;

            if (fileType === 'Odoo Model') {
                const modelName = fileName.replace(/_/g, '.');
                fileContent = `# -*- coding: utf-8 -*-
from odoo import fields,models

class ${capitalize(fileName)}(models.Model):
    _name = '${modelName}'

    name = fields.Char(string='Name')`;
            } else if (fileType === 'Odoo Controller') {
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
            return vscode.window.showWarningMessage(`File "${fullFileName}" already exists.`);
        }

        fs.writeFileSync(filePath, fileContent, 'utf8');
        vscode.window.showInformationMessage(`Created ${fullFileName} successfully.`);

    } catch (error) {
        vscode.window.showErrorMessage('Error creating file: ' + error.message);
    }
}

async function handleCreateOdooViewFile(uri) {
    try {
        const fileType = await vscode.window.showQuickPick(
            ['Empty View', 'Basic View', 'Advanced View', 'Inherit View', 'Report View',
                'Security Group View', 'Security Rule View', 'Sequence View', 'Settings View', 'Cron Job View'],
            {
                placeHolder: 'Select the type of Odoo file to create',
                ignoreFocusOut: true
            }
        );

        if (!fileType) {
            return vscode.window.showWarningMessage('You must select a file type.');
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
            return vscode.window.showWarningMessage('File name is required.');
        }

        const fullFileName = fileName.endsWith('.xml') ? fileName : `${fileName}.xml`;
        const folderPath = uri.fsPath;
        const filePath = path.join(folderPath, fullFileName);

        if (fs.existsSync(filePath)) {
            return vscode.window.showWarningMessage(`File "${fullFileName}" already exists.`);
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
                console.log("pureName",pureName);
                console.log("modelDotName",modelDotName);
                console.log("modelTitle",modelTitle);
                fileContent = await templates.getAdvancedViewTemplate(pureName, modelDotName, modelTitle);
                break;

            case 'Inherit View':
                fileContent = await templates.getInheritViewTemplate(pureName, modelDotName);
                break;

            case 'Report View':
                fileContent = await templates.getReportViewTemplate(pureName, modelDotName, modelTitle);
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

    } catch (error) {
        vscode.window.showErrorMessage('Error creating file: ' + error.message);
    }
}

async function handleCreateOdooAccessFile(uri) {
    try {
        const modelName = await vscode.window.showInputBox({
            placeHolder: 'Enter the model name (e.g., sale.order)',
            prompt: 'Enter the technical name of your model',
            ignoreFocusOut: true
        });

        if (!modelName) {
            return vscode.window.showWarningMessage('Model name is required.');
        }

        // Create security directory if it doesn't exist
        const securityDir = path.join(uri.fsPath, 'security');
        if (!fs.existsSync(securityDir)) {
            fs.mkdirSync(securityDir, { recursive: true });
        }

        const fileName = 'ir.model.access.csv';
        const filePath = path.join(securityDir, fileName);

        // Check if file exists
        let fileContent = '';
        if (fs.existsSync(filePath)) {
            // Read existing content
            fileContent = fs.readFileSync(filePath, 'utf8');
            // Add new line if file doesn't end with newline
            if (!fileContent.endsWith('\n')) {
                fileContent += '\n';
            }
        } else {
            // Create new file with header
            fileContent = 'id,name,model_id:id,group_id:id,perm_read,perm_write,perm_create,perm_unlink\n';
        }

        // Add new access rights
        const accessId = `access_${modelName.replace('.', '_')}`;
        const newLine = `${accessId},${modelName.replace('.', ' ')} access,model_${modelName.replace('.', '_')},base.group_user,1,1,1,1\n`;
        fileContent += newLine;

        fs.writeFileSync(filePath, fileContent, 'utf8');
        await vscode.window.showTextDocument(vscode.Uri.file(filePath));
        vscode.window.showInformationMessage(`Created/Updated ${fileName} successfully.`);

    } catch (error) {
        vscode.window.showErrorMessage('Error creating access file: ' + error.message);
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
            handler: handleCreateOdooViewFile
        },
        {
            command: 'cybrosys-assista-odoo-helper.createOdooAccessFile',
            handler: handleCreateOdooAccessFile
        }
    ];

    commands.forEach(({ command, handler }) => {
        const disposable = vscode.commands.registerCommand(command, handler);
        context.subscriptions.push(disposable);
    });
}

module.exports = {
    registerCommands
}; 