const fp = require('lodash/fp');

const { splitOutIgnoredIps } = require('./dataTransformations');
const createLookupResults = require('./createLookupResults');

const getLookupResults = async (entities, collectionsDB, collectionObjectsDB, Logger) => {
  const { entitiesPartition, ignoredIpLookupResults } = splitOutIgnoredIps(entities);

  const foundEntities = await _getFoundEntities(
    entitiesPartition,
    collectionsDB,
    collectionObjectsDB,
    Logger
  );

  const lookupResults = createLookupResults(foundEntities, Logger);

  Logger.trace({ lookupResults, foundEntities }, 'Lookup Results');

  return lookupResults.concat(ignoredIpLookupResults);
};


const _getFoundEntities = async (
  entitiesPartition,
  collectionsDB,
  collectionObjectsDB,
  Logger
) =>
  Promise.all(
    fp.map(async (entity) => {
      var foundCollectinObjects = fp.flow(
        fp.get('docs'),
        fp.map((object) => {
          const { name, description, labels, indicator_types } = object;

          const formattedName = fp.flow(fp.split(':'), fp.join(' -'))(name);
          const formattedDescription = fp.includes('TS ID', description) && {
            description: fp.flow(
              fp.split(';'),
              fp.reduce((agg, field) => {
                const [key, value] = fp.split(':', field);
                return { ...agg, [key]: value };
              }, {})
            )(description),
            descriptionIsArray: true,
          };

          const formattedLabels = fp.size(labels) && {
            labels: formatDashCaseStrings(labels)
          };

          const formattedIndicatorTypes = fp.size(indicator_types) && {
            indicator_types: formatDashCaseStrings(indicator_types)
          };

          return {
            ...object,
            name: formattedName,
            ...formattedDescription,
            ...formattedLabels,
            ...formattedIndicatorTypes
          };
          
        })
      )(
        await collectionObjectsDB.find({
          selector: { name: { $regex: new RegExp(entity.value, 'i') } }
        })
      );

      const objectsGroupedByCollectionId = fp.groupBy(
        'collectionId',
        foundCollectinObjects
      );

      const collectionsWithFoundObjects = await Promise.all(
        fp.map(async (objects) => {
          const collection = await collectionsDB.get(fp.get('0.collectionId', objects));
          return { ...collection, objects };
        }, objectsGroupedByCollectionId)
      );

      return {
        entity,
        collectionsWithFoundObjects
      };
    }, entitiesPartition)
  );

const formatDashCaseStrings = fp.map(
  fp.flow(fp.split('-'), fp.map(fp.capitalize), fp.join(' '))
);

module.exports = {
  getLookupResults
};
