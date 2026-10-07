import * as fs from 'fs';
import * as path from 'path';
import * as vscode from 'vscode';
import { create } from 'xmlbuilder2';
import { OdooPythonUtils } from '../utils/odooPythonUtils';
import fieldIndexService, { FieldInfo } from '../services/fieldIndexService';
import { OdooModuleUtils } from '../utils/odooModuleUtils';
import { getPythonParserService } from '../services/pythonParserService';
import { getOdooVersion, isAtLeast, LATEST_VERSION } from '../services/versionService';

interface ViewOption extends vscode.QuickPickItem {
    id: 'pdf' | 'html';
}

/** The field's label as Odoo shows it: its string, or the name without _id/_ids, title-cased (fields.py). */
function fieldLabel(f: FieldInfo): string {
    if (f.attributes['string']) return f.attributes['string'];
    return f.fieldName.replace(/_ids?$/, '').replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}

export class ReportGenerator {
    private reportType: ViewOption;
    private nameField: FieldInfo;
    private infoFields: FieldInfo[];
    private tableField: FieldInfo | undefined;
    private tableChildFields: FieldInfo[];
    private modelTechnicalName: string;
    private moduleName: string;

    constructor(
        reportType: ViewOption,
        nameField: FieldInfo,
        infoFields: FieldInfo[],
        tableField: FieldInfo | undefined,
        tableChildFields: FieldInfo[],
        modelTechnicalName: string,
        moduleName: string,
        private readonly odooVersion: string = LATEST_VERSION
    ) {
        this.reportType = reportType;
        this.nameField = nameField;
        this.infoFields = infoFields;
        this.tableField = tableField;
        this.tableChildFields = tableChildFields;
        this.modelTechnicalName = modelTechnicalName;
        this.moduleName = moduleName;
    }

    public generateXML(): string {
        const modelName = this.modelTechnicalName.replace(/\./g, '_');
        const typeId = this.reportType.id;
        const actionId = `report_${modelName}_${typeId}`;
        const templateId = `report_${modelName}_document_${typeId}`;
        const fullTemplateId = `${this.moduleName}.${templateId}`;

        const root = create({ version: '1.0', encoding: 'utf-8' })
            .ele('odoo')
            .ele('data');

        // 1. Report Action
        const reportAction = root.ele('record', { id: actionId, model: 'ir.actions.report' });
        reportAction.ele('field', { name: 'name' }).txt(`${this.reportType.label}`);
        reportAction.ele('field', { name: 'model' }).txt(this.modelTechnicalName);
        reportAction.ele('field', { name: 'report_type' }).txt(typeId === 'pdf' ? 'qweb-pdf' : 'qweb-html');
        reportAction.ele('field', { name: 'report_name' }).txt(fullTemplateId);
        if (!isAtLeast(this.odooVersion, '20')) {  // removed from ir.actions.report in Odoo 20
            reportAction.ele('field', { name: 'report_file' }).txt(fullTemplateId);
        }
        reportAction.ele('field', { name: 'print_report_name' }).txt(`'%s' % 'Report - ' + str(object.id)`);
        reportAction.ele('field', { name: 'binding_model_id', ref: `model_${modelName}` });
        reportAction.ele('field', { name: 'binding_type' }).txt('report');

        // 2. Report Template
        const template = root.ele('template', { id: templateId });
        const container = template.ele('t', { 't-call': 'web.html_container' });
        const foreach = container.ele('t', { 't-foreach': 'docs', 't-as': 'doc' });
        const layout = foreach.ele('t', { 't-call': 'web.external_layout' });
        const page = layout.ele('div', { class: 'page' });

        page.ele('div', { class: 'oe_structure' });

        // Header section with partner details (placeholders like in example)
        const headerRow = page.ele('div', { class: 'row mt-4 mb-4' });
        headerRow.ele('div', { class: 'col-6' });
        headerRow.ele('div', { class: 'col-6' });

        // Document Title
        const h2 = page.ele('h2', { class: 'mt-4 mb-3', style: 'font-size: 1.8rem;' });
        h2.ele('strong').ele('span', { 't-field': `doc.${this.nameField.fieldName}` });

        // Information Section
        if (this.infoFields.length > 0) {
            const infoWrap = page.ele('div', { class: 'report-wrapping-flexbox clearfix', id: 'informations' });
            const infoRow = infoWrap.ele('div', { class: 'row' });

            this.infoFields.forEach(f => {
                const label = fieldLabel(f);
                const col = infoRow.ele('div', { class: 'col-6' });
                const wrap = col.ele('div');
                wrap.ele('div', { class: 'fw-bold mb-1' }).txt(label);
                wrap.ele('div').ele('span', { 't-field': `doc.${f.fieldName}` });
            });

            infoWrap.ele('div', { style: 'height: 20px;' });
        }

        page.ele('div', { class: 'oe_structure' });

        // Table Section
        if (this.tableField && this.tableChildFields.length > 0) {
            const table = page.ele('table', { class: 'table o_main_table table-borderless' });
            const thead = table.ele('thead', { style: 'display: table-row-group;' }).ele('tr');

            this.tableChildFields.forEach((cf, index) => {
                const label = fieldLabel(cf);
                const alignClass = index === 0 ? 'text-start' : 'text-end';
                thead.ele('th', { class: `${alignClass} fw-bold`, scope: 'col', style: 'width: 15%' }).txt(label);
            });

            const tbody = table.ele('tbody', { class: 'sale_tbody' });
            const lineForeach = tbody.ele('t', { 't-as': 'line', 't-foreach': `doc.${this.tableField.fieldName}` });
            const tr = lineForeach.ele('tr', { class: 'o_line_section' });

            this.tableChildFields.forEach((cf, index) => {
                const alignClass = index === 0 ? 'text-start' : 'text-end';
                const nowrapClass = index !== 0 ? ' text-nowrap' : '';
                tr.ele('td', { class: `${alignClass}${nowrapClass} align-top` })
                    .ele('span', { 't-field': `line.${cf.fieldName}` });
            });
        }

        return root.end({ prettyPrint: true, indent: '    ' });
    }
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

