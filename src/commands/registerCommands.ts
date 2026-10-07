import * as vscode from 'vscode';

type Handlers = typeof import('./commandHandlers');

/**
 * Commands are registered at activation, but their implementations (templates, scaffolding, XML
 * builders...) are only loaded the first time one of them runs.
 */
let handlers: Handlers | undefined;
const load = (): Handlers => handlers ??= require('./commandHandlers');

const COMMANDS: [string, (h: Handlers, ...args: any[]) => unknown][] = [
    ['cybrosys-assista-odoo-helper.createModuleBasic', (h, uri: vscode.Uri) => h.handleCreateModule(uri, 'basic')],
    ['cybrosys-assista-odoo-helper.createModuleAdvanced', (h, uri: vscode.Uri) => h.handleCreateModule(uri, 'advanced')],
    ['cybrosys-assista-odoo-helper.createModuleowlBasic', (h, uri: vscode.Uri) => h.handleCreateModule(uri, 'owl_basic')],
    ['cybrosys-assista-odoo-helper.createModuleowlAdvanced', (h, uri: vscode.Uri) => h.handleCreateModule(uri, 'owl_advanced')],
    ['cybrosys-assista-odoo-helper.createModuleWithSystrayMenu', (h, uri: vscode.Uri) => h.handleCreateModule(uri, 'systray_module')],
    ['cybrosys-assista-odoo-helper.createModuleWebsiteTheme', (h, uri: vscode.Uri) => h.handleCreateModule(uri, 'website_theme')],
    ['cybrosys-assista-odoo-helper.createOdooModelFile', (h, uri: vscode.Uri) => h.handleCreateOdooModelFile(uri)],
    ['cybrosys-assista-odoo-helper.createOdooViewFile', (h, uri: vscode.Uri) => h.handleCreateOdooViewFile(uri)],
    ['cybrosys-assista-odoo-helper.createOdooViewBasic', (h, uri: vscode.Uri) => h.handleCreateOdooViewFile(uri, 'Basic View')],
    ['cybrosys-assista-odoo-helper.createOdooViewAdvanced', (h, uri: vscode.Uri) => h.handleCreateOdooViewFile(uri, 'Advanced View')],
    ['cybrosys-assista-odoo-helper.createOdooViewInherit', (h, uri: vscode.Uri) => h.handleCreateOdooViewFile(uri, 'Inherit View')],
    ['cybrosys-assista-odoo-helper.createOdooReportFile', (h, uri: vscode.Uri) => h.handleCreateOdooViewFile(uri, 'Report View')],
    ['cybrosys-assista-odoo-helper.createOdooReportPdf', (h, uri: vscode.Uri) => h.handleCreateOdooViewFile(uri, 'Report View', 'qweb-pdf')],
    ['cybrosys-assista-odoo-helper.createOdooReportHtml', (h, uri: vscode.Uri) => h.handleCreateOdooViewFile(uri, 'Report View', 'qweb-html')],
    ['cybrosys-assista-odoo-helper.createOdooViewSecurityGroup', (h, uri: vscode.Uri) => h.handleCreateOdooViewFile(uri, 'Security Group View')],
    ['cybrosys-assista-odoo-helper.createOdooViewSecurityRule', (h, uri: vscode.Uri) => h.handleCreateOdooViewFile(uri, 'Security Rule View')],
    ['cybrosys-assista-odoo-helper.createOdooViewSequence', (h, uri: vscode.Uri) => h.handleCreateOdooViewFile(uri, 'Sequence View')],
    ['cybrosys-assista-odoo-helper.createOdooViewSettings', (h, uri: vscode.Uri) => h.handleCreateOdooViewFile(uri, 'Settings View')],
    ['cybrosys-assista-odoo-helper.createOdooViewCron', (h, uri: vscode.Uri) => h.handleCreateOdooViewFile(uri, 'Cron Job View')],
    ['cybrosys-assista-odoo-helper.createOdooAccessFile', (h, uri: vscode.Uri) => h.handleCreateOdooAccessFile(uri)],
    ['cybrosys-assista-odoo-helper.addToInit', (h, uri: vscode.Uri) => h.handleAddToInit(uri)],
    ['cybrosys-assista-odoo-helper.createOwlCommonComponent', (h, uri: vscode.Uri) => h.handleCreateOwlComponentCreation(uri, 'commonComponent')],
    ['cybrosys-assista-odoo-helper.createOwlFieldWidgetComponent', (h, uri: vscode.Uri) => h.handleCreateOwlComponentCreation(uri, 'fieldWidgetComponent')],
    ['cybrosys-assista-odoo-helper.createOwlPublicComponent', (h, uri: vscode.Uri) => h.handleCreateOwlComponentCreation(uri, 'publicComponent')],
    ['cybrosys-assista-odoo-helper.createOwlOdooService', (h, uri: vscode.Uri) => h.handleCreateOwlComponentCreation(uri, 'serviceTemplate')],
    ['cybrosys-assista-odoo-helper.extendPosProductScreen', (h, uri: vscode.Uri) => h.handleCreatePosComponentCreation(uri, 'extendProductScreen')],
    ['cybrosys-assista-odoo-helper.extendPosPartnerListScreen', (h, uri: vscode.Uri) => h.handleCreatePosComponentCreation(uri, 'extendPartnerListScreen')],
    ['cybrosys-assista-odoo-helper.extendPosPaymentScreen', (h, uri: vscode.Uri) => h.handleCreatePosComponentCreation(uri, 'extendPaymentScreen')],
    ['cybrosys-assista-odoo-helper.extendPosReceiptScreen', (h, uri: vscode.Uri) => h.handleCreatePosComponentCreation(uri, 'extendReceiptScreen')],
    ['cybrosys-assista-odoo-helper.extendPosTicketScreen', (h, uri: vscode.Uri) => h.handleCreatePosComponentCreation(uri, 'extendTicketScreen')],
    ['cybrosys-assista-odoo-helper.createViews', (h, uri: vscode.Uri) => h.handleCreateViews(uri)],
    ['cybrosys-assista-odoo-helper.createAccessRight', (h, uri: vscode.Uri) => h.handleCreateAccessRight(uri)],
    ['cybrosys-assista-odoo-helper.createReport', (h, uri: vscode.Uri) => h.handleCreateReport(uri)],
    ['cybrosys-assista-odoo-helper.installModule', (h, uri: vscode.Uri) => h.installModule(uri)],
    ['cybrosys-assista-odoo-helper.showDependencyGraph', (h, uri: vscode.Uri) => h.handleShowDependencyGraph(uri)],
    ['cybrosys-assista-odoo-helper.showModelInheritanceGraph', (h) => h.handleShowModelInheritanceGraph()],
];

export function registerCommands(context: vscode.ExtensionContext): void {
    for (const [command, run] of COMMANDS) {
        context.subscriptions.push(vscode.commands.registerCommand(command, (...args: any[]) => run(load(), ...args)));
    }
}
