const { getOdooVersion } = require('../services/versionService');
const scaffold18 = require('./scaffold18');
const scaffold19 = require('./scaffold19');

async function createOdooScaffold(rootUri, moduleName, type) {
    const version = await getOdooVersion();
    if (version === '18') {
        return scaffold18.createOdooScaffold(rootUri, moduleName, type);
    }
    // default to 19 branch
    return scaffold19.createOdooScaffold(rootUri, moduleName, type);
}

module.exports = { createOdooScaffold };