    const reportDir = path.join(moduleRoot.fsPath, 'report');
    if (!fs.existsSync(reportDir)) {
        fs.mkdirSync(reportDir);
    }

    const fileName = `${modelName}_pdf_report.xml`;
    const filePath = path.join(reportDir, fileName);

    if (fs.existsSync(filePath)) {
        vscode.window.showWarningMessage(`Report file '${fileName}' already exists.`);
        return;
    }

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

    const currentModuleName = path.basename(moduleRoot.fsPath);
    const allFields = fieldIndexService.getFieldsForModel(modelTechnicalName);

    const validFields = allFields.filter(field => {
        return !field.isInherited || (field.isInherited && field.moduleName === currentModuleName);
    });

    const normalTypes = ['Char', 'Text', 'Integer', 'Float', 'Monetary', 'Boolean', 'Selection', 'Date'];
    const relationalTypes = ['Many2many', 'One2many'];

    let normalFields: FieldInfo[] = validFields.filter(field => normalTypes.includes(field.fieldType));
    const relationalFields: FieldInfo[] = validFields.filter(field => relationalTypes.includes(field.fieldType));

    const nameFieldSelection = await vscode.window.showQuickPick(
        normalFields.map(field => ({
            label: field.fieldName,
            detail: field.fieldType,
        })),
        {
            title: 'Select Title Field',
            placeHolder: 'Select the field to be used as title in the report',
        }
    );

    const nameField: FieldInfo | undefined = normalFields.find(f => f.fieldName === nameFieldSelection?.label);
    if (!nameField) return;

    const selectedInfoFields = await vscode.window.showQuickPick(
        normalFields.filter(f => f.fieldName !== nameFieldSelection?.label).map(field => ({
            label: field.fieldName,
            detail: field.fieldType,
        })),
        {
            title: 'Select Information Fields',
            placeHolder: 'Select fields to display in the header information section',
            canPickMany: true
        }
    );

    // Filter out undefined fields to ensure infoFields is FieldInfo[]
    const infoFields: FieldInfo[] = (selectedInfoFields || [])
        .map(field => normalFields.find(f => f.fieldName === field.label))
        .filter((f): f is FieldInfo => !!f);

    let tableFieldPicker: vscode.QuickPickItem | undefined;
    let tableChildFieldsPicker: vscode.QuickPickItem[] | undefined;

    let tableField: FieldInfo | undefined;
    let tableChildFields: FieldInfo[] = [];

    if (relationalFields.length > 0) {
        tableFieldPicker = await vscode.window.showQuickPick(
            relationalFields.map(field => ({
                label: field.fieldName,
                detail: field.fieldType,
            })),
            {
                title: 'Select Table Field',
                placeHolder: 'Select the relational field to be used as a table in the report',
            }
        );

        if (tableFieldPicker) {
            const selectedRelationalField = relationalFields.find(f => f.fieldName === tableFieldPicker?.label);
            const comodelName = selectedRelationalField?.attributes['comodel_name'];

            if (comodelName) {
                const comodelFields = fieldIndexService.getFieldsForModel(comodelName);
                const comodelNormalFields = comodelFields.filter(field => normalTypes.includes(field.fieldType));

                if (comodelNormalFields.length > 0) {
                    tableChildFieldsPicker = await vscode.window.showQuickPick(
                        comodelNormalFields.map(field => ({
                            label: field.fieldName,
                            detail: field.fieldType,
                        })),
                        {
                            title: `Select Columns for ${tableFieldPicker.label}`,
                            placeHolder: 'Select fields to display in the table',
                            canPickMany: true
                        }
                    );
                }

                if (tableFieldPicker && tableChildFieldsPicker) {
                    tableField = relationalFields.find(f => f.fieldName === tableFieldPicker?.label);
                    tableChildFields = tableChildFieldsPicker.map(field => comodelNormalFields.find(f => f.fieldName === field.label)).filter((f): f is FieldInfo => !!f);
                }
            }
        }
    }

    try {
        const generator = new ReportGenerator(
            reportType,
            nameField,
            infoFields,
            tableField,
            tableChildFields,
            modelTechnicalName,
            currentModuleName,
            await getOdooVersion()
        );

        const xmlContent = generator.generateXML();
        fs.writeFileSync(filePath, xmlContent, 'utf8');

        // Update manifest
        const manifestPath = path.join(moduleRoot.fsPath, '__manifest__.py');
        if (fs.existsSync(manifestPath)) {
            const manifestContent = fs.readFileSync(manifestPath, 'utf8');
            const pythonParser = getPythonParserService();
            const manifestParser = pythonParser.getManifestParser();
            if (manifestParser) {
                manifestParser.parseManifest(manifestContent);
                const result = manifestParser.updateManifest({
                    type: 'file',
                    name: fileName,
                    content: '',
                    updateManifest: true,
                    manifestCategory: 'data',
                    dataCategory: 'report'
                }, `report/${fileName}`);

                if (result.success && result.updatedContent) {
                    fs.writeFileSync(manifestPath, result.updatedContent, 'utf8');
                }
            }
        }

        const doc = await vscode.workspace.openTextDocument(filePath);
        await vscode.window.showTextDocument(doc);
        vscode.window.showInformationMessage(`Report for ${modelTechnicalName} generated successfully!`);
    } catch (err: any) {
        vscode.window.showErrorMessage(`Failed to generate report: ${err.message}`);
    }
}
