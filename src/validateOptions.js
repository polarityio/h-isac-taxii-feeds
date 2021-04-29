const fp = require('lodash/fp');
const reduce = require('lodash/fp/reduce').convert({ cap: false });

const validateOptions = (options, callback) => {
  const stringOptionsErrorMessages = {
    url: 'You must provide a valid Url for a HSISAC Taxii Feed.',
    username: 'You must provide a valid API Username for a HSISAC Taxii Feed.',
    password: 'You must provide a valid API Password for a HSISAC Taxii Feed.'
  };

  const stringValidationErrors = _validateStringOptions(
    stringOptionsErrorMessages,
    options
  );

  const urlError = fp.flow(fp.get('url.value'), fp.endsWith('/'))(options)
    ? [{ key: 'url', message: 'Your Url must not end with "/".' }]
    : [];

  callback(null, stringValidationErrors.concat(urlError));
};

const _validateStringOptions = (stringOptionsErrorMessages, options, otherErrors = []) =>
  reduce((agg, message, optionName) => {
    const isString = typeof options[optionName].value === 'string';
    const isEmptyString = isString && fp.isEmpty(options[optionName].value);

    return !isString || isEmptyString
      ? agg.concat({
          key: optionName,
          message
        })
      : agg;
  }, otherErrors)(stringOptionsErrorMessages);


module.exports = validateOptions;
