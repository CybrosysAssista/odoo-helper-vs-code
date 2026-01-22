import * as fs from 'fs';
import * as path from 'path';
import * as vscode from 'vscode';
import { create } from 'xmlbuilder2';
import { OdooPythonUtils } from '../utils/odooPythonUtils';
import { FieldInfo } from '../services/fieldIndexService';
import { OdooModuleUtils } from '../utils/odooModuleUtils';
import { getPythonParserService } from '../services/pythonParserService';
import { getOdooVersion } from '../services/versionService';

export type ViewSupport = {
    fullSupport: boolean;
    widget?: string[];
};

export type OdooViewFieldMatrix = {
    [viewName: string]: {
        [fieldType: string]: ViewSupport;
    };
};

export const ODOO_FIELD_VIEW_SUPPORT: OdooViewFieldMatrix = {
    form: {
        char: { fullSupport: true },
        text: { fullSupport: true },
        html: { fullSupport: true },
        integer: { fullSupport: true },
        float: { fullSupport: true },
        monetary: { fullSupport: true },
        boolean: { fullSupport: true },
        selection: { fullSupport: true },
        date: { fullSupport: true },
        datetime: { fullSupport: true },
        many2one: { fullSupport: true },
        one2many: { fullSupport: true },
        many2many: {
            fullSupport: false,
            widget: ["many2many_tags"],
        },
        binary: { fullSupport: true },
        image: { fullSupport: true },
        reference: { fullSupport: true },
    },

    list: {
        char: { fullSupport: true },
        integer: { fullSupport: true },
        float: { fullSupport: true },
        monetary: { fullSupport: true },
        boolean: { fullSupport: true },
        selection: { fullSupport: true },
        date: { fullSupport: true },
        datetime: { fullSupport: true },
        many2one: { fullSupport: true },

        many2many: {
            fullSupport: false,
            widget: ["many2many_tags"],
        },

        image: {
            fullSupport: false,
            widget: ["image"],
        },
    },

    kanban: {
        char: { fullSupport: true },
        integer: { fullSupport: true },
        float: { fullSupport: true },
        monetary: { fullSupport: true },
        boolean: { fullSupport: true },
        selection: { fullSupport: true },
        date: { fullSupport: true },
        datetime: { fullSupport: true },
        many2one: { fullSupport: true },

        binary: {
            fullSupport: false,
            widget: ["binary"],
        },

        image: {
            fullSupport: false,
            widget: ["image"],
        },
    },

    pivot: {
        integer: { fullSupport: true },
        float: { fullSupport: true },
        monetary: { fullSupport: true },
        selection: { fullSupport: true },
        many2one: { fullSupport: true },
    },

    graph: {
        integer: { fullSupport: true },
        float: { fullSupport: true },
        monetary: { fullSupport: true },
        selection: { fullSupport: true },
        many2one: { fullSupport: true },
    },

    calendar: {
        date: { fullSupport: true },
        datetime: { fullSupport: true },
    },

    search: {
        char: { fullSupport: true },
        text: { fullSupport: true },
        integer: { fullSupport: true },
        float: { fullSupport: true },
        monetary: { fullSupport: true },
        boolean: { fullSupport: true },
        selection: { fullSupport: true },
        date: { fullSupport: true },
        datetime: { fullSupport: true },
        many2one: { fullSupport: true },

        many2many: {
            fullSupport: false,
            widget: ["many2many_tags"],
        },

        reference: {
            fullSupport: false,
            widget: ["reference"],
        },
    },
};

interface ViewOption extends vscode.QuickPickItem {
    id: string;
    picked?: boolean;
}

export type advancedFieldInfo = FieldInfo & {
    config?: {
        childFieldSelection?: FieldInfo[];
        widget?: string[];
    }
}

export class ViewGenerator {
    private modelTechnicalName: string;
    private modelName: string;
    private modelTitle: string;
    private viewToFieldMap: Record<string, advancedFieldInfo[]>;
    private root: any;
    private odooVersion: string;
    private listTag: string;

    constructor(modelTechnicalName: string, viewToFieldMap: Record<string, advancedFieldInfo[]>, odooVersion: string) {
        this.modelTechnicalName = modelTechnicalName;
        this.modelName = modelTechnicalName.replace(/\./g, '_');
        this.viewToFieldMap = viewToFieldMap;
        this.odooVersion = odooVersion;
        this.listTag = ['18', '19'].includes(odooVersion) ? 'list' : 'tree';

        this.modelTitle = modelTechnicalName
            .split('.')
            .map(w => w.charAt(0).toUpperCase() + w.slice(1))
            .join(' ');

        this.root = create({ version: '1.0', encoding: 'utf-8' })
            .ele('odoo')
            .ele('data');
    }

