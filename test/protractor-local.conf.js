exports.config = {
  seleniumAddress: 'http://localhost:4445/wd/hub',
  specs: ['test/test.js'],
  capabilities: {
    browserName: 'firefox'
  }
};
