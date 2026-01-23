import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import moduleIndexService from '../services/moduleIndexService';

export async function handleShowDependencyGraph(uri: vscode.Uri): Promise<void> {
    if (!uri) {
        vscode.window.showErrorMessage('No folder selected.');
        return;
    }

    try {
        const stats = fs.statSync(uri.fsPath);
        if (!stats.isDirectory()) {
            vscode.window.showErrorMessage('Dependency Graph can only be generated for folders.');
            return;
        }

        const moduleName = path.basename(uri.fsPath);
        const manifestPath = path.join(uri.fsPath, '__manifest__.py');
        const manifestJsonPath = path.join(uri.fsPath, '__manifest__.json');

        if (!fs.existsSync(manifestPath) && !fs.existsSync(manifestJsonPath)) {
            vscode.window.showErrorMessage('The selected folder is not a valid Odoo module (missing __manifest__.py).');
            return;
        }

        vscode.window.withProgress({
            location: vscode.ProgressLocation.Notification,
            title: `Assista: Mapping dependencies for "${moduleName}"...`,
            cancellable: false
        }, async () => {
            const skeleton = await getModuleDependencySkeleton(moduleName);
            const { nodes, edges } = flattenDependencies(skeleton);

            const panel = vscode.window.createWebviewPanel(
                'odooDependencyGraph',
                `Dependency Graph: ${moduleName}`,
                vscode.ViewColumn.One,
                { enableScripts: true }
            );

            panel.webview.html = getGraphHtml(moduleName, nodes, edges);

            // Handle messages from the webview
            panel.webview.onDidReceiveMessage(async (message) => {
                if (message.command === 'download') {
                    const htmlContent = getGraphHtml(moduleName, nodes, edges);
                    const uri = await vscode.window.showSaveDialog({
                        defaultUri: vscode.Uri.file(`${moduleName}_dependency_graph.html`),
                        filters: { 'HTML': ['html'] }
                    });

                    if (uri) {
                        await vscode.workspace.fs.writeFile(uri, Buffer.from(htmlContent, 'utf8'));
                        vscode.window.showInformationMessage(`Graph saved to ${path.basename(uri.fsPath)}`);
                    }
                } else if (message.command === 'openModuleManifest') {
                    const moduleInfo = moduleIndexService.getModuleInfo(message.moduleName);
                    if (moduleInfo && moduleInfo.path) {
                        const manifestPath = path.join(moduleInfo.path, '__manifest__.py');
                        const manifestJsonPath = path.join(moduleInfo.path, '__manifest__.json');

                        let targetPath: string | undefined;
                        if (fs.existsSync(manifestPath)) {
                            targetPath = manifestPath;
                        } else if (fs.existsSync(manifestJsonPath)) {
                            targetPath = manifestJsonPath;
                        }

                        if (targetPath) {
                            const doc = await vscode.workspace.openTextDocument(vscode.Uri.file(targetPath));
                            await vscode.window.showTextDocument(doc, { viewColumn: vscode.ViewColumn.Beside });
                        }
                    }
                }
            });
        });

    } catch (error: any) {
        vscode.window.showErrorMessage(`Error checking module: ${error.message}`);
    }
}

function flattenDependencies(skeleton: any) {
    const nodesMap = new Map<string, any>();
    const edgesSet = new Set<string>();
    const processedModules = new Set<string>();

    function process(item: any) {
        if (!item || !item.moduleName) return;

        if (!nodesMap.has(item.moduleName)) {
            nodesMap.set(item.moduleName, {
                id: item.moduleName,
                label: item.moduleName,
                found: item.found !== false,
                icon: item.icon,
                isRoot: false
            });
        }

        // Only process dependencies once per module to avoid duplicate lines
        if (processedModules.has(item.moduleName)) return;
        processedModules.add(item.moduleName);

        if (item.dependsChart) {
            for (const [depName, depData] of Object.entries(item.dependsChart) as [string, any]) {
                edgesSet.add(JSON.stringify({ from: item.moduleName, to: depName }));
                process(depData);
            }
        }
    }

    process(skeleton);

    // Mark current module as root for styling
    if (nodesMap.has(skeleton.moduleName)) {
        nodesMap.get(skeleton.moduleName).isRoot = true;
    }

    return {
        nodes: Array.from(nodesMap.values()),
        edges: Array.from(edgesSet).map(e => JSON.parse(e))
    };
}

