import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';

export interface OdooModule {
    name: string;
    path: string;
}

class ModuleIndexService {
    private moduleCache: Map<string, OdooModule> = new Map();
    private watcher: vscode.FileSystemWatcher | null = null;
    private isIndexing: boolean = false;

    /**
     * Start the service and setup watchers
     */
    initialize() {
        this.watcher = vscode.workspace.createFileSystemWatcher('**/__manifest__.py');
        this.watcher.onDidChange(() => this.buildCache());
        this.watcher.onDidCreate(() => this.buildCache());
        this.watcher.onDidDelete(() => this.buildCache());

        // Initial build
        this.buildCache();
    }

    /**
     * Perform the optimized walk across all workspace folders
     */
    async buildCache() {
        if (this.isIndexing) return;
        this.isIndexing = true;

        try {
            this.moduleCache.clear();
            const workspaceFolders = vscode.workspace.workspaceFolders;
            if (!workspaceFolders) return;

            for (const folder of workspaceFolders) {
                this.walk(folder.uri.fsPath);
            }
            console.log(`[ModuleIndex] Indexed ${this.moduleCache.size} Odoo modules.`);
        } finally {
            this.isIndexing = false;
        }
    }

    /**
     * Optimized directory walker
     * Stops recursion once a module is found
     */
    private walk(dir: string) {
        try {
            const files = fs.readdirSync(dir);

            const hasInit = files.includes('__init__.py');
            const hasManifest = files.includes('__manifest__.py') || files.includes('__openerp__.py');

            // If it's a valid module, store it and STOP going deeper
            if (hasInit && hasManifest) {
                const moduleName = path.basename(dir);
                this.moduleCache.set(moduleName, {
                    name: moduleName,
                    path: dir
                });
                return;
            }

            // If not a module, continue searching subdirectories
            for (const file of files) {
                if (file.startsWith('.') || file === 'node_modules' || file === 'venv' || file === '__pycache__') {
                    continue;
                }

                const fullPath = path.join(dir, file);
                try {
                    const stats = fs.statSync(fullPath);
                    if (stats.isDirectory()) {
                        this.walk(fullPath);
                    }
                } catch (e) {
                    // Skip inaccessible files
                }
            }
        } catch (e) {
            // Skip inaccessible directories
        }
    }

    /**
     * Retrieve all indexed modules
     */
    getModules(): OdooModule[] {
        return Array.from(this.moduleCache.values());
    }

    /**
     * Retrieve a specific module by name
     */
    getModule(name: string): OdooModule | undefined {
        return this.moduleCache.get(name);
    }

    /**
     * Dispose the watcher
     */
    dispose() {
        this.watcher?.dispose();
    }
}

export const moduleIndexService = new ModuleIndexService();
export default moduleIndexService;
