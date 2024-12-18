const { get } = require('lodash/fp');
let schedule = require('node-schedule');

const {
  logging: { getLogger }
} = require('polarity-integration-utils');
const { refreshCollectionsAndIndicators } = require('../taxiiFeed');
const { validateStringOptions, validateUrlOption } = require('./utils');
const { sleep } = require('../dataTransformations');
const { database: db } = require('../taxiiFeed');

let job;
let oldRefreshDataTime;

const validateOptions = async (options, callback) => {
  const Logger = getLogger();
  const stringOptionsErrorMessages = {
    url: 'You must provide a valid Url for a H-ISAC Taxii Feed.',
    username: 'You must provide a valid API Username for a H-ISAC Taxii Feed.',
    password: 'You must provide a valid API Password for a H-ISAC Taxii Feed.'
  };

  const stringValidationErrors = validateStringOptions(
    stringOptionsErrorMessages,
    options
  );

  const urlError = validateUrlOption(options);

  const refreshDataTimeError =
    get('refreshDataTime.value', options) <= 0
      ? [
          {
            key: 'refreshDataTime',
            message: 'Refresh Data Time must be greater than 0.'
          }
        ]
      : [];

  let errors = stringValidationErrors.concat(urlError).concat(refreshDataTimeError);

  if (!errors.length) {
    try {
      // Only wait to refresh data in validateOptions if the collection is empty
      if (await db.collectionIsEmpty('indicatorObjects')) {
        refreshCollectionsAndIndicators(options)();
        await sleep(13000)
      }
  
      const refreshDataTime = get('refreshDataTime.value', options);
  
      const refreshDataTimeHasChanged = oldRefreshDataTime !== refreshDataTime;
      if (refreshDataTimeHasChanged) {
        if (job) job.cancel();
  
        job = schedule.scheduleJob(
          `0 */${refreshDataTime} * * *`,
          refreshCollectionsAndIndicators(options)
        );
  
        oldRefreshDataTime = refreshDataTime;
  
        Logger.info(`Refresh Data Time set to ${refreshDataTime} hours`);
      }
    } catch (error) {
      errors =  [
        {
          key: 'refreshDataTime',
          message: 'Error refreshing data: ' + error.message
        }
      ];
    }
  }

  callback(null, errors);
};

module.exports = validateOptions;
