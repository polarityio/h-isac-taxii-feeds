const { get, size } = require('lodash/fp');

const {
  logging: { getLogger }
} = require('polarity-integration-utils');

const { requestWithDefaults } = require('../request');
const db = require('./database');
const getAndInsertIndicatorObjects = require('./getAndInsertIndicatorObjects');

const refreshCollectionsAndIndicators = (_options) => async () => {
  let Logger = getLogger();
  Logger.info('Starting Data Refresh for Taxii Feed');

  const options = {
    username: get('username.value', _options),
    password: get('password.value', _options),
    url: get('url.value', _options)
  };

  try {
    Logger.trace('Obtaining Collections');

    const collections = get(
      'body.collections',
      await requestWithDefaults({
        route: 'collections/',
        options
      })
    );

    Logger.info(`${size(collections)} Collections Found`);
    Logger.trace('Writing Collections to Database');

    // Empty collections before inserting new ones
    await db.remove('collections', {}, { multi: true });

    const [_, totalNumberOfIndicatorsFound] = await Promise.all([
      db.insert('collections', collections),
      getAndInsertIndicatorObjects(collections, options)
    ]);

    Logger.trace('Indexing Database Search Fields');
    await db.createIndex('collections', { id: 1 });
    await db.createIndex('indicatorObjects', { entityValue: 1 });

    Logger.info('Collections and Indicator Objects Update Successful', {
      totalNumberOfCollectionsFound: collections.length,
      totalNumberOfIndicatorsFound
    });
  } catch (error) {
    Logger.error(error, 'Error in Refreshing Taxii Feed Data');
    throw error;
  }
};

module.exports = refreshCollectionsAndIndicators;
