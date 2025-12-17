"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getDecorators = getDecorators;
const versionService_1 = require("../../services/versionService");
const decorators_1 = __importDefault(require("./v18/decorators"));
const decorators_2 = __importDefault(require("./v19/decorators"));
async function getDecorators() {
    const v = await (0, versionService_1.getOdooVersion)();
    return v === '18' ? decorators_1.default : decorators_2.default;
}
//# sourceMappingURL=decorators.js.map