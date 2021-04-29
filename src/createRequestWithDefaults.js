const fs = require('fs');
const request = require('request');
const { promisify } = require('util');
const fp = require('lodash/fp');
const config = require('../config/config');
const getAuthToken = require('./getAuthToken');

const { checkForInternalServiceError } = require('./handleError');

const _configFieldIsValid = (field) => typeof field === 'string' && field.length > 0;

const createRequestWithDefaults = (Logger) => {
  const {
    request: { ca, cert, key, passphrase, rejectUnauthorized, proxy }
  } = config;

  const defaults = {
    ...(_configFieldIsValid(ca) && { ca: fs.readFileSync(ca) }),
    ...(_configFieldIsValid(cert) && { cert: fs.readFileSync(cert) }),
    ...(_configFieldIsValid(key) && { key: fs.readFileSync(key) }),
    ...(_configFieldIsValid(passphrase) && { passphrase }),
    ...(_configFieldIsValid(proxy) && { proxy }),
    ...(typeof rejectUnauthorized === 'boolean' && { rejectUnauthorized }),
    json: true
  };

  const requestWithDefaults = (
    preRequestFunction = async () => ({}),
    postRequestSuccessFunction = async (x) => x,
    postRequestFailureFunction = async (e) => {
      throw e;
    }
  ) => {
    const defaultsRequest = request.defaults(defaults);

    const _requestWithDefault = (requestOptions) =>
      new Promise((resolve, reject) => {
        defaultsRequest(requestOptions, (err, res, body) => {
          if (err) return reject(err);
          resolve({ ...res, body });
        });
      });

    return async (requestOptions) => {
      const preRequestFunctionResults = await preRequestFunction(requestOptions);
      const _requestOptions = {
        ...requestOptions,
        ...preRequestFunctionResults
      };

      let postRequestFunctionResults;
      try {
        const result = await _requestWithDefault(_requestOptions);
        checkForStatusError(result, _requestOptions);

        postRequestFunctionResults = await postRequestSuccessFunction(
          result,
          _requestOptions
        );
      } catch (error) {
        postRequestFunctionResults = await postRequestFailureFunction(
          error,
          _requestOptions
        );
      }
      return postRequestFunctionResults;
    };
  };


  const checkForStatusError = ({ statusCode, body }, requestOptions) => {
    Logger.trace({ statusCode, body, requestOptions });
    checkForInternalServiceError(statusCode, body);
    const roundedStatus = Math.round(statusCode / 100) * 100;
    if (![200].includes(roundedStatus)) { 
      const requestError = Error('Request Error');
      requestError.status = statusCode;
      requestError.description = body;
      requestError.requestOptions = requestOptions;
      throw requestError;
    }
  };

  const handlePagination = async (result, requestOptions) => {
    //TODO: rewrite to handle taxii type pagination
    const totalPages = fp.get('body.pages.total', result);
    const currentPage = fp.get('body.pages.current', result);
    
    const shouldUseNormalPagination =
      totalPages && currentPage && totalPages > currentPage;

    const nextKey = fp.get('body.pages.nextKey', result);
    const shouldUseKeyBasedPagination = !!nextKey;

    if (shouldUseNormalPagination || shouldUseKeyBasedPagination) {
      const nextPageResults = await requestDefaultsWithInterceptors({
        ...requestOptions,
        qs: {
          ...requestOptions.qs,
          ...(shouldUseKeyBasedPagination
            ? { pageFromKey: nextKey }
            : { page: currentPage + 1 })
        }
      });

      return {
        ...nextPageResults,
        body: {
          ...nextPageResults.body,
          items: [...result.body.items, ...nextPageResults.body.items]
        }
      };
    }
    
    return result
  }

  const requestDefaultsWithInterceptors = requestWithDefaults(
    () => ({}),
    handlePagination
  );

  return requestDefaultsWithInterceptors;
};

module.exports = createRequestWithDefaults;
