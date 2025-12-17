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
class ModelIndexService {
    modelCache;
    fieldCache;
    watcher;
    constructor() {
        this.modelCache = new Map();
        this.fieldCache = new Map();
        this.watcher = null;
    }
    initialize() {
        // Watch for file changes to invalidate cache
        this.watcher = vscode.workspace.createFileSystemWatcher('**/*.py');
        this.watcher.onDidChange(this.invalidateCache.bind(this));
        this.watcher.onDidCreate(this.invalidateCache.bind(this));
        this.watcher.onDidDelete(this.invalidateCache.bind(this));
    }
    async buildCache() {
        const pythonFiles = await vscode.workspace.findFiles('**/*.py');
        for (const file of pythonFiles) {
            const content = await vscode.workspace.fs.readFile(file);
            const text = Buffer.from(content).toString('utf8');
            // Parse Python file for models and fields
            this.parsePythonFile(text, file.fsPath);
        }
    }
    parsePythonFile(content, filePath) {
        // Extract model definitions
        const modelRegex = /class\s+(\w+)\s*\([^)]*Model[^)]*\)[^{]*{([^}]*)}/gs;
        let match;
        while ((match = modelRegex.exec(content)) !== null) {
            const className = match[1];
            const classContent = match[2];
            // Extract model name
            const nameMatch = /_name\s*=\s*['"]([^'"]+)['"]/.exec(classContent);
            if (nameMatch) {
                const modelName = nameMatch[1];
                this.modelCache.set(modelName, {
                    name: modelName,
                    className: className,
                    filePath: filePath
                });
                // Extract fields
                const fieldRegex = /(\w+)\s*=\s*fields\./g;
                let fieldMatch;
                const fields = [];
                while ((fieldMatch = fieldRegex.exec(classContent)) !== null) {
                    fields.push(fieldMatch[1]);
                }
                this.fieldCache.set(modelName, fields);
            }
        }
    }
    getModel(modelName) {
        return this.modelCache.get(modelName);
    }
    getFields(modelName) {
        return this.fieldCache.get(modelName) || [];
    }
    getAllModels() {
        return Array.from(this.modelCache.keys());
    }
    // New: Get all Odoo module names by scanning for __manifest__.py
    async getAllModuleNames() {
        const moduleNames = new Set();
        const manifestFiles = await vscode.workspace.findFiles('**/__manifest__.py');
        for (const file of manifestFiles) {
            const moduleName = path.basename(path.dirname(file.fsPath));
            moduleNames.add(moduleName);
        }
        return Array.from(moduleNames).sort();
    }
    invalidateCache() {
        this.modelCache.clear();
        this.fieldCache.clear();
        this.buildCache();
    }
    dispose() {
        if (this.watcher) {
            this.watcher.dispose();
        }
    }
}
// Singleton instance
const modelIndexService = new ModelIndexService();
exports.default = modelIndexService;
//# sourceMappingURL=modelIndexService.js.map