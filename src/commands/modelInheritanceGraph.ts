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

    // Helper to add a planet (module) and its satellites (members)
    const addPlanetarySystem = (mName: string, isBase: boolean, filePath?: string, line?: number) => {
        // Planet Node (Module)
        nodes.push({
            id: mName,
            label: mName,
            group: isBase ? 'base-planet' : 'ext-planet',
            filePath,
            line,
            mass: isBase ? 5 : 3,
            size: isBase ? 50 : 35
        });

        const mFields = allFields.filter(f => f.moduleName === mName && f.isInherited === !isBase);
        const mFunctions = allFunctions.filter(f => f.moduleName === mName && f.isInherited === !isBase);

        // Satellites (Fields)
        for (const f of mFields) {
            const fieldId = `${mName}_field_${f.fieldName}`;
            nodes.push({
                id: fieldId,
                label: f.fieldName,
                group: 'field-satellite',
                size: 10,
                filePath: f.filePath,
                line: f.line
            });
            edges.push({
                from: mName,
                to: fieldId,
                length: 80,
                width: 1,
                color: { color: 'rgba(46, 204, 113, 0.3)', highlight: '#2ecc71' },
                dashes: true
            });
        }

        // Satellites (Functions)
        for (const fn of mFunctions) {
            const funcId = `${mName}_func_${fn.functionName}`;
            nodes.push({
                id: funcId,
                label: `${fn.functionName}()`,
                group: 'func-satellite',
                size: 10,
                filePath: fn.filePath,
                line: fn.line
            });
            edges.push({
                from: mName,
                to: funcId,
                length: 100,
                width: 1,
                color: { color: 'rgba(155, 89, 182, 0.3)', highlight: '#9b59b6' },
                dashes: true
            });
        }
    };

    // 1. Central Planet
    const baseModel = allModels.find(m => !m.isInherited && m.moduleName === moduleName);
    addPlanetarySystem(moduleName, true, baseModel?.filePath, baseModel?.line);

    // 2. Outer Planets (Inheritance)
    for (const model of inheritanceModels) {
        addPlanetarySystem(model.moduleName, false, model.filePath, model.line);
        // Gravity link (Inheritance)
        edges.push({
            from: moduleName,
            to: model.moduleName,
            label: 'inherits',
            width: 4,
            length: 300,
            arrows: { to: { enabled: true, scaleFactor: 1 } },
            color: { color: '#e74c3c', highlight: '#ff7675' },
            font: { align: 'middle', size: 12, color: '#f8fafc', strokeWidth: 0 }
        });
    }

    const panel = vscode.window.createWebviewPanel(
        'odooModelInheritance',
        `Inheritance Galaxy: ${modelName}`,
        vscode.ViewColumn.One,
        { enableScripts: true, retainContextWhenHidden: true }
    );

    panel.webview.html = getInheritanceGalaxyHtml(modelName, nodes, edges);

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

