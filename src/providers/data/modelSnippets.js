const { getOdooVersion } = require('../../services/versionService');
const v18 = require('./v18/odooModelSnippets');
const v19 = require('./v19/odooModelSnippets');

async function getModelSnippets() {
    const version = await getOdooVersion();
    return version === '18' ? v18 : v19;
}

module.exports = { getModelSnippets };


