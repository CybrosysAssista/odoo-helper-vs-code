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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const vscode = __importStar(require("vscode"));
const path = __importStar(require("path"));
const pythonParserService_1 = require("./pythonParserService");
const moduleIndexService_1 = __importDefault(require("./moduleIndexService"));
class ModelIndexService {
    modelCache; // modelName -> ModelInfo[] (since multiple modules can inherit/define)
    watcher;
    isIndexing = false;
    _onDidIndexFile = new vscode.EventEmitter();
    onDidIndexFile = this._onDidIndexFile.event;
    _onDidDeleteFile = new vscode.EventEmitter();
    onDidDeleteFile = this._onDidDeleteFile.event;
    _onDidIndexRichFile = new vscode.EventEmitter();
    onDidIndexRichFile = this._onDidIndexRichFile.event;
    constructor() {
        this.modelCache = new Map();
        this.watcher = null;
    }
    initialize() {
        this.watcher = vscode.workspace.createFileSystemWatcher('**/*.py');
        this.watcher.onDidChange(uri => this.indexFile(uri));
        this.watcher.onDidCreate(uri => this.indexFile(uri));
        this.watcher.onDidDelete(uri => this.removeFile(uri));
    }
    async buildCache(progress) {
        if (this.isIndexing)
            return;
        this.isIndexing = true;
        console.log('[ModelIndex] Building model cache...');
        this.modelCache.clear();
        if (progress) {
            progress.report({ message: "Finding Odoo Modules..." });
        }
        const modules = await moduleIndexService_1.default.getModules(progress);
        const totalModules = modules.length;
        let modulesProcessed = 0;
        for (const module of modules) {
            modulesProcessed++;
            // Find all python files in this module
            const pattern = new vscode.RelativePattern(module.path, '**/*.py');
            const pythonFiles = await vscode.workspace.findFiles(pattern, '**/{node_modules,venv,.venv,__pycache__}/**');
            const totalFiles = pythonFiles.length;
            let filesProcessed = 0;
            for (const file of pythonFiles) {
                filesProcessed++;
                if (progress) {
                    const fileName = path.basename(file.fsPath);
                    progress.report({
                        message: `Indexing Models: [${modulesProcessed}/${totalModules}] ${module.name} - File ${filesProcessed}/${totalFiles} (${fileName})`,
                        increment: (1 / (totalModules * (totalFiles || 1))) * 100
                    });
                }
                await this.indexFile(file, module.name);
            }
            // Yield to main thread occasionally
            await new Promise(resolve => setTimeout(resolve, 0));
        }
        this.isIndexing = false;
        console.log(`[ModelIndex] Finished: Indexed ${this.modelCache.size} models across ${modules.length} modules.`);
    }
    async indexFile(uri, moduleName) {
        const config = vscode.workspace.getConfiguration('cybrosys-assista-odoo-helper');
        if (!config.get('indexing.enableCoreIndexing', true)) {
            return;
        }
        try {
            if (!moduleName) {
                // Try to find module name if not provided
                const modules = await moduleIndexService_1.default.getModules();
                const module = modules.find(m => uri.fsPath.startsWith(m.path));
                if (!module)
                    return; // Not in a valid Odoo module
                moduleName = module.name;
            }
            const content = await vscode.workspace.fs.readFile(uri);
            const text = Buffer.from(content).toString('utf8');
            const pythonParser = (0, pythonParserService_1.getPythonParserService)();
            if (!pythonParser.isInitialized())
                return;
            const tree = pythonParser.parse(text);
            if (!tree)
                return;
            // Remove old entries for this file
            this.removeFileEntries(uri.fsPath);
            // Parse classes
            const models = this.parseModelsFromTree(tree, uri.fsPath, moduleName);
            // Notify others with the parsed tree
            this._onDidIndexRichFile.fire({ uri, tree, models });
            this._onDidIndexFile.fire(uri);
            // CRITICAL: Delete tree only after everyone is done
            tree.delete();
        }
        catch (error) {
            console.error(`[ModelIndex] Error indexing file ${uri.fsPath}:`, error);
        }
    }
    parseModelsFromTree(tree, filePath, moduleName) {
        const rootNode = tree.rootNode;
        const pythonParser = (0, pythonParserService_1.getPythonParserService)();
        const language = pythonParser.getLanguage();
        const foundModels = [];
        if (!language)
            return [];
        // Query to find classes
        const classQuery = new (require('web-tree-sitter')).Query(language, `
            (class_definition
                name: (identifier) @class_name
                body: (block) @body
            )
        `);
        const matches = classQuery.matches(rootNode);
        for (const match of matches) {
            const classNameNode = match.captures.find((c) => c.name === 'class_name')?.node;
            const bodyNode = match.captures.find((c) => c.name === 'body')?.node;
            if (classNameNode && bodyNode) {
                const className = classNameNode.text;
                let modelNameValue = null;
                let inheritValue = null;
                let hasName = false;
                // Look for _name and _inherit assignments in the class body
                for (const child of bodyNode.children) {
                    if (child.type === 'expression_statement') {
                        const assignment = child.firstChild;
                        if (assignment?.type === 'assignment') {
                            const left = assignment.childForFieldName('left');
                            const right = assignment.childForFieldName('right');
                            if (left?.text === '_name') {
                                hasName = true;
                                modelNameValue = this.extractString(right);
                            }
                            else if (left?.text === '_inherit') {
                                inheritValue = this.extractValue(right);
                            }
                        }
                    }
                }
                // Logic to determine model name as requested
                let finalModelName = null;
                if (hasName) {
                    finalModelName = modelNameValue;
                }
                else if (inheritValue) {
                    if (Array.isArray(inheritValue)) {
                        finalModelName = inheritValue[0];
                    }
                    else {
                        finalModelName = inheritValue;
                    }
                }
                if (finalModelName) {
                    const modelInfo = {
                        modelName: finalModelName,
                        moduleName: moduleName,
                        className: className,
                        filePath: filePath,
                        line: classNameNode.startPosition.row,
                        character: classNameNode.startPosition.column,
                        isInherited: !hasName
                    };
                    const existing = this.modelCache.get(finalModelName) || [];
                    existing.push(modelInfo);
                    this.modelCache.set(finalModelName, existing);
                    foundModels.push(modelInfo);
                }
            }
        }
        return foundModels;
    }
    extractString(node) {
        if (!node)
            return null;
        if (node.type === 'string') {
            return node.text.slice(1, -1);
        }
        return null;
    }
    extractValue(node) {
        if (!node)
            return null;
        if (node.type === 'string') {
            return node.text.slice(1, -1);
        }
        if (node.type === 'list' || node.type === 'tuple') {
            const values = [];
            for (const child of node.namedChildren) {
                if (child.type === 'string') {
                    values.push(child.text.slice(1, -1));
                }
            }
            return values;
        }
        return null;
    }
    removeFile(uri) {
        this.removeFileEntries(uri.fsPath);
        this._onDidDeleteFile.fire(uri);
    }
    removeFileEntries(filePath) {
        for (const [key, list] of this.modelCache.entries()) {
            const filtered = list.filter(m => m.filePath !== filePath);
            if (filtered.length === 0) {
                this.modelCache.delete(key);
            }
            else {
                this.modelCache.set(key, filtered);
            }
        }
    }
    getModelsByName(modelName) {
        return this.modelCache.get(modelName) || [];
    }
    getAllModelNames() {
        return Array.from(this.modelCache.keys());
    }
    getAllModels() {
        const all = [];
        for (const models of this.modelCache.values()) {
            all.push(...models);
        }
        return all;
    }
    getModelsByFile(filePath) {
        const results = [];
        for (const models of this.modelCache.values()) {
            for (const model of models) {
                if (model.filePath === filePath) {
                    results.push(model);
                }
            }
        }
        return results;
    }
    dispose() {
        if (this.watcher) {
            this.watcher.dispose();
        }
    }
}
const modelIndexService = new ModelIndexService();
exports.default = modelIndexService;
//# sourceMappingURL=modelIndexService.js.map