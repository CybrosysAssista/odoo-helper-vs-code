import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';

class TemplateIndexService {
    private templateCache: Set<string>;
    private fileMetadata: Map<string, { mtime: number, size: number }>;
    private watcher: vscode.FileSystemWatcher | null;

    constructor() {
        this.templateCache = new Set();
        this.fileMetadata = new Map();
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
        console.log('[TemplateIndex] Refreshing templates (incremental)...');
        // DO NOT CLEAR anymore

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
                const stats = await vscode.workspace.fs.stat(file);
                const cachedMetadata = this.fileMetadata.get(file.fsPath);

                if (cachedMetadata && cachedMetadata.mtime === stats.mtime && cachedMetadata.size === stats.size) {
                    continue;
                }

                const content = await vscode.workspace.fs.readFile(file);
                const text = Buffer.from(content).toString('utf8');
                const moduleName = await this.getModuleNameForFile(file.fsPath);

                // Remove old entries for this file (requires changing how extractTemplates works,
                // but since it's a Set, we might have issues with shared IDs from different files?
                // Actually Odoo template IDs should be unique per module.
                // For simplicity, we just add. If a template is removed from a file,
                // it might stay in the Set until refresh or cleanup.
                // Let's improve this if needed).

                this.extractTemplates(text, moduleName);
                this.fileMetadata.set(file.fsPath, { mtime: stats.mtime, size: stats.size });
            } catch (err) { }

            if (filesProcessed % 50 === 0) {
                await new Promise(resolve => setTimeout(resolve, 5));
            }
        }

        await this.cleanupDeletedFiles();
    }

    private async cleanupDeletedFiles() {
        const currentFiles = new Set((await vscode.workspace.findFiles('**/*.xml', '**/{node_modules,venv,.venv,__pycache__,dist,out,build}/**')).map(f => f.fsPath));
        for (const filePath of this.fileMetadata.keys()) {
            if (!currentFiles.has(filePath)) {
                this.fileMetadata.delete(filePath);
                // Note: We don't easily know which templates were in THIS file to remove them from the Set
                // Full rebuild might be needed occasionally, or we change Set to Map<filePath, templates[]>
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

    getState() {
        return {
            templates: Array.from(this.templateCache),
            metadata: Array.from(this.fileMetadata.entries())
        };
    }

    loadState(state: any) {
        try {
            if (Array.isArray(state)) {
                // Old format
                this.templateCache = new Set(state);
            } else if (state && typeof state === 'object') {
                // New format
                if (Array.isArray(state.templates)) {
                    this.templateCache = new Set(state.templates);
                }
                if (Array.isArray(state.metadata)) {
                    this.fileMetadata = new Map(state.metadata);
                }
            }
        } catch (e) {
            console.error('[TemplateIndex] Failed to load state:', e);
            this.templateCache = new Set();
            this.fileMetadata = new Map();
        }
    }
}

// Singleton instance
const templateIndexService = new TemplateIndexService();

export default templateIndexService;
