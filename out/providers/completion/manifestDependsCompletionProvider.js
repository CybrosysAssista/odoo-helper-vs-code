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
exports.ManifestDependsCompletionProvider = void 0;
const vscode = __importStar(require("vscode"));
const pythonParserService_1 = require("../../services/pythonParserService");
const moduleIndexService_1 = require("../../services/moduleIndexService");
/**
 * Provides Odoo module name suggestions for the 'depends' list in manifest files.
 */
class ManifestDependsCompletionProvider {
    async provideCompletionItems(document, position) {
        const parserService = (0, pythonParserService_1.getPythonParserService)();
        if (!parserService.isInitialized()) {
            return [];
        }
        const tree = parserService.parse(document.getText());
        if (!tree) {
            return [];
        }
        // Get the node at the current cursor position
        let node = tree.rootNode.descendantForPosition({
            row: position.line,
            column: position.character > 0 ? position.character - 1 : position.character
        });
        if (!node) {
            return [];
        }
        // 1. Verify we are in a manifest 'depends' list
        if (!this.isInDependsContext(node)) {
            return [];
        }
        // 2. Extract partial text for filtering
        const lineText = document.lineAt(position.line).text;
        const lineToCursor = lineText.substring(0, position.character);
        const lastQuote = Math.max(lineToCursor.lastIndexOf("'"), lineToCursor.lastIndexOf('"'));
        if (lastQuote === -1)
            return [];
        const prefix = lineToCursor.substring(lastQuote + 1);
        // 3. Get modules from our new high-speed index
        const modules = moduleIndexService_1.moduleIndexService.getModules();
        const replacementRange = new vscode.Range(position.translate(0, -prefix.length), position);
        return modules
            .filter(mod => mod.name.toLowerCase().startsWith(prefix.toLowerCase()))
            .map(mod => {
            const item = new vscode.CompletionItem(mod.name, vscode.CompletionItemKind.Module);
            item.detail = 'Odoo Module Name';
            item.documentation = new vscode.MarkdownString(`Path: \`${mod.path}\``);
            item.range = replacementRange;
            return item;
        });
    }
    /**
     * Context check: Go up the tree to find if the parent list belongs to 'depends'
     */
    isInDependsContext(node) {
        let current = node;
        while (current) {
            // If we are in a list, check the key of its parent pair
            if (current.type === 'list') {
                const pair = current.parent;
                if (pair && pair.type === 'pair') {
                    const key = pair.childForFieldName('key')?.text.replace(/['"]/g, '');
                    if (key === 'depends')
                        return true;
                }
            }
            // Sometimes we are looking directly at a pair if the list is empty
            if (current.type === 'pair') {
                const key = current.childForFieldName('key')?.text.replace(/['"]/g, '');
                if (key === 'depends')
                    return true;
            }
            current = current.parent;
        }
        return false;
    }
}
exports.ManifestDependsCompletionProvider = ManifestDependsCompletionProvider;
//# sourceMappingURL=manifestDependsCompletionProvider.js.map