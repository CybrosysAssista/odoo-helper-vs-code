"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
const vscode = __importStar(require("vscode"));
const path = __importStar(require("path"));
const fs = __importStar(require("fs"));
class TemplateIndexService {
    templateCache;
    watcher;
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
    async buildCache(progress) {
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
            }
            catch (err) {
                // Ignore file read errors
            }
            if (filesProcessed % 50 === 0) {
                await new Promise(resolve => setTimeout(resolve, 5));
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
        if (!moduleName)
            return;
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
            }
            else {
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
exports.default = templateIndexService;
//# sourceMappingURL=templateIndexService.js.map