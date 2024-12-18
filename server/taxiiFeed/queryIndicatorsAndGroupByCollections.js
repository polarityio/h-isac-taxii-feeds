const { map, groupBy, get } = require('lodash/fp');
const db = require('./database');

const queryIndicatorsAndGroupByCollections = async (entities) =>
  await Promise.all(
    map(async (entity) => {
      const foundIndicators = await db.find('indicatorObjects', {
        entityValue: entity.value
      });

      const indicatorsGroupedByCollectionId = groupBy('collectionId', foundIndicators);

      const collectionsWithFoundIndicators = await Promise.all(
        map(async (indicators) => {
          const collection = await db.findOne('collections', {
            id: get('0.collectionId', indicators)
          });
          return { ...collection, indicators };
        }, indicatorsGroupedByCollectionId)
      );

      return {
        entity,
        collectionsWithFoundIndicators
      };
    }, entities)
  );

module.exports = queryIndicatorsAndGroupByCollections;
