"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getPosComponentTemplate = exports.getCronViewTemplate = exports.getSettingsViewTemplate = exports.getSequenceViewTemplate = exports.getSecurityRuleViewTemplate = exports.getSecurityGroupViewTemplate = exports.getReportViewTemplate = exports.getInheritViewTemplate = exports.getAdvancedViewTemplate = exports.getBasicViewTemplate = void 0;
const versionService_1 = require("../../services/versionService");
async function getTemplates() {
    const v = await (0, versionService_1.getOdooVersion)();
    if (v === '18') {
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        return require('./v18/index');
    }
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    return require('./v19/index');
}
// Export wrapper functions that dispatch to the versioned modules
const getBasicViewTemplate = async (...args) => (await getTemplates()).getBasicViewTemplate(...args);
exports.getBasicViewTemplate = getBasicViewTemplate;
const getAdvancedViewTemplate = async (...args) => (await getTemplates()).getAdvancedViewTemplate(...args);
exports.getAdvancedViewTemplate = getAdvancedViewTemplate;
const getInheritViewTemplate = async (...args) => (await getTemplates()).getInheritViewTemplate(...args);
exports.getInheritViewTemplate = getInheritViewTemplate;
const getReportViewTemplate = async (...args) => (await getTemplates()).getReportViewTemplate(...args);
exports.getReportViewTemplate = getReportViewTemplate;
const getSecurityGroupViewTemplate = async (...args) => (await getTemplates()).getSecurityGroupViewTemplate(...args);
exports.getSecurityGroupViewTemplate = getSecurityGroupViewTemplate;
const getSecurityRuleViewTemplate = async (...args) => (await getTemplates()).getSecurityRuleViewTemplate(...args);
exports.getSecurityRuleViewTemplate = getSecurityRuleViewTemplate;
const getSequenceViewTemplate = async (...args) => (await getTemplates()).getSequenceViewTemplate(...args);
exports.getSequenceViewTemplate = getSequenceViewTemplate;
const getSettingsViewTemplate = async (...args) => (await getTemplates()).getSettingsViewTemplate(...args);
exports.getSettingsViewTemplate = getSettingsViewTemplate;
const getCronViewTemplate = async (...args) => (await getTemplates()).getCronViewTemplate(...args);
exports.getCronViewTemplate = getCronViewTemplate;
const getPosComponentTemplate = async (...args) => (await getTemplates()).getPosComponentTemplate(...args);
exports.getPosComponentTemplate = getPosComponentTemplate;
//# sourceMappingURL=index.js.map