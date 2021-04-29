polarity.export = PolarityComponent.extend({
  details: Ember.computed.alias('block.data.details'),
  summary: Ember.computed.alias('block.data.summary'),
  init() {
    this._super(...arguments);
  },
  actions: {

  }
});
