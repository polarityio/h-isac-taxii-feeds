const {
  get,
  map,
  flow,
  split,
  capitalize,
  join,
  size,
  includes,
  reduce,
  last,
  filter,
  eq,
  replace
} = require('lodash/fp');


const { requestWithDefaults } = require('../request');
const db = require('./database');

let totalNumberOfIndicatorsFound;

const getAndInsertIndicatorObjects = async (collections, options) => {
  totalNumberOfIndicatorsFound = 0;

  await Promise.all(
    map(
      async (collection) => getAndInsertCollectionIndicatorObjects(collection, options),
      collections
    )
  );

  return totalNumberOfIndicatorsFound;
};

const getAndInsertCollectionIndicatorObjects = async (collection, options, next) => {
  const objectsResponseBody = get(
    'body',
    await requestWithDefaults({
      route: `collections/${collection.id}/objects/`,
      qs: { ['match[type]']: 'indicator', next },
      options
    })
  );

  const indicatorObjects = flow(
    get('objects'),
    filter(flow(get('type'), eq('indicator')))
  )(objectsResponseBody);

  totalNumberOfIndicatorsFound += size(indicatorObjects);

  const formattedIndicatorObjects = map(formatObject(collection), indicatorObjects);

  // Empty collection objects for this collection before inserting if this is the first page of objects for this collection
  if (!next)
    await db.remove('indicatorObjects', { collectionId: collection.id }, { multi: true });

  await db.insert('indicatorObjects', formattedIndicatorObjects);

  if (get('more', objectsResponseBody)) {
    await getAndInsertCollectionIndicatorObjects(
      collection,
      options,
      get('next', objectsResponseBody)
    );
  }
};

const formatObject = (collection) => (object) => {
  const formattedName = flow(get('name'), split(':'), join(' -'))(object);

  const entityValue = flow(get('name'), split(': '), last)(object);

  const description = get('description', object);
  const formattedDescription = includes('TS ID', description) && {
    description: flow(
      split(';'),
      reduce((agg, field) => {
        const [key, value] = split(':', field);
        return { ...agg, [key.includes('.') ? replace(/\./g, '_', key) : key]: value };
      }, {})
    )(description),
    descriptionIsArray: true
  };

  const labels = get('labels', object);
  const formattedLabels = size(labels) && {
    labels: formatDashCaseStrings(labels)
  };

  const indicator_types = get('indicator_types', object);
  const formattedIndicatorTypes = size(indicator_types) && {
    indicator_types: formatDashCaseStrings(indicator_types)
  };

  return {
    ...sanitizeKeys(object),
    name: formattedName,
    entityValue,
    collectionId: collection.id,
    ...formattedDescription,
    ...formattedLabels,
    ...formattedIndicatorTypes
  };
};

const formatDashCaseStrings = map(flow(split('-'), map(capitalize), join(' ')));

const sanitizeKeys = (input) => {
  if (Array.isArray(input)) {
    // If input is an array, sanitize each element recursively
    return input.map(sanitizeKeys);
  } else if (input !== null && typeof input === 'object') {
    // If input is an object, sanitize its keys
    const sanitized = {};
    Object.entries(input).forEach(([key, value]) => {
      const sanitizedKey = key.replace(/\./g, '_'); // Replace dots with underscores
      sanitized[sanitizedKey] = sanitizeKeys(value); // Recurse for values
    });
    return sanitized;
  }
  // Return primitive types (string, number, boolean, null, etc.) as-is
  return input;
}

module.exports = getAndInsertIndicatorObjects;
