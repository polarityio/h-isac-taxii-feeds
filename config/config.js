module.exports = {
  name: 'HSISAC Taxii Feeds',
  acronym: 'HTF',
  description: '', //TODO: write desc and determine types
  entityTypes: ['domain', 'url', 'IPv4', 'IPv6', 'SHA256'],
  styles: ['./styles/styles.less'],
  defaultColor: 'light-pink',
  onDemandOnly: true,
  block: {
    component: {
      file: './components/block.js'
    },
    template: {
      file: './templates/block.hbs'
    }
  },
  request: {
    cert: '',
    key: '',
    passphrase: '',
    ca: '',
    proxy: '',
    rejectUnauthorized: true
  },
  logging: {
    level: 'info' //trace, debug, info, warn, error, fatal
  },
  options: [
    {
      key: 'url',
      name: 'HSISAC Taxii Feed URL',
      description: 'The URL used for your HSISAC Taxii Feed.',
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
      type: 'text',
      userCanEdit: true,
      adminOnly: false
    }
  ]
};
