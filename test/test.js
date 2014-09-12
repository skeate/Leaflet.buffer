var should = require('chai').should();
var express = require('express');
var path = require('path');
var webdriverio = require('webdriverio');
var wdjsSeleniumBundle = require('webdriverjs-selenium-bundle');
var istanbul = require('istanbul');
var http = require('http');
var collector = new istanbul.Collector();
var reporter = new istanbul.Reporter();

describe('Leaflet.buffer', function(){
  var client;

  before(function(done){
    this.timeout(60000); // selenium/chrome take a while to start up
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
      client.init().url('http://localhost:8888/test/index.html', done);
    });
  });

  it('should add a button', function(done){
    return client.getElementSize('.leaflet-draw-edit-buffer', done);
  });

  after(function(done){
    client.frame(null);
    client.execute(function(){return window.__coverage__;}, function(err, res){
      collector.add(res.value);

      reporter.add('lcovonly');
      reporter.write(collector, false, done);
    });

    client.end();
  });
});
