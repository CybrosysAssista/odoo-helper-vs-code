const { getOdooVersion } = require('../../services/versionService');

async function getTemplates() {
    const v = await getOdooVersion();
    if (v === '18') return require('./v18/index');
    return require('./v19/index');
}

// Export wrapper functions that dispatch to the versioned modules
module.exports = {
    getBasicViewTemplate: async (...args) => (await getTemplates()).getBasicViewTemplate(...args),
    getAdvancedViewTemplate: async (...args) => (await getTemplates()).getAdvancedViewTemplate(...args),
    getInheritViewTemplate: async (...args) => (await getTemplates()).getInheritViewTemplate(...args),
    getReportViewTemplate: async (...args) => (await getTemplates()).getReportViewTemplate(...args),
    getSecurityGroupViewTemplate: async (...args) => (await getTemplates()).getSecurityGroupViewTemplate(...args),
    getSecurityRuleViewTemplate: async (...args) => (await getTemplates()).getSecurityRuleViewTemplate(...args),
    getSequenceViewTemplate: async (...args) => (await getTemplates()).getSequenceViewTemplate(...args),
    getSettingsViewTemplate: async (...args) => (await getTemplates()).getSettingsViewTemplate(...args),
    getCronViewTemplate: async (...args) => (await getTemplates()).getCronViewTemplate(...args)
};