async function getModuleDependencySkeleton(moduleName: string, visited: Set<string> = new Set()): Promise<Record<string, any>> {
    const moduleIndexData = moduleIndexService.getModuleInfo(moduleName);

    if (visited.has(moduleName)) return { moduleName, circular: true };
    if (!moduleIndexData) return { moduleName, found: false };

    visited.add(moduleName);

    const icon = getModuleIcon(moduleIndexData.path);
    const depends = moduleIndexData.depends || [];
    const dependsChart: Record<string, any> = {};

    for (const depend of depends) {
        dependsChart[depend] = await getModuleDependencySkeleton(depend, new Set(visited));
    }

    return {
        moduleName,
        found: true,
        icon,
        dependsChart
    };
}

function getModuleIcon(modulePath: string): string | undefined {
    const iconPaths = [
        path.join(modulePath, 'static', 'description', 'icon.png'),
        path.join(modulePath, 'static', 'description', 'icon.svg')
    ];

    for (const iconPath of iconPaths) {
        if (fs.existsSync(iconPath)) {
            try {
                const ext = path.extname(iconPath).slice(1);
                const base64 = fs.readFileSync(iconPath).toString('base64');
                return `data:image/${ext === 'svg' ? 'svg+xml' : ext};base64,${base64}`;
            } catch (e) {
                return undefined;
            }
        }
    }
    return undefined;
}

