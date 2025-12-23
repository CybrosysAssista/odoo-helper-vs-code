import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';

class TemplateIndexService {
    private templateCache: Set<string>;
    private watcher: vscode.FileSystemWatcher | null;

    constructor() {
        this.templateCache = new Set();
        this.watcher = null;
    }

    initialize() {
        // Watch for XML file changes to invalidate cache
        this.watcher = vscode.workspace.createFileSystemWatcher('**/*.xml');
        this.watcher.onDidChange(() => this.buildCache());
        this.watcher.onDidCreate(() => this.buildCache());
        this.watcher.onDidDelete(() => this.buildCache());
    }

    async buildCache(progress?: vscode.Progress<{ message?: string; increment?: number }>) {
        this.templateCache.clear();
        // Exclude common non-Odoo directories
        const xmlFiles = await vscode.workspace.findFiles('**/*.xml', '**/{node_modules,venv,.venv,__pycache__,dist,out,build}/**');
        const totalFiles = xmlFiles.length;
        let filesProcessed = 0;

        for (const file of xmlFiles) {
            filesProcessed++;
            if (progress) {
                progress.report({
                    message: `Indexing Templates: ${filesProcessed}/${totalFiles} (${path.basename(file.fsPath)})`,
                    increment: (1 / totalFiles) * 100
                });
            }

            try {
                const content = await vscode.workspace.fs.readFile(file);
                const text = Buffer.from(content).toString('utf8');
                const moduleName = await this.getModuleNameForFile(file.fsPath);
                this.extractTemplates(text, moduleName);
            } catch (err) {
                // Ignore file read errors
            }

            if (filesProcessed % 50 === 0) {
                await new Promise(resolve => setTimeout(resolve, 5));
            }
        }
    }

    // Find the module name by walking up to the directory containing __manifest__.py
    async getModuleNameForFile(filePath: string): Promise<string | null> {
        let dir = path.dirname(filePath);
        let lastDir = null;
        while (dir !== lastDir) {
            if (fs.existsSync(path.join(dir, '__manifest__.py'))) {
                return path.basename(dir);
            }
            lastDir = dir;
            dir = path.dirname(dir);
        }
        return null;
    }

    extractTemplates(xmlText: string, moduleName: string | null) {
        if (!moduleName) return;
        // <template id="..." ...>
        const templateIdRegex = /<template[^>]*id=["']([^"']+)["']/g;
        let match;
        while ((match = templateIdRegex.exec(xmlText)) !== null) {
            this.templateCache.add(`${moduleName}.${match[1]}`);
        }
        // <t t-name="..." ...>
        const tNameRegex = /<t[^>]*t-name=["']([^"']+)["']/g;
        while ((match = tNameRegex.exec(xmlText)) !== null) {
            const tName = match[1];
            if (tName.includes('.')) {
                this.templateCache.add(tName);
            } else {
                this.templateCache.add(`${moduleName}.${tName}`);
            }
        }
    }

    getAllTemplates(): string[] {
        return Array.from(this.templateCache);
    }
}

// Singleton instance
const templateIndexService = new TemplateIndexService();

export default templateIndexService;
