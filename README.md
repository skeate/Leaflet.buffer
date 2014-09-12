[![Build Status](https://travis-ci.org/skeate/Leaflet.buffer.svg?branch=develop)](https://travis-ci.org/skeate/Leaflet.buffer)

# Leaflet.buffer

Create a buffer around shapes drawn with [Leaflet.draw](https://github.com/Leaflet/Leaflet.draw).

## Usage

Just include the source (js/css) after Leaflet.draw. It will automatically add itself to the edit menu.

## Options

`replace_polylines`: If `true` (the default), a polyline will be replaced with a polygon. If false, the polygon will just
                     sit on top of the line.
