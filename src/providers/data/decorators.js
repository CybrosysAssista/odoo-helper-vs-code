const { getOdooVersion } = require('../../services/versionService');
const v18 = require('./v18/decorators');
const v19 = require('./v19/decorators');

async function getDecorators() {
    const v = await getOdooVersion();
    return v === '18' ? v18 : v19;
}

module.exports = { getDecorators };


