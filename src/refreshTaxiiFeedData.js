const fp = require('lodash/fp');

const refreshTaxiiFeedData = (
  collectionsDB,
  collectionObjectsDB,
  _options,
  requestWithDefaults,
  Logger
) => async () => {
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
    const collections = fp.get(
      'body.collections',
      await requestWithDefaults({
        method: 'GET',
        url: `${options.url}/collections/`,
        headers,
        auth
      })
    );

    await Promise.all(
      fp.map(
        async (collection) =>
          await Promise.all([
            retryUntilWritten(collectionsDB, { ...collection, _id: collection.id } ),
            getAndWriteCollectionObjects(
              collection,
              collectionObjectsDB,
              options.url,
              headers,
              auth,
              requestWithDefaults
            )
          ]),
        collections
      )
    );

    await collectionObjectsDB.createIndex({ index: { fields: ['id', 'name'] } });
    await collectionsDB.createIndex({ index: { fields: ['id'] } });

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
  requestWithDefaults
) => {
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
