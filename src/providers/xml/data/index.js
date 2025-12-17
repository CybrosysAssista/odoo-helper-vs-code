const { getOdooVersion } = require('../../../services/versionService');
const v18 = require('./v18');
const v19 = require('./v19');

async function getXmlMeta() {
    const v = await getOdooVersion();
    return v === '18' ? v18 : v19;
}

module.exports = { getXmlMeta };


