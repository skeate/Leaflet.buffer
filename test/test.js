var should = require('chai').should();

// Set up Selenium & webdriver
var webdriverjs = require('webdriverjs');
var wdjsSeleniumBundle = require('webdriverjs-selenium-bundle');

var client = webdriverjs.remote({
  desiredCapabilities: {
    browserName: 'chrome'
  }
});

client.use(wdjsSeleniumBundle({autostop: true}));

client.init().url('http://localhost:8888/examples/index.html');

describe('Leaflet.buffer', function(){
  this.timeout(9999999);
  it('should add a button', function(done){
    return client.getElementSize('.leaflet-draw-edit-buffer', done);
  });
});
