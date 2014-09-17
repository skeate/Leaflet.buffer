[![Build Status](https://travis-ci.org/skeate/Leaflet.buffer.svg?branch=develop)](https://travis-ci.org/skeate/Leaflet.buffer)
[![Coverage Status](https://coveralls.io/repos/skeate/Leaflet.buffer/badge.png?branch=develop)](https://coveralls.io/r/skeate/Leaflet.buffer?branch=develop)  
[![Sauce Test Status](https://saucelabs.com/browser-matrix/skeate.svg)](https://saucelabs.com/u/skeate)

# Leaflet.buffer

Create a buffer around shapes drawn with
[Leaflet.draw](https://github.com/Leaflet/Leaflet.draw).

## Usage

Include the source (js/css) after Leaflet.draw, and add a `buffer` property to
the draw control config.

## Options

`replace_polylines`: If `true` (the default), a polyline will be replaced with
                     a polygon. If false, the polygon will just sit on top of
                     the line.

`separate_buffer`: If `true`, behavior for all shapes will be similar to if
                   `replace_polylines` is `false` -- i.e., the buffer will be
                   added to the layer instead of resizing the existing shape.

`buffer_style`: [style options](http://leafletjs.com/reference.html#path) for
                the buffer shapes (always used for polyline buffers; used for
                others iff `separate_buffer` is `true`)
