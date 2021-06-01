const fp = require('lodash/fp');
let PouchDB = require('pouchdb');
PouchDB.plugin(require('pouchdb-find'));
let schedule = require('node-schedule');

const reduce = require('lodash/fp/reduce').convert({ cap: false });
const createRequestWithDefaults = require('./src/createRequestWithDefaults');

const { handleError } = require('./src/handleError');
const { getLookupResults } = require('./src/getLookupResults');
const refreshTaxiiFeedData = require('./src/refreshTaxiiFeedData');

let Logger;
let requestWithDefaults;
let startJob;
let job;
let validateOptionsStartedJob;
let collectionObjectsDB;
let collectionsDB;
let _options;

const setCollectionsDB = _collectionsDB => {
  collectionsDB = _collectionsDB;
};

const setCollectionObjectsDB = (_collectionObjectsDB) => {
  collectionObjectsDB = _collectionObjectsDB;
};

const startup = (logger) => {
  Logger = logger;

  return async (cb) => {
    requestWithDefaults = createRequestWithDefaults(Logger);

    if (collectionObjectsDB) await collectionObjectsDB.destroy();
    if (collectionsDB) await collectionObjectsDB.destroy();

    setCollectionsDB(new PouchDB('collections', { auto_compaction: true }));
    setCollectionObjectsDB(new PouchDB('collectionObjects', { auto_compaction: true }));

    cb(null)
  }
};

const doLookup = async (entities, options, cb) => {
  let lookupResults; 
  try {
    if (!fp.isEqual(options, _options) && !validateOptionsStartedJob) {
      _options = options;
      startJob = true;
      if (job) job.cancel();
      await refreshTaxiiFeedData(
        collectionsDB,
        collectionObjectsDB,
        options,
        requestWithDefaults,
        Logger
      )();
    }
    if (validateOptionsStartedJob) {
      validateOptionsStartedJob = false;
      _options = options;
    }

    lookupResults = await getLookupResults(
      entities,
      collectionsDB,
      collectionObjectsDB,
      Logger
    );

    if (startJob) {
      startJob = false;
      job = schedule.scheduleJob(
        `* */${options.refreshDataTime} * * *`,
        refreshTaxiiFeedData(
          collectionsDB,
          collectionObjectsDB,
          options,
          requestWithDefaults,
          Logger
        )
      );
    }
  } catch (error) {
    Logger.error(error, 'Get Lookup Results Failed');
    return cb(handleError(error));
  }

  Logger.trace({ lookupResults }, 'Lookup Results');
  cb(null, lookupResults);
};

const validateOptions = async (options, callback) => {
  const stringOptionsErrorMessages = {
    url: 'You must provide a valid Url for a H-ISAC Taxii Feed.',
    username: 'You must provide a valid API Username for a H-ISAC Taxii Feed.',
    password: 'You must provide a valid API Password for a H-ISAC Taxii Feed.'
  };

  const stringValidationErrors = _validateStringOptions(
    stringOptionsErrorMessages,
    options
  );

  const urlError = fp.flow(fp.get('url.value'), fp.endsWith('/'))(options)
    ? [{ key: 'url', message: 'Your Url must not end with "/".' }]
    : [];

  const refreshDataTimeError =
    fp.get('refreshDataTime.value', options) <= 0
      ? [
          {
            key: 'refreshDataTime',
            message: 'Refresh Data Time must be greater than 0.'
          }
        ]
      : [];

  const errors = stringValidationErrors.concat(urlError).concat(refreshDataTimeError);

  if (!errors.length) {
    if (job) job.cancel();
    validateOptionsStartedJob = true;
    const refreshDataTime = fp.get('refreshDataTime.value', options);

    Logger.info(`Refresh Data Time set to ${refreshDataTime} hours`)
    
    job = schedule.scheduleJob(
      `* */${refreshDataTime} * * *`,
      refreshTaxiiFeedData(
        collectionsDB,
        collectionObjectsDB,
        options,
        requestWithDefaults,
        Logger
      )
    );
  }

  callback(null, errors);
};

const _validateStringOptions = (stringOptionsErrorMessages, options, otherErrors = []) =>
  reduce((agg, message, optionName) => {
    const isString = typeof options[optionName].value === 'string';
    const isEmptyString = isString && fp.isEmpty(options[optionName].value);

    return !isString || isEmptyString
      ? agg.concat({
          key: optionName,
          message
        })
      : agg;
  }, otherErrors)(stringOptionsErrorMessages);

module.exports = {
  doLookup,
  startup,
  validateOptions
};
