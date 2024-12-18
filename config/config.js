module.exports = {
  name: 'H-ISAC TAXII Feeds',
  acronym: 'HITS',
  description:
    "The Polarity H-ISAC TAXII Feeds Integration retrieves Collections and Indicator Object data using H-ISAC's implementation of STIX 2.0 and TAXII 2.0.",
  entityTypes: ['domain', 'url', 'email', 'IPv4', 'IPv6', 'MD5', 'SHA1', 'SHA256'],
  defaultColor: 'light-gray',
  onDemandOnly: true,
  styles: ['./client/styles.less'],
  block: {
    component: {
      file: './client/block.js'
    },
    template: {
      file: './client/block.hbs'
    }
  },
  request: {
    cert: '',
    key: '',
    passphrase: '',
    ca: '',
    proxy: ''
  },
  logging: {
    level: 'info'
  },
  options: [
    {
      key: 'url',
      name: 'H-ISAC TAXII Feed URL',
      description: 'The URL used for your H-ISAC TAXII Feed.',
      default: 'https://health-isac.cyware.com/ctixapi/ctix21',
      type: 'text',
      userCanEdit: true,
      adminOnly: false
    },
    {
      key: 'username',
      name: 'API Username',
      description: 'The API Username you will use to authenticate.',
      default: '',
      type: 'text',
      userCanEdit: true,
      adminOnly: false
    },
    {
      key: 'password',
      name: 'API Password',
      description: 'The API Password you will use to authenticate.',
      default: '',
      type: 'password',
      userCanEdit: true,
      adminOnly: false
    },
    {
      key: 'refreshDataTime',
      name: 'Refresh Data Time',
      description:
        'The time for the how often to refresh your data from the TAXII system in Hours.',
      default: 24,
      type: 'number',
      userCanEdit: true,
      adminOnly: false
    }
  ]
};
