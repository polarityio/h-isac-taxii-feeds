const {
  logging: { setLogger, getLogger }
} = require('polarity-integration-utils');

const { handleError } = require('./server/handleError');
const { validateOptions } = require('./server/userOptions');
const { queryIndicatorsAndGroupByCollections } = require('./server/taxiiFeed');
const { removePrivateIps } = require('./server/dataTransformations');
const assembleLookupResults = require('./server/assembleLookupResults');

const doLookup = async (entities, options, cb) => {
  const Logger = getLogger();
  try {
    Logger.debug({ entities }, 'Entities');

    const searchableEntities = removePrivateIps(entities);

    const indicators = await queryIndicatorsAndGroupByCollections(searchableEntities);

    const lookupResults = assembleLookupResults(indicators);

    Logger.trace({ lookupResults }, 'Lookup Results');

    cb(null, lookupResults);
  } catch (error) {
    Logger.error(error, 'Get Lookup Results Failed');
    return cb(handleError(error));
  }
};

module.exports = {
  startup: setLogger,
  validateOptions,
  doLookup
};
