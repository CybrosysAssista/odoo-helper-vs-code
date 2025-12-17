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
exports.ImportCompletionProvider = void 0;
const vscode = __importStar(require("vscode"));
class ImportCompletionProvider {
    imports;
    constructor() {
        this.imports = [
            {
                label: 'odoo common imports',
                detail: 'Add odoo common imports api, fields, models',
                insertText: 'from odoo import api, fields, models'
            },
            {
                label: 'odoo import fields',
                detail: 'Import Odoo fields',
                insertText: 'from odoo import fields'
            },
            {
                label: 'odoo import models',
                detail: 'Import Odoo models',
                insertText: 'from odoo import models'
            },
            {
                label: 'odoo import api',
                detail: 'Import Odoo API',
                insertText: 'from odoo import api'
            },
            {
                label: 'odoo import tools',
                detail: 'Import Odoo tools',
                insertText: 'from odoo import tools'
            },
            {
                label: 'odoo import config',
                detail: 'Import Odoo config',
                insertText: 'from odoo.tools import config'
            },
            {
                label: 'odoo import date_utils',
                detail: 'Import Odoo date_utils',
                insertText: 'from odoo.tools import date_utils'
            },
            {
                label: 'odoo import common',
                detail: 'Import common Odoo modules',
                insertText: 'from odoo import api, fields, models'
            },
            {
                label: 'odoo import http',
                detail: 'Import http for controllers',
                insertText: 'from odoo import http'
            },
            {
                label: 'odoo import  http request',
                detail: 'Access HTTP request object',
                insertText: 'from odoo.http import request'
            },
            {
                label: 'odoo import logging',
                detail: 'Python logging for Odoo',
                insertText: 'import logging\n_logger = logging.getLogger(__name__)'
            },
            {
                label: 'odoo import json',
                detail: 'Import JSON module',
                insertText: 'import json'
            },
            {
                label: 'odoo import base64',
                detail: 'Import base64 for encoding/decoding',
                insertText: 'import base64'
            },
            {
                label: 'odoo import datetime',
                detail: 'Import datetime module',
                insertText: 'from datetime import datetime, date, timedelta'
            },
            {
                label: 'odoo import html',
                detail: 'Import HTML escape',
                insertText: 'from html import escape'
            },
            {
                label: 'odoo import re',
                detail: 'Import regular expressions',
                insertText: 'import re'
            },
            {
                label: 'odoo import werkzeug.utils',
                detail: 'Import werkzeug utilities',
                insertText: 'from werkzeug.utils import redirect'
            },
            {
                label: 'odoo import exceptions',
                detail: 'Import Odoo exceptions',
                insertText: 'from odoo.exceptions import UserError, ValidationError'
            }
        ];
    }
    provideCompletionItems(document, position) {
        return this.imports.map(imp => {
            const item = new vscode.CompletionItem(imp.label, vscode.CompletionItemKind.Snippet);
            item.detail = imp.detail;
            item.insertText = new vscode.SnippetString(imp.insertText);
            return item;
        });
    }
}
exports.ImportCompletionProvider = ImportCompletionProvider;
//# sourceMappingURL=importCompletionProvider.js.map