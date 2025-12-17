const { getOdooVersion } = require('../../services/versionService');
const v18 = require('./v18/fieldTypes');
const v19 = require('./v19/fieldTypes');

async function getFieldTypes() {
    const v = await getOdooVersion();
    return v === '18' ? v18 : v19;
}

module.exports = { getFieldTypes };


