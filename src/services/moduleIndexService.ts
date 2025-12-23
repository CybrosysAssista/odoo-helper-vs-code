import * as vscode from 'vscode';
import * as path from 'path';

export interface ModuleInfo {
    name: string;
    path: string;
}

class ModuleIndexService {
    private moduleCache: Map<string, ModuleInfo> = new Map();
    private watcher: vscode.FileSystemWatcher | null = null;

    constructor() { }

    public initialize() {
        this.watcher = vscode.workspace.createFileSystemWatcher('**/{__manifest__.py,__openerp__.py,__init__.py}');
        this.watcher.onDidChange(() => this.reindex());
        this.watcher.onDidCreate(() => this.reindex());
        this.watcher.onDidDelete(() => this.reindex());
    }

    public async reindex() {
        this.moduleCache.clear();

        // Find all manifest files
        const manifestFiles = await vscode.workspace.findFiles('**/{__manifest__.py,__openerp__.py}', '**/node_modules/**');

        for (const manifestUri of manifestFiles) {
            const moduleDir = path.dirname(manifestUri.fsPath);
            const initFileUri = vscode.Uri.file(path.join(moduleDir, '__init__.py'));

            try {
                // Check if __init__.py exists in the same directory
                await vscode.workspace.fs.stat(initFileUri);
                const moduleName = path.basename(moduleDir);
                this.moduleCache.set(moduleName, {
                    name: moduleName,
                    path: moduleDir
                });
            } catch (error) {
                // __init__.py doesn't exist, not a valid Odoo module
            }
        }
        console.log(`[ModuleIndex] Indexed ${this.moduleCache.size} Odoo modules.`);
    }

    public async getModules(): Promise<ModuleInfo[]> {
        if (this.moduleCache.size === 0) {
            await this.reindex();
        }
        return Array.from(this.moduleCache.values());
    }

    public async getModuleNames(): Promise<string[]> {
        const modules = await this.getModules();
        return modules.map(m => m.name).sort();
    }

    public getModulePath(name: string): string | undefined {
        return this.moduleCache.get(name)?.path;
    }

    public dispose() {
        if (this.watcher) {
            this.watcher.dispose();
        }
    }
}

const moduleIndexService = new ModuleIndexService();
export default moduleIndexService;
