"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getMethodSuggestions = getMethodSuggestions;
const versionService_1 = require("../../services/versionService");
const odooMethodSnippets_1 = __importDefault(require("./v18/odooMethodSnippets"));
const odooMethodSnippets_2 = __importDefault(require("./v19/odooMethodSnippets"));
async function getMethodSuggestions() {
    const version = await (0, versionService_1.getOdooVersion)();
    return version === '18' ? odooMethodSnippets_1.default : odooMethodSnippets_2.default;
}
//# sourceMappingURL=methodSnippets.js.map