    public generateXML(): string {
        for (const [viewId, fields] of Object.entries(this.viewToFieldMap)) {
            // Actions and menus don't have fields in the map but should be generated if selected
            if (fields.length === 0 && !['action', 'menu'].includes(viewId)) continue;

            switch (viewId) {
                case 'form':
                    this.createFormRecord(fields);
                    break;
                case 'list':
                    this.createListRecord(fields);
                    break;
                case 'search':
                    this.createSearchRecord(fields);
                    break;
                case 'kanban':
                    this.createKanbanRecord(fields);
                    break;
                case 'pivot':
                    this.createPivotRecord(fields);
                    break;
                case 'action':
                    this.createWindowAction();
                    break;
                case 'menu':
                    this.createMenuItem();
                    break;
            }
        }
        return this.root.end({ prettyPrint: true, indent: '    ' });
    }

    private createFormRecord(fields: advancedFieldInfo[]) {
        const record = this.root.ele('record', { id: `${this.modelName}form_view`, model: 'ir.ui.view' });
        record.ele('field', { name: 'name' }).txt(`${this.modelTechnicalName}.form.view`);
        record.ele('field', { name: 'model' }).txt(this.modelTechnicalName);

        const arch = record.ele('field', { name: 'arch', type: 'xml' });
        const form = arch.ele('form', { string: this.modelTitle });
        const sheet = form.ele('sheet');

        const notebookFieldTypes = ['one2many', 'text', 'html'];
        let mainFields = fields.filter(f => !notebookFieldTypes.includes(f.fieldType.toLowerCase()));
        const notebookFields = fields.filter(f => notebookFieldTypes.includes(f.fieldType.toLowerCase()));

        // Special handling for 'name' field
        const nameField = mainFields.find(f => f.fieldName === 'name');
        if (nameField) {
            const titleDiv = sheet.ele('div', { class: 'oe_title' });
            titleDiv.ele('label', { for: 'name' });
            titleDiv.ele('h1').ele('field', { name: 'name' });
            // Remove name from mainFields so it's not added to the group again
            mainFields = mainFields.filter(f => f.fieldName !== 'name');
        }

        if (mainFields.length > 0) {
            const group = sheet.ele('group');
            const leftGroup = group.ele('group');
            const rightGroup = group.ele('group');

            mainFields.forEach((f, index) => {
                const target = (index % 2 === 0) ? leftGroup : rightGroup;
                const fieldAttrs: any = { name: f.fieldName };
                if (f.config?.widget) fieldAttrs.widget = f.config.widget[0];
                target.ele('field', fieldAttrs);
            });
        }

        if (notebookFields.length > 0) {
            const notebook = sheet.ele('notebook');
            notebookFields.forEach(f => {
                const label = f.attributes?.string || f.fieldName.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
                const page = notebook.ele('page', { string: label, name: f.fieldName });
                const fieldAttrs: any = { name: f.fieldName };
                if (f.config?.widget) fieldAttrs.widget = f.config.widget[0];

                const fieldNode = page.ele('field', fieldAttrs);

                if (f.fieldType.toLowerCase() === 'one2many' && f.config?.childFieldSelection) {
                    const tree = fieldNode.ele(this.listTag, { editable: 'bottom' });
                    f.config.childFieldSelection.forEach(inner => {
                        tree.ele('field', { name: inner.fieldName });
                    });
                }
            });
        }
    }

    private createListRecord(fields: advancedFieldInfo[]) {
        const record = this.root.ele('record', { id: `${this.modelName}_${this.listTag}_view`, model: 'ir.ui.view' });
        record.ele('field', { name: 'name' }).txt(`${this.modelTechnicalName}.${this.listTag}.view`);
        record.ele('field', { name: 'model' }).txt(this.modelTechnicalName);
        const arch = record.ele('field', { name: 'arch', type: 'xml' });
        const list = arch.ele(this.listTag, { string: this.modelTitle });

        fields.forEach(f => {
            const attrs: any = { name: f.fieldName };
            if (f.config?.widget) attrs.widget = f.config.widget[0];
            list.ele('field', attrs);
        });
    }

