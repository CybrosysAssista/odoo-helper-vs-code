"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getFieldTypes = getFieldTypes;
const versionService_1 = require("../../services/versionService");
const fieldTypes_1 = __importDefault(require("./v18/fieldTypes"));
const fieldTypes_2 = __importDefault(require("./v19/fieldTypes"));
async function getFieldTypes() {
    const v = await (0, versionService_1.getOdooVersion)();
    return v === '18' ? fieldTypes_1.default : fieldTypes_2.default;
}
//# sourceMappingURL=fieldTypes.js.map