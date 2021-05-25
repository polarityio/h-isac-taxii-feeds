const fp = require('lodash/fp');

const createLookupResults = (foundEntities, Logger) =>
  fp.flow(
    fp.map(({ entity, collectionsWithFoundObjects }) =>
      fp.size(collectionsWithFoundObjects)
        ? {
            entity,
            data: {
              summary: createSummary(collectionsWithFoundObjects),
              details: { collectionsWithFoundObjects }
            }
          }
        : {
            entity,
            data: null
          }
    ),
    fp.compact
  )(foundEntities);

const createSummary = (collectionsWithFoundObjects) => {
  const labels = fp.flatMap(fp.flow(fp.get('objects'), fp.flatMap(fp.get('labels'))))(
    collectionsWithFoundObjects
  );

  const indicatorTypes = fp.flatMap(
    fp.flow(fp.get('objects'), fp.flatMap(fp.get('indicator_types')))
  )(collectionsWithFoundObjects);

  return fp.flow(
    fp.concat(indicatorTypes),
    fp.uniq,
    fp.compact,
    fp.filter((tag) => !fp.toLower(tag).includes('threatstream')),
    fp.slice(0, 1)
  )(labels);
};

module.exports = createLookupResults;