    private createSearchRecord(fields: advancedFieldInfo[]) {
        const record = this.root.ele('record', { id: `${this.modelName}_search_view`, model: 'ir.ui.view' });
        record.ele('field', { name: 'name' }).txt(`${this.modelTechnicalName}.search.view`);
        record.ele('field', { name: 'model' }).txt(this.modelTechnicalName);
        const arch = record.ele('field', { name: 'arch', type: 'xml' });
        const search = arch.ele('search', { string: this.modelTitle });

        fields.forEach(f => {
            search.ele('field', { name: f.fieldName });
        });

        const groupBy = search.ele('group', { expand: '0', string: 'Group By' });
        fields.forEach(f => {
            const type = f.fieldType.toLowerCase();
            if (['many2one', 'selection', 'date', 'datetime', 'boolean'].includes(type)) {
                const label = f.attributes?.string || f.fieldName.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
                groupBy.ele('filter', {
                    string: label,
                    name: `groupby_${f.fieldName}`,
                    context: `{'group_by': '${f.fieldName}'}`
                });
            }
        });
    }

    private createKanbanRecord(fields: advancedFieldInfo[]) {
        const record = this.root.ele('record', { id: `${this.modelName}_kanban_view`, model: 'ir.ui.view' });
        record.ele('field', { name: 'name' }).txt(`${this.modelTechnicalName}.kanban.view`);
        record.ele('field', { name: 'model' }).txt(this.modelTechnicalName);
        const arch = record.ele('field', { name: 'arch', type: 'xml' });
        const kanban = arch.ele('kanban');
        const templates = kanban.ele('templates');

        const tName = this.odooVersion === '19' ? 'card' : 'kanban-box';
        const t = templates.ele('t', { 't-name': tName });
        const div = t.ele('div', { class: 'oe_kanban_global_click' });

        fields.forEach(f => {
            const fieldAttrs: any = { name: f.fieldName };
            if (f.config?.widget) fieldAttrs.widget = f.config.widget[0];
            div.ele('field', fieldAttrs);
        });
    }

    private createPivotRecord(fields: advancedFieldInfo[]) {
        const record = this.root.ele('record', { id: `${this.modelName}_pivot_view`, model: 'ir.ui.view' });
        record.ele('field', { name: 'name' }).txt(`${this.modelTechnicalName}.pivot.view`);
        record.ele('field', { name: 'model' }).txt(this.modelTechnicalName);
        const arch = record.ele('field', { name: 'arch', type: 'xml' });
        const pivot = arch.ele('pivot', { string: this.modelTitle });

        fields.forEach(f => {
            const fieldType = f.fieldType.toLowerCase();
            const attrs: any = { name: f.fieldName };

            if (['integer', 'float', 'monetary'].includes(fieldType)) {
                attrs.type = 'measure';
            } else {
                attrs.type = 'row';
                if (['date', 'datetime'].includes(fieldType)) {
                    attrs.interval = 'month';
                }
            }
            pivot.ele('field', attrs);
        });
    }

    private createWindowAction() {
        const modes = Object.keys(this.viewToFieldMap)
            .filter(k => !['action', 'menu', 'client_action'].includes(k) && this.viewToFieldMap[k].length > 0)
            .map(k => k === 'list' ? this.listTag : k);

        const record = this.root.ele('record', { id: `action_${this.modelName}`, model: 'ir.actions.act_window' });
        record.ele('field', { name: 'name' }).txt(this.modelTitle);
        record.ele('field', { name: 'res_model' }).txt(this.modelTechnicalName);
        record.ele('field', { name: 'view_mode' }).txt(modes.length > 0 ? modes.join(',') : `${this.listTag},form`);
        record.ele('field', { name: 'help', type: 'html' })
            .ele('p', { class: 'o_view_nocontent_smiling_face' })
            .txt(`Create your first ${this.modelTitle}!`);
    }

    private createMenuItem() {
        this.root.ele('menuitem', {
            id: `menu_${this.modelName}`,
            name: this.modelTitle,
            action: `action_${this.modelName}`,
            sequence: '10'
        });
    }
}

