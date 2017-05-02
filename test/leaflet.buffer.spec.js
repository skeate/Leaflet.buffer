/* eslint-env mocha */

// import { expect } from 'chai';
const expect = require('chai').expect;
const jsdom = require('jsdom/lib/old-api');
const path = require('path');

const className = 'leaflet-draw-edit-buffer';

describe('Leaflet.buffer', () => {
  let document;
  let window;
  beforeEach((done) => {
    jsdom.env({
      html: '<html><head></head><body><div id="map"></div></body></html>',
      scripts: [
        path.join(__dirname, '../node_modules/leaflet/dist/leaflet.js'),
        path.join(__dirname, '../node_modules/leaflet-draw/dist/leaflet.draw.js'),
        path.join(__dirname, '../dist/leaflet.buffer.min.js'),
        path.join(__dirname, '../test/helper.js'),
      ],
      virtualConsole: jsdom.createVirtualConsole().sendTo(console),
      done(err, _window) {
        if (err) {
          return;
        }
        window = _window;
        document = window.document;
        done();
      },
    });
  });

  it('should add a button', () => {
    const elements = document.getElementsByClassName(className);
    expect(elements.length).to.equal(1);
  });

  it('should be disabled without any shapes to buffer', () => {
    expect(document.getElementsByClassName(className)[0].classList.contains('leaflet-disabled'))
      .to.equal(true);
  });
});
