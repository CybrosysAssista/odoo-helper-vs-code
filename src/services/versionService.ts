import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';

export type OdooVersion = '18' | '19' | '20';

/** Versions with their own completions, snippets and templates, oldest first. */
export const SUPPORTED_VERSIONS: readonly OdooVersion[] = ['18', '19', '20'];
export const LATEST_VERSION: OdooVersion = '20';

/** The supported version whose data fits Odoo `major`: older majors get the oldest, newer the latest. */
export function toSupportedVersion(major: number): OdooVersion {
    if (major >= Number(LATEST_VERSION)) return LATEST_VERSION;
    const exact = SUPPORTED_VERSIONS.find(v => Number(v) === major);
    return exact ?? SUPPORTED_VERSIONS[0];
}

/** Picks the value for `version` (falling back to the latest for anything unexpected). */
export function byVersion<T>(version: string, values: Record<OdooVersion, T>): T {
    return values[(SUPPORTED_VERSIONS as readonly string[]).includes(version) ? version as OdooVersion : LATEST_VERSION];
}

/** Whether `version` is `min` or newer. */
export function isAtLeast(version: string, min: OdooVersion): boolean {
    return Number(version) >= Number(min);
}

function parseReleasePy(text: string): string | null {
    // version_info = (20, 0, 0, FINAL, 0, '') or, on SaaS branches, ('saas~19', 1, 0, ...)
    const m = text.match(/version_info\s*=\s*\(\s*(?:(\d+)|['"]saas~(\d+)['"])\s*,/);
    if (!m) return null;
    return toSupportedVersion(Number(m[1] ?? m[2]));
}

async function findInWorkspace(): Promise<string | null> {
    try {
        const uris = await vscode.workspace.findFiles('**/odoo/release.py', '**/{.venv,venv,node_modules,env,.env,__pycache__}/**', 1);
        if (uris && uris[0]) {
            const content = await vscode.workspace.fs.readFile(uris[0]);
            return parseReleasePy(Buffer.from(content).toString('utf8'));
        }
    } catch (_) { }
    return null;
}

function readFromPath(candidatePath: string): string | null {
    try {
        const text = fs.readFileSync(candidatePath, 'utf8');
        return parseReleasePy(text);
    } catch (_) {
        return null;
    }
}

async function detectFromKnownPaths(): Promise<string | null> {
    const cfg = vscode.workspace.getConfiguration('cybrosys-assista-odoo-helper');
    const manualRoot = cfg.get<string>('odooSourcePath', '');
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

async function detectFromRequirements(): Promise<string | null> {
    try {
        const reqs = await vscode.workspace.findFiles('**/requirements*.{txt,in,ini}', '**/{.venv,venv,node_modules,env,.env}/**', 5);
        for (const uri of reqs) {
            const buf = await vscode.workspace.fs.readFile(uri);
            const text = Buffer.from(buf).toString('utf8');
            const m = text.match(/odoo[^=\n]*[=><~!]+\s*(\d{2})/i);
            if (m) return toSupportedVersion(Number(m[1]));
        }
    } catch (_) { }
    return null;
}

let cachedVersion: string | null = null;
let detecting: Promise<string> | null = null;

export function clearCache() {
    cachedVersion = null;
}

export async function getOdooVersion(): Promise<string> {
    const cfg = vscode.workspace.getConfiguration('cybrosys-assista-odoo-helper');
    const setting = String(cfg.get('odooVersion', 'auto'));
    // If manually set, always return the manual setting (don't use cache)
    if ((SUPPORTED_VERSIONS as readonly string[]).includes(setting)) {
        // Clear cache when switching to manual mode to ensure fresh detection if switched back to auto
        if (cachedVersion && cachedVersion !== setting) {
            cachedVersion = null;
        }
        return setting;
    }

    // For 'auto' mode, use cache if available, otherwise detect (once, even if asked concurrently)
    if (cachedVersion) return cachedVersion;
    detecting ??= (async () => {
        let v = await findInWorkspace();
        if (!v) v = await detectFromKnownPaths();
        if (!v) v = await detectFromRequirements();
        return v || LATEST_VERSION;
    })().finally(() => detecting = null);
    cachedVersion = await detecting;
    return cachedVersion;
}



