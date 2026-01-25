import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import moduleIndexService from '../services/moduleIndexService';
import modelIndexService, { ModelInfo } from '../services/modelIndexService';
import fieldIndexService, { FieldInfo } from '../services/fieldIndexService';
import functionIndexService, { FunctionInfo } from '../services/functionIndexService';
import { OdooPythonUtils } from '../utils/odooPythonUtils';
import { OdooModuleUtils } from '../utils/odooModuleUtils';

export async function handleShowModelInheritanceGraph(): Promise<void> {
    const editor = vscode.window.activeTextEditor;
    if (!editor) {
        vscode.window.showErrorMessage('No active editor found.');
        return;
    }

    const { document, selection } = editor;
    const context = await OdooPythonUtils.getModelAtContext(document.uri, selection.active);

    if (!context.valid || !context.modelName) {
        vscode.window.showErrorMessage('Place your cursor inside an Odoo model definition to show the inheritance graph.');
        return;
    }

    const modelName = context.modelName;

    let moduleName: string;

    if (!context.isInherited) {
        moduleName = context.moduleName;
    } else {
        const moduleInfo = moduleIndexService.getModuleInfo(context.moduleName);
        if (!moduleInfo) {
            vscode.window.showErrorMessage('Could not determine the Odoo module root for the current file.');
            return;
        }

        const moduleDepends = moduleInfo.depends;

        const models = modelIndexService.getModelsByName(modelName);
        const parentModel = models.find(m => !m.isInherited && moduleDepends.includes(m.moduleName));

        if (parentModel) {
            moduleName = parentModel.moduleName;
        } else {
            moduleName = moduleDepends.includes('base') ? 'base' : (moduleDepends[0] || 'unknown');
        }
    }

    const allModels = modelIndexService.getModelsByName(modelName);
    const inheritanceModels = allModels.filter(m => m.isInherited && m.moduleDepends.includes(moduleName));

    const allFields = fieldIndexService.getFieldsForModel(modelName);
    const allFunctions = functionIndexService.getFunctionsForModel(modelName);

    const nodes: any[] = [];
    const edges: any[] = [];

    // Helper to add module and its grouped members
    const addModuleArchitecture = (mName: string, level: number, isBase: boolean, filePath?: string, line?: number) => {
        // Module Node
        nodes.push({
            id: mName,
            label: `${mName}\n${isBase ? '(Base)' : '(Extn)'}`,
            group: isBase ? 'module-base' : 'module-ext',
            level: level,
            filePath,
            line
        });

        const mFields = allFields.filter(f => f.moduleName === mName && f.isInherited === !isBase);
        const mFunctions = allFunctions.filter(f => f.moduleName === mName && f.isInherited === !isBase);

        // Grouped Fields Node
        if (mFields.length > 0) {
            const fieldNodeId = `${mName}_fields`;
            nodes.push({
                id: fieldNodeId,
                label: `Fields (${mFields.length})`,
                group: 'fields-group',
                level: level + 1,
                title: mFields.map(f => f.fieldName).join('\n')
            });
            edges.push({ from: mName, to: fieldNodeId, color: '#2ecc71', width: 1, dashes: true });
        }

        // Grouped Functions Node
        if (mFunctions.length > 0) {
            const funcNodeId = `${mName}_funcs`;
            nodes.push({
                id: funcNodeId,
                label: `Methods (${mFunctions.length})`,
                group: 'funcs-group',
                level: level + 1,
                title: mFunctions.map(f => `${f.functionName}()`).join('\n')
            });
            edges.push({ from: mName, to: funcNodeId, color: '#9b59b6', width: 1, dashes: true });
        }
    };

    // 1. Add Base
    const baseModel = allModels.find(m => !m.isInherited && m.moduleName === moduleName);
    addModuleArchitecture(moduleName, 0, true, baseModel?.filePath, baseModel?.line);

    // 2. Add Extensions
    let currentLevel = 2;
    for (const model of inheritanceModels) {
        addModuleArchitecture(model.moduleName, currentLevel, false, model.filePath, model.line);
        // Link extension to base
        edges.push({
            from: moduleName,
            to: model.moduleName,
            label: 'inherits',
            color: '#e74c3c',
            width: 3,
            arrows: 'to',
            font: { align: 'middle', size: 10, color: '#94a3b8' }
        });
        currentLevel += 2;
    }

    const panel = vscode.window.createWebviewPanel(
        'odooModelInheritance',
        `Inheritance: ${modelName}`,
        vscode.ViewColumn.One,
        { enableScripts: true, retainContextWhenHidden: true }
    );

    panel.webview.html = getInheritanceGraphHtml(modelName, nodes, edges);

    panel.webview.onDidReceiveMessage(async (message) => {
        if (message.command === 'openFile') {
            const uri = vscode.Uri.file(message.filePath);
            const doc = await vscode.workspace.openTextDocument(uri);
            await vscode.window.showTextDocument(doc, {
                selection: new vscode.Range(message.line, 0, message.line, 0),
                viewColumn: vscode.ViewColumn.Beside
            });
        }
    });
}

