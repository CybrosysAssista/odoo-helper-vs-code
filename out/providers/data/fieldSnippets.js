"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getFieldSnippets = getFieldSnippets;
const versionService_1 = require("../../services/versionService");
const odooFieldSnippets_1 = __importDefault(require("./v18/odooFieldSnippets"));
const odooFieldSnippets_2 = __importDefault(require("./v19/odooFieldSnippets"));
async function getFieldSnippets() {
    const version = await (0, versionService_1.getOdooVersion)();
    return version === '18' ? odooFieldSnippets_1.default : odooFieldSnippets_2.default;
}
//# sourceMappingURL=fieldSnippets.js.map