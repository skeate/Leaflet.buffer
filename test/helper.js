/* global L */
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
  draw: {
    polyline: {
      metric: true,
    },
    polygon: {
      allowIntersection: false,
      showArea: true,
      drawError: {
        color: '#b00b00',
        timeout: 1000,
      },
      shapeOptions: {
        color: '#00c0de',
      },
    },
    circle: {
      shapeOptions: {
        color: '#662d91',
      },
    },
    marker: false,
  },
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