function getInheritanceGraphHtml(modelName: string, nodes: any[], edges: any[]) {
    return `<!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <title>Odoo Architecture</title>
        <script type="text/javascript" src="https://unpkg.com/vis-network/standalone/umd/vis-network.min.js"></script>
        <link href="https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;600&family=JetBrains+Mono&display=swap" rel="stylesheet">
        <style>
            :root { --bg: #0f172a; --card: rgba(30, 41, 59, 0.8); --text: #f8fafc; --accent: #00d2ff; }
            body { margin: 0; background: var(--bg); color: var(--text); font-family: 'Outfit', sans-serif; overflow: hidden; height: 100vh; }
            #mynetwork { width: 100%; height: 100vh; }
            .ui { position: absolute; top: 20px; left: 20px; z-index: 100; pointer-events: none; }
            .glass { background: var(--card); backdrop-filter: blur(10px); border: 1px solid rgba(255,255,255,0.1); border-radius: 12px; padding: 15px; pointer-events: auto; }
            h1 { margin: 0; font-size: 1.1rem; color: var(--accent); }
            .legend { position: absolute; bottom: 20px; left: 20px; font-size: 0.75rem; }
            .legend-item { display: flex; align-items: center; margin-bottom: 4px; }
            .dot { width: 10px; height: 10px; border-radius: 2px; margin-right: 8px; }
            .instruction { position: absolute; bottom: 20px; right: 20px; font-size: 0.75rem; color: #94a3b8; }
        </style>
    </head>
    <body>
        <div class="ui"><div class="glass"><h1>${modelName}</h1><p style="margin:4px 0 0;font-size:0.8rem;color:#94a3b8">Clean Architecture View</p></div></div>
        <div class="legend glass">
            <div class="legend-item"><div class="dot" style="background:#e74c3c;border-radius:50%"></div> Base Module</div>
            <div class="legend-item"><div class="dot" style="background:#e67e22"></div> Extension</div>
            <div class="legend-item"><div class="dot" style="background:#2ecc71"></div> Fields Summary</div>
            <div class="legend-item"><div class="dot" style="background:#9b59b6"></div> Methods Summary</div>
        </div>
        <div class="instruction glass">Hover on Green/Purple for list • Double-click modules to jump to code</div>
        <div id="mynetwork"></div>

        <script>
            const vscode = acquireVsCodeApi();
            const rawNodes = ${JSON.stringify(nodes)};
            const rawEdges = ${JSON.stringify(edges)};

            const nodes = new vis.DataSet(rawNodes.map(n => {
                let p = { id: n.id, label: n.label, level: n.level, title: n.title, font: { color: '#ffffff', face: 'Outfit' } };
                if (n.group === 'module-base') { p = { ...p, shape: 'ellipse', color: '#e74c3c', size: 40, font: { size: 16, bold: true } }; }
                else if (n.group === 'module-ext') { p = { ...p, shape: 'box', color: '#e67e22', margin: 10, font: { size: 14 } }; }
                else if (n.group === 'fields-group') { p = { ...p, shape: 'dot', color: '#2ecc71', size: 12, font: { size: 11, face: 'JetBrains Mono' } }; }
                else if (n.group === 'funcs-group') { p = { ...p, shape: 'dot', color: '#9b59b6', size: 12, font: { size: 11, face: 'JetBrains Mono' } }; }
                return p;
            }));

            const options = {
                layout: { hierarchical: { direction: 'UD', sortMethod: 'directed', levelSeparation: 150, nodeSpacing: 250 } },
                physics: { enabled: true, hierarchicalRepulsion: { nodeDistance: 200 } },
                interaction: { hover: true, tooltipDelay: 100 }
            };
            const network = new vis.Network(document.getElementById('mynetwork'), { nodes, edges: new vis.DataSet(rawEdges) }, options);

            network.on("doubleClick", function (params) {
                if (params.nodes.length > 0) {
                    const node = rawNodes.find(r => r.id === params.nodes[0]);
                    if (node && node.filePath) vscode.postMessage({ command: 'openFile', filePath: node.filePath, line: node.line });
                }
            });
        </script>
    </body>
    </html>`;
}
