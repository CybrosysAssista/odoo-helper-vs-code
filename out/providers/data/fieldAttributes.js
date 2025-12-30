"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getFieldAttributes = getFieldAttributes;
const versionService_1 = require("../../services/versionService");
const fieldAttributes_1 = __importDefault(require("./v18/fieldAttributes"));
const fieldAttributes_2 = __importDefault(require("./v19/fieldAttributes"));
async function getFieldAttributes() {
    const v = await (0, versionService_1.getOdooVersion)();
    return v === '18' ? fieldAttributes_1.default : fieldAttributes_2.default;
}
//# sourceMappingURL=fieldAttributes.js.map