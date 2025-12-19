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
const pythonParserService_1 = require("./pythonParserService");
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
            try {
                const content = await vscode.workspace.fs.readFile(file);
                const text = Buffer.from(content).toString('utf8');
                await this.parsePythonFile(text, file.fsPath);
            }
            catch (err) {
                console.error(`Error reading ${file.fsPath}:`, err);
            }
        }
    }
    getModuleNameForFile(filePath) {
        let dir = path.dirname(filePath);
        let lastDir = null;
        while (dir !== lastDir) {
            if (fs.existsSync(path.join(dir, '__manifest__.py')) || fs.existsSync(path.join(dir, '__openerp__.py'))) {
                return path.basename(dir);
            }
            lastDir = dir;
            dir = path.dirname(dir);
        }
        return 'unknown';
    }
    async parsePythonFile(content, filePath) {
        const parserService = (0, pythonParserService_1.getPythonParserService)();
        if (!parserService.isInitialized())
            return;
        const tree = parserService.parse(content);
        if (!tree)
            return;
        // Query for class definitions
        const root = tree.rootNode;
        const classes = this.findNodesByType(root, 'class_definition');
        for (const classNode of classes) {
            const classNameNode = classNode.childForFieldName('name');
            const className = classNameNode?.text || 'Unknown';
            const body = classNode.childForFieldName('body');
            if (!body)
                continue;
            // Extract assignments within the class body
            const assignments = this.findNodesByType(body, 'assignment');
            let modelName = null;
            let hasInherit = false;
            const fields = [];
            for (const assign of assignments) {
                const left = assign.childForFieldName('left')?.text;
                const right = assign.childForFieldName('right');
                const rightText = right?.text || "";
                if (left === '_name') {
                    modelName = rightText.replace(/['"]/g, '');
                }
                else if (left === '_inherit') {
                    hasInherit = true;
                    // If _name is missing, Odoo uses _inherit as the model name
                    if (!modelName) {
                        modelName = rightText.replace(/['"\[\]]/g, '').split(',')[0].trim();
                    }
                }
                else if (rightText.includes('fields.')) {
                    // Basic check for field assignments
                    if (left)
                        fields.push(left);
                }
            }
            if (modelName) {
                const hasBoth = assignments.some(a => a.childForFieldName('left')?.text === '_name') &&
                    assignments.some(a => a.childForFieldName('left')?.text === '_inherit');
                this.modelCache.set(modelName, {
                    name: modelName,
                    className: className,
                    filePath: filePath,
                    moduleName: moduleName,
                    isInherited: hasBoth
                });
                // Note: The user specifically asked: "is inherited which determine by checking that the model have _name and _inherit"
                // So we check if both are present in the same class.
                const hasBoth = assignments.some(a => a.childForFieldName('left')?.text === '_name') &&
                    assignments.some(a => a.childForFieldName('left')?.text === '_inherit');
                const modelEntry = this.modelCache.get(modelName);
                if (modelEntry) {
                    modelEntry.isInherited = hasBoth;
                }
                this.fieldCache.set(modelName, fields);
            }
        }
    }
    findNodesByType(node, type) {
        const results = [];
        if (node.type === type) {
            results.push(node);
        }
        for (let i = 0; i < node.childCount; i++) {
            results.push(...this.findNodesByType(node.child(i), type));
        }
        return results;
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
        this.watcher?.dispose();
    }
}
const modelIndexService = new ModelIndexService();
exports.default = modelIndexService;
//# sourceMappingURL=modelIndexService.js.map