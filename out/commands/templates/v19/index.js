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
exports.getPosComponentTemplate = exports.getOwlComponentTemplate = void 0;
__exportStar(require("./basicView"), exports);
__exportStar(require("./advancedView"), exports);
__exportStar(require("./inheritView"), exports);
__exportStar(require("./reportView"), exports);
__exportStar(require("./securityView"), exports);
__exportStar(require("./sequenceView"), exports);
__exportStar(require("./settingsView"), exports);
__exportStar(require("./cronView"), exports);
__exportStar(require("./owlTemplates"), exports);
const owlTemplates_1 = require("./owlTemplates");
const posTemplate_1 = require("./posTemplate");
const getOwlComponentTemplate = (componentName, moduleName, type) => {
    if (type === 'commonComponent') {
        return new owlTemplates_1.commonComponent(componentName, moduleName);
    }
    if (type === 'fieldWidgetComponent') {
        return new owlTemplates_1.fieldWidgetComponent(componentName, moduleName);
    }
    if (type === 'publicComponent') {
        return new owlTemplates_1.publicComponent(componentName, moduleName);
    }
    if (type === 'serviceTemplate') {
        return new owlTemplates_1.serviceTemplate(componentName, moduleName);
    }
    return null;
};
exports.getOwlComponentTemplate = getOwlComponentTemplate;
const getPosComponentTemplate = (moduleName, type) => {
    if (type === 'extendProductScreen') {
        return new posTemplate_1.extendProductScreen(moduleName);
    }
    if (type === 'extendPartnerListScreen') {
        return new posTemplate_1.extendPartnerListScreen(moduleName);
    }
    if (type === 'extendPaymentScreen') {
        return new posTemplate_1.extendPaymentScreen(moduleName);
    }
    if (type === 'extendReceiptScreen') {
        return new posTemplate_1.extendReceiptScreen(moduleName);
    }
    if (type === 'extendTicketScreen') {
        return new posTemplate_1.extendTicketScreen(moduleName);
    }
    return null;
};
exports.getPosComponentTemplate = getPosComponentTemplate;
//# sourceMappingURL=index.js.map