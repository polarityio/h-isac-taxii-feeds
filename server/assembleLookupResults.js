const { flow, map, size, flatMap, get } = require('lodash/fp');

const assembleLookupResults = (indicators) =>
  flow(
    map(({ entity, collectionsWithFoundIndicators }) =>
      size(collectionsWithFoundIndicators)
        ? {
            entity,
            isVolatile: true,
            data: {
              summary: createSummary(collectionsWithFoundIndicators),
              details: { collectionsWithFoundIndicators }
            }
          }
        : {
            entity,
            data: null
          }
    )
  )(indicators);

const createSummary = (collectionsWithFoundIndicators) => {
  const collectionsFound = size(collectionsWithFoundIndicators);

  const indicatorsFound = flow(
    flatMap(get('indicators')),
    size
  )(collectionsWithFoundIndicators);

  return []
    .concat(collectionsFound ? `Collections: ${collectionsFound}` : [])
    .concat(indicatorsFound ? `Indicators ${indicatorsFound}` : []);
};

module.exports = assembleLookupResults;
