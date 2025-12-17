const { getOdooVersion } = require('../../services/versionService');
const v18 = require('./v18/odooUtilitySnippets');
const v19 = require('./v19/odooUtilitySnippets');

async function getUtilitySnippets() {
    const version = await getOdooVersion();
    return version === '18' ? v18 : v19;
}

module.exports = { getUtilitySnippets };


