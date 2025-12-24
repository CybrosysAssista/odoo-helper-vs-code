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
exports.OdooModuleUtils = void 0;
const vscode = __importStar(require("vscode"));
const path = __importStar(require("path"));
const fs = __importStar(require("fs"));
const xmlParserService_1 = require("../services/xmlParserService");
class OdooModuleUtils {
    /**
     * Get the root directory of the Odoo module containing the given URI.
     * @param uri - The URI of a file or directory within the module.
     * @returns The URI of the module root, or null if not found.
     */
    static async getModuleRoot(uri) {
        let currentFolder = uri.fsPath;
        while (currentFolder) {
            const manifestPath = path.join(currentFolder, '__manifest__.py');
            const initPath = path.join(currentFolder, '__init__.py');
            if (fs.existsSync(manifestPath) || fs.existsSync(initPath)) {
                return vscode.Uri.file(currentFolder);
            }
            const parentFolder = path.dirname(currentFolder);
            if (parentFolder === currentFolder) {
                break;
            }
            currentFolder = parentFolder;
        }
        return null;
    }
    /**
     * Extract Odoo model metadata (name and uniqueness) from an XML node context.
     * @param node - The current XML node.
     * @param text - The full document text.
     * @returns Model metadata or null if not found.
     */
    static getModelMetadata(node, text) {
        const xmlParser = (0, xmlParserService_1.getXmlParserService)();
        let parentNode = node;
        while (parentNode) {
            if (parentNode.tag === 'record') {
                const attrs = xmlParser.getAttributes(text, parentNode);
                if (attrs['model']) {
                    return {
                        name: attrs['model'],
                        isUnique: true
                    };
                }
            }
            if (parentNode.tag && ['form', 'tree', 'list', 'kanban', 'pivot', 'search'].includes(parentNode.tag)) {
                const archField = parentNode.parent;
                if (archField && archField.parent) {
                    const recordNode = archField.parent;
                    const modelField = recordNode.children?.find(c => {
                        if (c.tag === 'field') {
                            const attrs = xmlParser.getAttributes(text, c);
                            return attrs['name'] === 'model';
                        }
                        return false;
                    });
                    if (modelField && modelField.startTagEnd !== undefined && modelField.endTagStart !== undefined) {
                        const modelName = text.slice(modelField.startTagEnd, modelField.endTagStart).trim();
                        return {
                            name: modelName,
                            isUnique: false
                        };
                    }
                }
            }
            parentNode = parentNode.parent;
        }
        return null;
    }
    static getRecordModel(node, text) {
        const xmlParser = (0, xmlParserService_1.getXmlParserService)();
        let parentNode = node;
        while (parentNode) {
            if (parentNode.tag === 'record') {
                const attrs = xmlParser.getAttributes(text, parentNode);
                if (attrs['model']) {
                    return attrs['model'];
                }
            }
            parentNode = parentNode.parent;
        }
        return null;
    }
    static findViewModel(node, text) {
        const xmlParser = (0, xmlParserService_1.getXmlParserService)();
        let parentNode = node;
        let foundViewTag = false;
        while (parentNode) {
            if (parentNode.tag === 'record') {
                const attrs = xmlParser.getAttributes(text, parentNode);
                const recordModel = attrs['model'];
                // If we are in an ir.ui.view or we found a view tag (form, tree, etc.),
                // we should look for the <field name="model"> content.
                if (foundViewTag) {
                    const children = parentNode.children;
                    if (children) {
                        for (const child of children) {
                            if (child.tag === 'field') {
                                const cAttrs = xmlParser.getAttributes(text, child);
                                if (cAttrs['name'] === 'model') {
                                    if (child.startTagEnd !== undefined && child.endTagStart !== undefined) {
                                        return text.slice(child.startTagEnd, child.endTagStart).trim();
                                    }
                                }
                            }
                        }
                    }
                }
                // If it's not a view record or the model field wasn't found,
                // use the record's model attribute itself.
                if (recordModel) {
                    return recordModel;
                }
                break;
            }
            if (parentNode.tag && ['form', 'tree', 'list', 'kanban', 'pivot', 'search'].includes(parentNode.tag)) {
                foundViewTag = true;
            }
            parentNode = parentNode.parent;
        }
        return null;
    }
}
exports.OdooModuleUtils = OdooModuleUtils;
//# sourceMappingURL=odooModuleUtils.js.map