const {
  map,
  get,
  getOr,
  filter,
  flow,
  negate,
  isEmpty,
  tail,
  first,
  concat
} = require('lodash/fp');
const { parallelLimit } = require('async');

const {
  requests: { createRequestWithDefaults }
} = require('polarity-integration-utils');
const config = require('../config/config');

const requestWithDefaults = createRequestWithDefaults({
  config,
  roundedSuccessStatusCodes: [200],
  requestOptionsToOmitFromLogsKeyPaths: ['auth'],
  preprocessRequestOptions: async ({ route, options, ...requestOptions }) => ({
    ...requestOptions,
    url: `${options.url}/${route}`,
    auth: {
      username: options.username,
      password: options.password
    },
    headers: { ...requestOptions.headers, Accept: 'application/taxii+json;version=2.1' },
    json: true
  }),
  postprocessRequestFailure: (error) => {
    const errorResponseBody = JSON.parse(error.description);
    error.message = `${error.message} - (${error.status})${
      errorResponseBody.message || errorResponseBody.error
        ? `| ${errorResponseBody.message || errorResponseBody.error}`
        : ''
    }`;

    throw error;
  }
});

const createRequestsInParallel =
  (requestWithDefaults) =>
  async (
    requestsOptions,
    responseGetPath,
    limit = 10,
    onlyReturnPopulatedResults = true
  ) => {
    const unexecutedRequestFunctions = map(
      ({ resultId, ...requestOptions }) =>
        async () => {
          const response = await requestWithDefaults(requestOptions);
          const result = responseGetPath ? get(responseGetPath, response) : response;
          return resultId ? { resultId, result } : result;
        },
      requestsOptions
    );

    const firstResult = await first(unexecutedRequestFunctions)();
    const remainingResults = await parallelLimit(tail(unexecutedRequestFunctions), limit);
    const results = [firstResult, ...remainingResults];

    return onlyReturnPopulatedResults
      ? filter(
          flow((result) => getOr(result, 'result', result), negate(isEmpty)),
          results
        )
      : results;
  };

const requestsInParallel = createRequestsInParallel(requestWithDefaults);

module.exports = {
  requestWithDefaults,
  requestsInParallel
};
