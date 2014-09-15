[![Build Status](https://travis-ci.org/skeate/Leaflet.buffer.svg?branch=develop)](https://travis-ci.org/skeate/Leaflet.buffer)
[![Coverage Status](https://img.shields.io/coveralls/skeate/Leaflet.buffer.svg)](https://coveralls.io/r/skeate/Leaflet.buffer?branch=develop)

[![Sauce Test Status](https://saucelabs.com/browser-matrix/skeate.svg)](https://saucelabs.com/u/skeate)

# Leaflet.buffer

Create a buffer around shapes drawn with [Leaflet.draw](https://github.com/Leaflet/Leaflet.draw).

## Usage

Include the source (js/css) after Leaflet.draw, and add a `buffer` property to the draw control config.

## Options

`replace_polylines`: If `true` (the default), a polyline will be replaced with a polygon. If false, the polygon will just
                     sit on top of the line.