function getGraphHtml(rootName: string, nodes: any[], edges: any[]) {
    return `<!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <title>Dependency Graph</title>
        <script type="text/javascript" src="https://unpkg.com/vis-network/standalone/umd/vis-network.min.js"></script>
        <style>
            body { 
                margin: 0; 
                padding: 0; 
                background-color: #1e1e1e; 
                color: #ffffff; 
                font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
                overflow: hidden;
            }
            #mynetwork {
                width: 100vw;
                height: 100vh;
                background-color: #1a1a1a;
            }
            .header {
                position: absolute;
                top: 20px;
                left: 20px;
                background: rgba(45, 45, 45, 0.8);
                padding: 15px 25px;
                border-radius: 12px;
                border: 1px solid #3d3d3d;
                backdrop-filter: blur(5px);
                z-index: 10;
                box-shadow: 0 8px 32px rgba(0,0,0,0.5);
            }
            .header h2 { margin: 0; font-size: 1.2rem; color: #7c4dff; }
            .header p { margin: 5px 0 0; font-size: 0.8rem; color: #aaa; }
            .download-btn {
                margin-top: 12px;
                background: #7c4dff;
                color: white;
                border: none;
                padding: 8px 16px;
                border-radius: 6px;
                cursor: pointer;
                font-size: 0.8rem;
                font-weight: 600;
                transition: background 0.2s;
            }
            .download-btn:hover {
                background: #651fff;
            }
            .legend {
                position: absolute;
                bottom: 20px;
                right: 20px;
                background: rgba(45, 45, 45, 0.8);
                padding: 10px 15px;
                border-radius: 8px;
                font-size: 0.8rem;
                z-index: 10;
            }
            .legend-item { display: flex; align-items: center; margin-bottom: 5px; }
            .dot { width: 10px; height: 10px; border-radius: 50%; margin-right: 8px; }
        </style>
    </head>
    <body>
        <div class="header">
            <h2>Odoo Dependency Graph</h2>
            <p>Module: <b>${rootName}</b></p>
            <button class="download-btn" id="downloadBtn">Download Standalone HTML</button>
        </div>
        
        <div class="legend">
            <div class="legend-item"><div class="dot" style="background: #7c4dff;"></div> Target Module</div>
            <div class="legend-item"><div class="dot" style="background: #2196f3;"></div> Direct/Indirect Dep</div>
            <div class="legend-item"><div class="dot" style="background: #f44336;"></div> Not in Workspace</div>
        </div>

        <div id="mynetwork"></div>

        <script type="text/javascript">
            const vscode = typeof acquireVsCodeApi !== 'undefined' ? acquireVsCodeApi() : null;

            // Handle Download in VS Code context
            if (vscode) {
                document.getElementById('downloadBtn').addEventListener('click', () => {
                    vscode.postMessage({ command: 'download' });
                });
            } else {
                // If opened as standalone HTML, hide the download button
                document.getElementById('downloadBtn').style.display = 'none';
            }

            const nodes = new vis.DataSet(${JSON.stringify(nodes.map(n => ({
        ...n,
        color: n.isRoot ? '#7c4dff' : (n.found ? '#2196f3' : '#f44336'),
        font: {
            color: '#ffffff',
            size: 14,
            face: 'Inter, Segoe UI',
            strokeWidth: 2,
            strokeColor: '#1a1a1a'
        },
        shape: n.icon ? 'circularImage' : 'dot',
        image: n.icon,
        size: n.isRoot ? 40 : 30,
        shadow: true,
        borderWidth: n.icon ? 3 : 1
    })))});

            const edges = new vis.DataSet(${JSON.stringify(edges.map(e => ({
        ...e,
        arrows: 'to',
        color: { color: '#555555', highlight: '#7c4dff', opacity: 0.6 },
        width: 1,
        smooth: {
            enabled: true,
            type: 'cubicBezier',
            forceDirection: 'none',
            roundness: 0.5
        }
    })))});

            const container = document.getElementById('mynetwork');
            const data = { nodes: nodes, edges: edges };
            const options = {
                physics: {
                    enabled: true,
                    barnesHut: {
                        gravitationalConstant: -10000,
                        centralGravity: 0.02,
                        springLength: 350,
                        springConstant: 0.04,
                        damping: 0.09,
                        avoidOverlap: 1
                    },
                    stabilization: {
                        enabled: true,
                        iterations: 1000,
                        updateInterval: 25
                    }
                },
                interaction: {
                    hover: true,
                    tooltipDelay: 200,
                    dragNodes: true,
                    zoomView: true,
                    dragView: true
                }
            };
            const network = new vis.Network(container, data, options);

            let isRotating = true;
            let rotationAngle = 0;
            const rotationSpeed = 0.001;

            function animationLoop() {
                if (isRotating && !network.physics.physicsEnabled) {
                    rotationAngle += rotationSpeed;
                    const cos = Math.cos(rotationAngle);
                    const sin = Math.sin(rotationAngle);
                    
                    const updates = nodes.get()
                        .filter(node => node.ox !== undefined)
                        .map(node => ({
                            id: node.id,
                            x: node.ox * cos - node.oy * sin,
                            y: node.ox * sin + node.oy * cos
                        }));
                    nodes.update(updates);
                }
                requestAnimationFrame(animationLoop);
            }

            // Stop the "orbiting" and drifting once the graph is settled
            network.once('stabilizationIterationsDone', function() {
                network.setOptions({ physics: { enabled: false } });
                network.fit();
                
                // Store initial stable positions as base coordinates for rotation (ox, oy)
                const positions = network.getPositions();
                nodes.getIds().forEach(id => {
                    nodes.update({ id: id, ox: positions[id].x, oy: positions[id].y });
                });
                
                animationLoop();
            });

            // Toggle rotation on click and handle node selection
            network.on('click', function(params) {
                isRotating = !isRotating;

                if (params.nodes.length > 0 && vscode) {
                    const nodeId = params.nodes[0];
                    vscode.postMessage({ 
                        command: 'openModuleManifest', 
                        moduleName: nodeId 
                    });
                }
            });

            // Re-enable physics briefly if a node is dragged
            network.on('dragStart', function() {
                network.setOptions({ physics: { enabled: true } });
            });
            network.on('dragEnd', function() {
                setTimeout(() => {
                    network.setOptions({ physics: { enabled: false } });
                    // Store new position as the new base for rotation
                    const positions = network.getPositions();
                    nodes.getIds().forEach(id => {
                        nodes.update({ id: id, ox: positions[id].x, oy: positions[id].y });
                    });
                    rotationAngle = 0; // Seamless transition from current drag position
                }, 1000);
            });
        </script>
    </body>
    </html>`;
}


