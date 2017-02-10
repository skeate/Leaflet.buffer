[![Build Status](https://travis-ci.org/skeate/Leaflet.buffer.svg)](https://travis-ci.org/skeate/Leaflet.buffer)
[![Greenkeeper badge](https://badges.greenkeeper.io/skeate/Leaflet.buffer.svg)](https://greenkeeper.io/)

# Leaflet.buffer

Create a buffer around shapes drawn with
[Leaflet.draw](https://github.com/Leaflet/Leaflet.draw).

![Demo Image](http://i.imgur.com/FITcpas.gif)

[See here](http://skeate.github.io/Leaflet.buffer) for a live demo.

## Usage

Include the source file (dist/leaflet.buffer.min.js) after the Leaflet.Draw
library. In your setup script, make sure your Leaflet.Draw `edit` config
includes a `buffer` property (options are below). That's it!

Example:

```javascript
const osmUrl = 'http://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png';
const osm = L.tileLayer(osmUrl, { maxZoom: 18 });
const map = new L.Map('map', {
  layers: [osm],
  center: new L.LatLng(38.8977, -77.0366),
  zoom: 15,
});
const drawnItems = new L.FeatureGroup();
map.addLayer(drawnItems);

const drawControl = new L.Control.Draw({
  position: 'topright',
  draw: {},
  edit: {
    featureGroup: drawnItems,
    remove: true,
    buffer: {
      replacePolylines: false,
      separateBuffer: false,
    },
  },
});
map.addControl(drawControl);
```

## Options

`replacePolylines`: If `true` (default), buffering a polyline will result in the
replacement of the polyline with a polygon. If `false`, buffering a polyline
will result in a new polygon on top of the line, but not replacing it.

`separateBuffer`: If `false` (default), then buffering any shape actually
changes the shape. If `true`, buffering a shape results in a copy of the shape
being made, to maintain both the original shape and the buffer.

`bufferStyle`: [style options](http://leafletjs.com/reference.html#path) for
the buffer shapes (always used for polyline buffers; used for others iff
`separateBuffer` is `true`)
