const fp = require('lodash/fp');

let totalNumberOfIndicatorsFound;

const refreshTaxiiFeedData = (
  collectionsDB,
  collectionObjectsDB,
  _options,
  requestWithDefaults,
  Logger
) => async () => {
  Logger.info('Starting Data Refresh for Taxii Feed')

  totalNumberOfIndicatorsFound = 0;

  const options = {
    username: fp.get('username.value', _options) || _options.username,
    password: fp.get('password.value', _options) || _options.password,
    url: fp.get('url.value', _options) || _options.url
  };

  const auth = {
    username: options.username,
    password: options.password
  };
  const headers = { Accept: 'application/taxii+json;version=2.1' };

  try {
    Logger.trace('Obtaining Collections');

    const collections = fp.get(
      'body.collections',
      await requestWithDefaults({
        method: 'GET',
        url: `${options.url}/collections/`,
        headers,
        auth
      })
    );

    Logger.info(`${collections.length} Collections Found`)
    Logger.trace('Writing Collections to Database');
    await Promise.all(
      fp.map(
        async (collection) =>
          await Promise.all([
            retryUntilWritten(collectionsDB, { ...collection, _id: collection.id }),
            () =>
              Logger.info(
                'Collections Written to Database. Getting Indicator Objects for Collections.'
              ),
            getAndWriteCollectionObjects(
              collection,
              collectionObjectsDB,
              options.url,
              headers,
              auth,
              requestWithDefaults,
              Logger
            )
          ]),
        collections
      )
    );

    Logger.trace('Indexing Database Search Fields');
    await collectionObjectsDB.createIndex({ index: { fields: ['id', 'name'] } });
    await collectionsDB.createIndex({ index: { fields: ['id'] } });
    
    Logger.info('Collections and Indicator Objects Update Successful', {
      totalNumberOfCollectionsFound: collections.length,
      totalNumberOfIndicatorsFound
    });
  } catch (error) {
    Logger.error(error, 'Error in Refreshing Taxii Feed Data');
  }
};

const getAndWriteCollectionObjects = async (
  collection,
  collectionObjectsDB,
  url,
  headers,
  auth,
  requestWithDefaults,
  Logger
) => {
  Logger.info(`Obtaining Indicator Object Data for Collection ID '${collection.id}'`);

  const objects = fp.get(
    'body.objects',
    await requestWithDefaults({
      method: 'GET',
      url: `${url}/collections/${collection.id}/objects/`,
      qs: { ['match[type]']: 'indicator' },
      headers,
      auth
    })
  );

  totalNumberOfIndicatorsFound += objects.length;

  Logger.info(`${objects.length} Indicator Objects found for Collection '${collection.id}'`);
  Logger.trace(`Writing Indicator Objects to Database`);
  await Promise.all(
    fp.map(
      async (object) =>
        retryUntilWritten(collectionObjectsDB, {
          ...object,
          _id: object.id,
          collectionId: collection.id,
        }),
      objects
    )
  );

  Logger.info(`Indicator Objects for Collection ID '${collection.id}' Written to Database`);
};

const retryUntilWritten = async (db, doc) => {
  try {
    const origDoc = await db.get(doc._id);
    doc._rev = origDoc._rev;
    return await db.put(doc);
  } catch (err) {
    return err.status === 409 ? await retryUntilWritten(db, doc) : await db.put(doc);
  }
};

module.exports = refreshTaxiiFeedData;
