import * as vscode from 'vscode';
import * as path from 'path';

export interface ModuleInfo {
    id: number;
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

    public async reindex(progress?: vscode.Progress<{ message?: string; increment?: number }>) {
        this.moduleCache.clear();

        // Find all manifest files, excluding common non-Odoo directories
        const manifestFiles = await vscode.workspace.findFiles('**/{__manifest__.py,__openerp__.py}', '**/{node_modules,venv,.venv,__pycache__,dist,out,build}/**');
        const totalManifests = manifestFiles.length;
        let counter = 1;

        for (const manifestUri of manifestFiles) {
            if (progress) {
                progress.report({
                    message: `Checking Modules: ${counter}/${totalManifests} (${path.basename(path.dirname(manifestUri.fsPath))})`,
                    increment: (1 / totalManifests) * 100
                });
            }
            counter++;
            const moduleDir = path.dirname(manifestUri.fsPath);
            const initFileUri = vscode.Uri.file(path.join(moduleDir, '__init__.py'));

            try {
                // Check if __init__.py exists in the same directory
                await vscode.workspace.fs.stat(initFileUri);
                const moduleName = path.basename(moduleDir);
                this.moduleCache.set(moduleName, {
                    id: counter++,
                    name: moduleName,
                    path: moduleDir
                });
            } catch (error) {
                // __init__.py doesn't exist, not a valid Odoo module
            }
        }
        console.log(`[ModuleIndex] Indexed ${this.moduleCache.size} Odoo modules.`);
    }

    public async getModules(progress?: vscode.Progress<{ message?: string; increment?: number }>): Promise<ModuleInfo[]> {
        if (this.moduleCache.size === 0) {
            await this.reindex(progress);
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
