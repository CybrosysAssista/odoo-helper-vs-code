"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getXmlMeta = getXmlMeta;
const versionService_1 = require("../../../services/versionService");
const v18_1 = __importDefault(require("./v18"));
const v19_1 = __importDefault(require("./v19"));
async function getXmlMeta() {
    const v = await (0, versionService_1.getOdooVersion)();
    return v === '18' ? v18_1.default : v19_1.default;
}
//# sourceMappingURL=index.js.map