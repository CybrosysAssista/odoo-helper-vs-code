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
var __exportStar = (this && this.__exportStar) || function(m, exports) {
    for (var p in m) if (p !== "default" && !Object.prototype.hasOwnProperty.call(exports, p)) __createBinding(exports, m, p);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getPosComponentTemplate = void 0;
const owlTemplates_1 = require("./owlTemplates");
__exportStar(require("./basicView"), exports);
__exportStar(require("./advancedView"), exports);
__exportStar(require("./inheritView"), exports);
__exportStar(require("./reportView"), exports);
__exportStar(require("./securityView"), exports);
__exportStar(require("./sequenceView"), exports);
__exportStar(require("./settingsView"), exports);
__exportStar(require("./cronView"), exports);
const getPosComponentTemplate = (componentName, moduleName, type) => {
    if (type === 'commonComponent') {
        return new owlTemplates_1.commonComponent(componentName, moduleName);
    }
    return null;
};
exports.getPosComponentTemplate = getPosComponentTemplate;
//# sourceMappingURL=index.js.map