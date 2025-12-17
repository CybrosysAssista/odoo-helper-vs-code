const { getOdooVersion } = require('../../services/versionService');
const v18 = require('./v18/odooFieldSnippets');
const v19 = require('./v19/odooFieldSnippets');

async function getFieldSnippets() {
    const version = await getOdooVersion();
    return version === '18' ? v18 : v19;
}

module.exports = { getFieldSnippets };