export async function handleCreateViews(uri: vscode.Uri): Promise<void> {
    const editor = vscode.window.activeTextEditor;
    if (!editor) return;

    const moduleRoot = await OdooModuleUtils.getModuleRoot(editor.document.uri);
    if (!moduleRoot) {
        vscode.window.showWarningMessage('Create Views can only be used inside an Odoo Module.');
        return;
    }

    const context = await OdooPythonUtils.getModelAtContext(uri || editor.document.uri, editor.selection.active);
    if (!context.valid) {
        vscode.window.showWarningMessage('Create Views can only be used inside an Odoo Model class.');
        return;
    }

    if (context.isInherited) {
        vscode.window.showWarningMessage('View creation for inherited models is not supported yet.');
        return;
    }

    const modelTechnicalName = context.modelName;
    const modelName = modelTechnicalName.replace(/\./g, '_');

    const viewsDir = path.join(moduleRoot.fsPath, 'views');
    if (!fs.existsSync(viewsDir)) {
        fs.mkdirSync(viewsDir, { recursive: true });
    }

    const fileName = `${modelName}_views.xml`;
    const filePath = path.join(viewsDir, fileName);

    if (fs.existsSync(filePath)) {
        vscode.window.showWarningMessage('Views file already exists.');
        return;
    }

    const viewOptions: ViewOption[] = [
        { label: 'Form View', id: 'form', picked: true },
        { label: 'List View', id: 'list', picked: true },
        { label: 'Kanban View', id: 'kanban', picked: false },
        { label: 'Search View', id: 'search', picked: true },
        { label: 'Calendar View', id: 'calendar', picked: false },
        { label: 'Pivot View', id: 'pivot', picked: false },
        { label: 'Window Action', id: 'action', picked: true },
        { label: 'Client Action', id: 'client_action', picked: false },
        { label: 'Menu', id: 'menu', picked: true }
    ];

    const quickPick = vscode.window.createQuickPick<ViewOption>();
    quickPick.items = viewOptions;
    quickPick.selectedItems = viewOptions.filter(opt => opt.picked);
    quickPick.canSelectMany = true;
    quickPick.title = `Create Views for ${context.modelName}`;
    quickPick.placeholder = 'Select the elements to generate';

    const selectedIds = await new Promise<string[]>((resolve) => {
        quickPick.onDidAccept(() => {
            const ids = quickPick.selectedItems.map(item => item.id);
            quickPick.hide();
            resolve(ids);
        });
        quickPick.onDidHide(() => {
            quickPick.dispose();
            resolve([]);
        });
        quickPick.show();
    });

    if (selectedIds.length === 0) {
        vscode.window.showWarningMessage('No elements selected.');
        return;
    }

    const viewIds = selectedIds.filter(id => !['menu', 'action', 'client_action'].includes(id));
    const viewToFieldMap: Record<string, advancedFieldInfo[]> = {};

    let modelFields: FieldInfo[] = [];
    if (viewIds.length > 0) {
        modelFields = OdooPythonUtils.getModelFields(context.modelName)
            .filter((f: FieldInfo) => !f.isInherited || f.moduleName === context.moduleName);
    }

    // Single prompt for Creation Mode
    let mode: string = 'Advanced Builder';
    if (viewIds.length > 0) {
        const modeSelection = await vscode.window.showQuickPick([
            { label: 'Quick Create', detail: 'Autoselect all fields and create views' },
            { label: 'Advanced Builder', detail: 'Manually select fields for each view' }
        ], { title: 'Select Creation Mode', placeHolder: 'Choose how fields should be selected' });

        if (!modeSelection) return;
        mode = modeSelection.label;
    }

    for (const viewId of selectedIds) {
        if (['menu', 'action', 'client_action'].includes(viewId)) {
            viewToFieldMap[viewId] = [];
            continue;
        }

        const viewSupport = ODOO_FIELD_VIEW_SUPPORT[viewId];
        const supportedFields = modelFields.filter(field => {
            return !viewSupport || !!viewSupport[field.fieldType.toLowerCase()];
        });

        // If Quick Create, bypass individual QuickPicks
        if (mode === 'Quick Create') {
            const autoFields: advancedFieldInfo[] = [];
            for (const field of supportedFields) {
                const typeSupport = viewSupport ? viewSupport[field.fieldType.toLowerCase()] : { fullSupport: true };
                const newField: advancedFieldInfo = { ...field };

                if (typeSupport && !typeSupport.fullSupport && typeSupport.widget) {
                    newField.config = { widget: typeSupport.widget };
                }

                // Auto-select child fields for one2many in Quick mode
                if (viewId === 'form' && newField.fieldType.toLowerCase() === 'one2many') {
                    const comodel = newField.attributes?.comodel_name;
                    if (comodel) {
                        const comodelFields = OdooPythonUtils.getModelFields(comodel)
                            .filter((f: FieldInfo) => (!f.isInherited || f.moduleName === context.moduleName) && ODOO_FIELD_VIEW_SUPPORT.list[f.fieldType.toLowerCase()]?.fullSupport);
                        newField.config = newField.config || {};
                        newField.config.childFieldSelection = comodelFields;
                    }
                }
                autoFields.push(newField);
            }
            viewToFieldMap[viewId] = autoFields;
            continue;
        }

        let counter = 0;
        const fieldIds: ViewOption[] = [];
        modelFields
            .filter(field => {
                const viewSupport = ODOO_FIELD_VIEW_SUPPORT[viewId];
                return !viewSupport || !!viewSupport[field.fieldType.toLowerCase()];
            })
            .map((field: FieldInfo) => {
                counter++;
                fieldIds.push({
                    label: `${field.fieldName}(${field.fieldType})`,
                    id: field.fieldName,
                    picked: counter <= 5
                });
            });

        const fieldQuickPick = vscode.window.createQuickPick<ViewOption>();
        fieldQuickPick.items = fieldIds;
        fieldQuickPick.selectedItems = fieldIds.filter(opt => opt.picked);
        fieldQuickPick.canSelectMany = true;
        fieldQuickPick.title = `Select fields for ${viewId}`;
        fieldQuickPick.placeholder = 'Select the fields to generate';

        const selectedFieldIds = await new Promise<advancedFieldInfo[]>((resolve) => {
            let isAccepted = false;
            fieldQuickPick.onDidAccept(async () => {
                isAccepted = true;
                const selectedNames = fieldQuickPick.selectedItems.map(item => item.id);
                fieldQuickPick.hide();

                const finalFields: advancedFieldInfo[] = [];
                const viewSupport = ODOO_FIELD_VIEW_SUPPORT[viewId];

                for (const field of modelFields) {
                    if (!selectedNames.includes(field.fieldName)) continue;

                    const typeSupport = viewSupport ? viewSupport[field.fieldType.toLowerCase()] : { fullSupport: true };
                    if (!typeSupport) continue;

                    const newField: advancedFieldInfo = { ...field };

                    if (!typeSupport.fullSupport && typeSupport.widget) {
                        newField.config = { widget: typeSupport.widget };
                    }

                    if (viewId === 'form' && newField.fieldType.toLowerCase() === 'one2many') {
                        const comodel = newField.attributes?.comodel_name;
                        if (comodel) {
                            const comodelFields = OdooPythonUtils.getModelFields(comodel)
                                .filter((f: FieldInfo) => (!f.isInherited || f.moduleName === context.moduleName) && ODOO_FIELD_VIEW_SUPPORT.list[f.fieldType.toLowerCase()]?.fullSupport);

                            if (comodelFields.length > 0) {
                                const childSelection = await vscode.window.showQuickPick(
                                    comodelFields.map(f => ({
                                        label: `${f.fieldName}(${f.fieldType})`,
                                        id: f.fieldName,
                                        picked: true
                                    }) as any),
                                    {
                                        canPickMany: true,
                                        title: `Select sub-fields for ${field.fieldName} (${comodel})`
                                    }
                                );

                                if (childSelection) {
                                    const selectedChildNames = childSelection.map((s: any) => s.id);
                                    newField.config = newField.config || {};
                                    newField.config.childFieldSelection = comodelFields.filter(cf => selectedChildNames.includes(cf.fieldName));
                                }
                            }
                        }
                    }
                    finalFields.push(newField);
                }
                resolve(finalFields);
            });
            fieldQuickPick.onDidHide(() => {
                if (!isAccepted) {
                    resolve([]);
                }
                fieldQuickPick.dispose();
            });
            fieldQuickPick.show();
        });

        viewToFieldMap[viewId] = selectedFieldIds;
    }

    try {
        const odooVersion = await getOdooVersion();
        const generator = new ViewGenerator(modelTechnicalName, viewToFieldMap, odooVersion);
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
                    dataCategory: 'view'
                }, `views/${fileName}`);

                if (result.success && result.updatedContent) {
                    fs.writeFileSync(manifestPath, result.updatedContent, 'utf8');
                }
            }
        }

        const doc = await vscode.workspace.openTextDocument(filePath);
        await vscode.window.showTextDocument(doc);
        vscode.window.showInformationMessage(`Views for ${context.modelName} generated successfully!`);
    } catch (err: any) {
        vscode.window.showErrorMessage(`Failed to generate views: ${err.message}`);
    }
}
