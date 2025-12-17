"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getModelSnippets = getModelSnippets;
const versionService_1 = require("../../services/versionService");
const odooModelSnippets_1 = __importDefault(require("./v18/odooModelSnippets"));
const odooModelSnippets_2 = __importDefault(require("./v19/odooModelSnippets"));
async function getModelSnippets() {
    const version = await (0, versionService_1.getOdooVersion)();
    return version === '18' ? odooModelSnippets_1.default : odooModelSnippets_2.default;
}
//# sourceMappingURL=modelSnippets.js.map