function getInheritanceGalaxyHtml(modelName: string, nodes: any[], edges: any[]) {
    return `<!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <title>Odoo Inheritance Galaxy</title>
        <script type="text/javascript" src="https://unpkg.com/vis-network/standalone/umd/vis-network.min.js"></script>
        <link href="https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;600&family=JetBrains+Mono&display=swap" rel="stylesheet">
        <style>
            :root {
                --space-bg: #020617;
                --base-color: #f43f5e;
                --ext-color: #f59e0b;
                --field-color: #10b981;
                --func-color: #8b5cf6;
                --text: #f8fafc;
            }
            body { 
                margin: 0; background: var(--space-bg); color: var(--text); 
                font-family: 'Outfit', sans-serif; overflow: hidden; height: 100vh;
                background-image: radial-gradient(circle at 50% 50%, #1e1b4b 0%, #020617 100%);
                box-sizing: border-box;
            }
            *, *:before, *:after { box-sizing: border-box; }
            #mynetwork { width: 100%; height: 100vh; }
            .ui { position: absolute; top: 20px; left: 20px; z-index: 100; pointer-events: none; }
            .glass { 
                background: rgba(15, 23, 42, 0.6); backdrop-filter: blur(12px); 
                border: 1px solid rgba(255, 255, 255, 0.05); border-radius: 16px; 
                padding: 24px; box-shadow: 0 8px 32px rgba(0,0,0,0.5); pointer-events: auto;
            }
            h1 { margin: 0; font-size: 1.5rem; font-weight: 600; color: #60a5fa; letter-spacing: -0.02em; }
            .legend { position: absolute; bottom: 30px; left: 30px; font-size: 0.85rem; }
            .legend-item { display: flex; align-items: center; margin-bottom: 8px; }
            .dot { width: 14px; height: 14px; border-radius: 50%; margin-right: 12px; }
            .instruction { position: absolute; bottom: 30px; right: 30px; font-size: 0.8rem; color: #94a3b8; }
            
            /* Search Styles */
            .search-box {
                margin-top: 16px;
                pointer-events: auto;
                position: relative;
            }
            #node-search {
                width: 100%;
                background: rgba(255, 255, 255, 0.05);
                border: 1px solid rgba(255, 255, 255, 0.1);
                border-radius: 8px;
                padding: 10px 16px;
                color: #f8fafc;
                font-family: inherit;
                font-size: 0.9rem;
                outline: none;
                transition: all 0.2s;
            }
            #node-search:focus {
                background: rgba(255, 255, 255, 0.08);
                border-color: #60a5fa;
                box-shadow: 0 0 10px rgba(96, 165, 250, 0.3);
            }
            #search-results {
                position: absolute;
                top: calc(100% + 8px);
                left: 0;
                right: 0;
                background: #1e293b;
                border: 1px solid rgba(255, 255, 255, 0.1);
                border-radius: 8px;
                max-height: 250px;
                overflow-y: auto;
                display: none;
                z-index: 1000;
                box-shadow: 0 10px 25px rgba(0,0,0,0.5);
            }
            .search-item {
                padding: 10px 16px;
                cursor: pointer;
                border-bottom: 1px solid rgba(255, 255, 255, 0.05);
                display: flex;
                align-items: center;
                gap: 10px;
                transition: background 0.1s;
            }
            .search-item:last-child { border-bottom: none; }
            .search-item:hover { background: rgba(96, 165, 250, 0.15); }
            .search-item-type {
                font-size: 0.7rem;
                padding: 2px 6px;
                border-radius: 4px;
                text-transform: uppercase;
                letter-spacing: 0.05em;
                font-weight: 600;
                min-width: 60px;
                text-align: center;
            }
            .type-field { background: rgba(16, 185, 129, 0.2); color: #10b981; }
            .type-func { background: rgba(139, 92, 246, 0.2); color: #8b5cf6; }
            .type-module { background: rgba(244, 63, 94, 0.2); color: #f43f5e; }
        </style>
    </head>
    <body>
        <div class="ui">
            <div class="glass">
                <h1>Model Inheritance Graph: ${modelName}</h1>
                <p style="margin: 8px 0 0; color: #94a3b8; font-size: 0.9rem;">Hierarchical visualization of Odoo modules and their members.</p>
                
                <div class="search-box">
                    <input type="text" id="node-search" placeholder="Search fields or functions..." autocomplete="off">
                    <div id="search-results"></div>
                </div>
            </div>
        </div>

        <div class="legend glass">
            <div class="legend-item"><div class="dot" style="background: var(--base-color); box-shadow: 0 0 15px var(--base-color);"></div> Base Module</div>
            <div class="legend-item"><div class="dot" style="background: var(--ext-color); box-shadow: 0 0 15px var(--ext-color);"></div> Extension Module</div>
            <div class="legend-item"><div class="dot" style="background: var(--field-color);"></div> Field</div>
            <div class="legend-item"><div class="dot" style="background: var(--func-color);"></div> Function</div>
        </div>

        <div class="instruction glass">Drag to navigate • Scroll to zoom • Double-click any node to open code</div>

        <div id="mynetwork"></div>

        <script>
            const vscode = acquireVsCodeApi();
            const rawNodes = ${JSON.stringify(nodes)};
            const rawEdges = ${JSON.stringify(edges)};

            const nodes = new vis.DataSet(rawNodes.map(n => {
                let p = { 
                    id: n.id, 
                    label: n.label, 
                    size: n.size,
                    font: { color: '#ffffff', face: 'Outfit', size: 14, strokeWidth: 3, strokeColor: '#020617' }
                };

                if (n.group === 'base-planet') {
                    p = { ...p, shape: 'dot', color: { background: '#f43f5e', border: '#fff' }, shadow: { enabled: true, color: '#f43f5e', size: 25 }, font: { ...p.font, size: 18, bold: true } };
                } else if (n.group === 'ext-planet') {
                    p = { ...p, shape: 'dot', color: { background: '#f59e0b', border: '#fff' }, shadow: { enabled: true, color: '#f59e0b', size: 15 }, font: { ...p.font, size: 15 } };
                } else if (n.group === 'field-satellite') {
                    p = { ...p, shape: 'dot', color: '#10b981', font: { ...p.font, size: 11, face: 'JetBrains Mono', color: '#2ecc71' } };
                } else if (n.group === 'func-satellite') {
                    p = { ...p, shape: 'dot', color: '#a29bfe', font: { ...p.font, size: 11, face: 'JetBrains Mono', color: '#a29bfe' } };
                }
                return p;
            }));

            const options = {
                physics: {
                    enabled: true,
                    forceAtlas2Based: {
                        gravitationalConstant: -150,
                        centralGravity: 0.015,
                        springLength: 100,
                        springConstant: 0.08,
                        damping: 0.4,
                        avoidOverlap: 1
                    },
                    solver: 'forceAtlas2Based',
                    stabilization: { iterations: iterations => iterations > 100 }
                },
                edges: {
                    smooth: { type: 'continuous', forceDirection: 'none' }
                },
                interaction: { 
                    hover: true, 
                    tooltipDelay: 100,
                    hideEdgesOnDrag: true 
                }
            };

            const network = new vis.Network(document.getElementById('mynetwork'), { nodes, edges: new vis.DataSet(rawEdges) }, options);

            // Search Logic
            const searchInput = document.getElementById('node-search');
            const searchResults = document.getElementById('search-results');

            searchInput.addEventListener('input', function() {
                const query = this.value.toLowerCase().trim();
                searchResults.innerHTML = '';
                
                if (query.length < 2) {
                    searchResults.style.display = 'none';
                    return;
                }

                const matches = rawNodes.filter(n => n.label.toLowerCase().includes(query));
                
                if (matches.length > 0) {
                    searchResults.style.display = 'block';
                    matches.forEach(match => {
                        let typeLabel = 'Field';
                        let typeClass = 'type-field';
                        if (match.group?.includes('func')) { typeLabel = 'Method'; typeClass = 'type-func'; }
                        else if (match.group?.includes('planet')) { typeLabel = 'Module'; typeClass = 'type-module'; }

                        const div = document.createElement('div');
                        div.className = 'search-item';
                        div.innerHTML = '<span class="search-item-type ' + typeClass + '">' + typeLabel + '</span><span>' + match.label + '</span>';
                        div.onclick = () => {
                            network.focus(match.id, { 
                                scale: 2.0,
                                animation: { duration: 1000, easingFunction: 'easeInOutQuad' } 
                            });
                            network.selectNodes([match.id]);
                            searchResults.style.display = 'none';
                            searchInput.value = match.label;
                        };
                        searchResults.appendChild(div);
                    });
                } else {
                    searchResults.style.display = 'none';
                }
            });

            // Close search results when clicking outside
            document.addEventListener('click', (e) => {
                if (!e.target.closest('.search-box')) {
                    searchResults.style.display = 'none';
                }
            });

            network.on("doubleClick", function (params) {
                if (params.nodes.length > 0) {
                    const node = rawNodes.find(r => r.id === params.nodes[0]);
                    if (node && node.filePath) {
                        vscode.postMessage({ command: 'openFile', filePath: node.filePath, line: node.line });
                    }
                }
            });
        </script>
    </body>
    </html>`;
}
