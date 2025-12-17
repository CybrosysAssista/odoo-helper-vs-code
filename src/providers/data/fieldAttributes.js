const { getOdooVersion } = require('../../services/versionService');
const v18 = require('./v18/fieldAttributes');
const v19 = require('./v19/fieldAttributes');

async function getFieldAttributes() {
    const v = await getOdooVersion();
    return v === '18' ? v18 : v19;
}

module.exports = { getFieldAttributes };


