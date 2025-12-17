const { getOdooVersion } = require('../../services/versionService');
const v18 = require('./v18/odooMethodSnippets');
const v19 = require('./v19/odooMethodSnippets');

async function getMethodSuggestions() {
    const version = await getOdooVersion();
    return version === '18' ? v18 : v19;
}

module.exports = { getMethodSuggestions };


