"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getUtilitySnippets = getUtilitySnippets;
const versionService_1 = require("../../services/versionService");
const odooUtilitySnippets_1 = __importDefault(require("./v18/odooUtilitySnippets"));
const odooUtilitySnippets_2 = __importDefault(require("./v19/odooUtilitySnippets"));
async function getUtilitySnippets() {
    const version = await (0, versionService_1.getOdooVersion)();
    return version === '18' ? odooUtilitySnippets_1.default : odooUtilitySnippets_2.default;
}
//# sourceMappingURL=utilitySnippets.js.map