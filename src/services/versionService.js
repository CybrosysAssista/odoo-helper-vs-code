const vscode = require('vscode');
const fs = require('fs');
const path = require('path');

function parseReleasePy(text) {
    const m = text.match(/version_info\s*=\s*\(\s*(\d+)\s*,\s*(\d+)\s*,/);
    if (!m) return null;
    const major = m[1];
    return major === '19' ? '19' : '18';
}

async function findInWorkspace() {
    try {
        const uris = await vscode.workspace.findFiles('**/odoo/release.py', '**/{.venv,venv,node_modules,env,.env,__pycache__}/**', 1);
        if (uris && uris[0]) {
            const content = await vscode.workspace.fs.readFile(uris[0]);
            return parseReleasePy(Buffer.from(content).toString('utf8'));
        }
    } catch (_) { }
    return null;
}

function readFromPath(candidatePath) {
    try {
        const text = fs.readFileSync(candidatePath, 'utf8');
        return parseReleasePy(text);
    } catch (_) {
        return null;
    }
}

async function detectFromKnownPaths() {
    const cfg = vscode.workspace.getConfiguration('cybrosys-assista-odoo-helper');
    const manualRoot = cfg.get('odooSourcePath', '');
    if (manualRoot) {
        const p = path.join(manualRoot, 'odoo', 'release.py');
        const v = readFromPath(p);
        if (v) return v;
    }
    const envRoot = process.env.ODOO_HOME;
    if (envRoot) {
        const p = path.join(envRoot, 'odoo', 'release.py');
        const v = readFromPath(p);
        if (v) return v;
    }
    return null;
}

async function detectFromRequirements() {
    try {
        const reqs = await vscode.workspace.findFiles('**/requirements*.{txt,in,ini}', '**/{.venv,venv,node_modules,env,.env}/**', 5);
        for (const uri of reqs) {
            const buf = await vscode.workspace.fs.readFile(uri);
            const text = Buffer.from(buf).toString('utf8');
            if (/odoo[^=\n]*[=><~!]+\s*19/i.test(text)) return '19';
            if (/odoo[^=\n]*[=><~!]+\s*18/i.test(text)) return '18';
        }
    } catch (_) { }
    return null;
}

let cachedVersion = null;

function clearCache() {
    cachedVersion = null;
}

async function getOdooVersion() {
    const cfg = vscode.workspace.getConfiguration('cybrosys-assista-odoo-helper');
    const setting = String(cfg.get('odooVersion', 'auto'));
    // If manually set, always return the manual setting (don't use cache)
    if (['18','19'].includes(setting)) {
        // Clear cache when switching to manual mode to ensure fresh detection if switched back to auto
        if (cachedVersion && cachedVersion !== setting) {
            cachedVersion = null;
        }
        return setting;
    }

    // For 'auto' mode, use cache if available, otherwise detect
    if (cachedVersion) return cachedVersion;
    let v = await findInWorkspace();
    if (!v) v = await detectFromKnownPaths();
    if (!v) v = await detectFromRequirements();
    cachedVersion = v || '19';
    return cachedVersion;
}

module.exports = { getOdooVersion, clearCache };


