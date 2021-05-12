const fp = require('lodash/fp');
var PouchDB = require('pouchdb');
PouchDB.plugin(require('pouchdb-find'));
var schedule = require('node-schedule');

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

const startup = async (logger) => {
  Logger = logger;

  requestWithDefaults = createRequestWithDefaults(Logger);
  if (collectionObjectsDB) await collectionObjectsDB.destroy();
  if (collectionsDB) await collectionObjectsDB.destroy();
  collectionObjectsDB = new PouchDB('collectionObjects', { auto_compaction: true });
  collectionsDB = new PouchDB('collections', { auto_compaction: true });
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
        `*/${options.refreshDataTime} * * * *`,
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
    url: 'You must provide a valid Url for a HSISAC Taxii Feed.',
    username: 'You must provide a valid API Username for a HSISAC Taxii Feed.',
    password: 'You must provide a valid API Password for a HSISAC Taxii Feed.'
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
    job = schedule.scheduleJob(
      `*/${fp.get('refreshDataTime.value', options)} * * * *`,
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
