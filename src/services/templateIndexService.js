const vscode = require('vscode');
const path = require('path');
const fs = require('fs');

class TemplateIndexService {
    constructor() {
        this.templateCache = new Set();
        this.watcher = null;
    }

    initialize() {
        // Watch for XML file changes to invalidate cache
        this.watcher = vscode.workspace.createFileSystemWatcher('**/*.xml');
        this.watcher.onDidChange(this.buildCache.bind(this));
        this.watcher.onDidCreate(this.buildCache.bind(this));
        this.watcher.onDidDelete(this.buildCache.bind(this));
        this.buildCache();
    }

    async buildCache() {
        this.templateCache.clear();
        const xmlFiles = await vscode.workspace.findFiles('**/*.xml');
        for (const file of xmlFiles) {
            try {
                const content = await vscode.workspace.fs.readFile(file);
                const text = Buffer.from(content).toString('utf8');
                const moduleName = await this.getModuleNameForFile(file.fsPath);
                this.extractTemplates(text, moduleName);
            } catch (err) {
                // Ignore file read errors
            }
        }
    }

    // Find the module name by walking up to the directory containing __manifest__.py
    async getModuleNameForFile(filePath) {
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

    extractTemplates(xmlText, moduleName) {
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

    getAllTemplates() {
        return Array.from(this.templateCache);
    }
}

// Singleton instance
const templateIndexService = new TemplateIndexService();

module.exports = templateIndexService; 