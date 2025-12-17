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
exports.ManifestDependsCompletionProvider = void 0;
const vscode = __importStar(require("vscode"));
const modelIndexService_1 = __importDefault(require("../../services/modelIndexService"));
class ManifestDependsCompletionProvider {
    constructor() { }
    async provideCompletionItems(document, position) {
        const line = document.lineAt(position).text;
        const textBefore = line.substring(0, position.character);
        // Only trigger if the line contains 'depends' and we're inside quotes
        if (!/depends/.test(line) || !/['"]$/.test(textBefore))
            return undefined;
        // Extract the partial module name being typed (allow empty string for always suggest)
        const partialMatch = textBefore.match(/['"]([a-zA-Z0-9_\-]*)$/);
        const partial = partialMatch ? partialMatch[1] : '';
        // Get all module names in the workspace
        const moduleNames = await modelIndexService_1.default.getAllModuleNames();
        return moduleNames
            .filter((name) => partial === '' || name.startsWith(partial))
            .map((name) => {
            const item = new vscode.CompletionItem(name, vscode.CompletionItemKind.Module);
            item.insertText = name;
            item.detail = 'Odoo Module';
            return item;
        });
    }
}
exports.ManifestDependsCompletionProvider = ManifestDependsCompletionProvider;
//# sourceMappingURL=manifestDependsCompletionProvider.js.map