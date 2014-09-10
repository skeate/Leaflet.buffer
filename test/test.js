var should = require('chai').should();
var express = require('express');
var path = require('path');
var webdriverio = require('webdriverio');
var wdjsSeleniumBundle = require('webdriverjs-selenium-bundle');


describe('Leaflet.buffer', function(){
  var client;

  before(function(done){
    this.timeout(9000); // selenium/chrome take a while to start up
    var app = express();
    app.use(express.static(path.join(__dirname, '..')));
    app.listen(8888, function(){
      // Set up Selenium & webdriver
      client = webdriverio.remote({
        desiredCapabilities: {
          browserName: 'phantomjs'
        }
      });
      client.use(wdjsSeleniumBundle({autostop: true}));
      client.init().url('http://localhost:8888/examples/index.html', done);
    });
  });

  it('should add a button', function(done){
    return client.getElementSize('.leaflet-draw-edit-buffer', done);
  });

  after(function(done){
    client.end();
    setTimeout(done, 1000);
  });
});
