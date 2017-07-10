/*
 * Leaflet.buffer
 *
 * Buffering extension for Leaflet.draw
 *
 * (c) 2017 Jonathan Skeate
 * https://github.com/skeate/Leaflet.buffer
 * http://leafletjs.com
 */

/* global L */

import GeoJSONReader from 'jsts/org/locationtech/jts/io/GeoJSONReader';
import GeoJSONWriter from 'jsts/org/locationtech/jts/io/GeoJSONWriter';
import './jsts-monkey';

require('./leaflet.buffer.css');

L.bufferVersion = '0.3.0';

function geoJsonToLatLng(geoJson) {
  return L.latLng(geoJson[1], geoJson[0]);
}

L.Polygon.include({
  getCentroid(latlngs = this.getLatLngs()) {
    if (latlngs[0] instanceof Array) {
      return this.getCentroid(latlngs.map(this.getCentroid));
    }
    return latlngs.reduce((a, b, i) => {
      const lat = ((a.lat * i) + b.lat) / (i + 1);
      const lng = ((a.lng * i) + b.lng) / (i + 1);
      return L.latLng(lat, lng);
    });
  },
});

L.Circle.include({
  getCentroid() {
    return this.getLatLng();
  },
});

L.drawLocal.edit.toolbar.buttons.buffer = 'Expand layers.';
L.drawLocal.edit.toolbar.buttons.bufferDisabled = 'No layers to expand.';
L.drawLocal.edit.handlers.buffer = {
  tooltip: {
    text:  'Click and drag to expand or contract a shape.',
  },
};

const getModeHandlers = L.EditToolbar.prototype.getModeHandlers;
L.EditToolbar.prototype.getModeHandlers = function getModeHandlersExt(map) {
  const modeHandlers = this::getModeHandlers(map);
  let bufferOptions = this.options.buffer;

  if (!bufferOptions) {
    return modeHandlers;
  }

  if (typeof bufferOptions === 'boolean') {
    bufferOptions = {};
  }

  bufferOptions.featureGroup = this.options.featureGroup;

  if (!('replacePolylines' in bufferOptions)) {
    bufferOptions.replacePolylines = true;
  }

  if (!('bufferStyle' in bufferOptions)) {
    bufferOptions.bufferStyle = {
      dashArray: '1, 10',
      fill:      true,
    };
  }
  if (!('separateBuffer' in bufferOptions)) {
    bufferOptions.separateBuffer = false;
  }

  return modeHandlers.concat([{
    enabled: bufferOptions,
    handler: new L.EditToolbar.Buffer(map, bufferOptions),
  }]);
};

const _checkDisabled = L.EditToolbar.prototype._checkDisabled;
L.EditToolbar.prototype._checkDisabled = function checkDisabled() {
  this::_checkDisabled();
  const featureGroup = this.options.featureGroup;
  const hasLayers = featureGroup.getLayers().length !== 0;
  let button;
  if (this.options.buffer) {
    button = this._modes[L.EditToolbar.Buffer.TYPE].button;

    if (hasLayers) {
      L.DomUtil.removeClass(button, 'leaflet-disabled');
    } else {
      L.DomUtil.addClass(button, 'leaflet-disabled');
    }

    button.setAttribute(
      'title',
      hasLayers ?
        L.drawLocal.edit.toolbar.buttons.buffer
        : L.drawLocal.edit.toolbar.buttons.bufferDisabled
    );
  }
};

L.EditToolbar.Buffer = L.Handler.extend({
  statics: {
    TYPE: 'buffer',
  },

  includes:        L.Mixin.Events,
  _draggingLayer:  null,
  _originalLayers: {},
  _bufferData:     {},

  initialize(map, options) {
    this::L.Handler.prototype.initialize(map);
    // Store the selectable layer group for ease of access
    this._featureGroup = options.featureGroup;
    this._replacePolyline = options.replacePolylines;
    this._separateBuffer = options.separateBuffer;
    this._bufferStyle = options.bufferStyle;

    if (!(this._featureGroup instanceof L.FeatureGroup)) {
      throw new Error('options.featureGroup must be a L.FeatureGroup');
    }

    this._unbufferedLayerProps = {};

    // Save the type so super can fire,
    // need to do this as cannot do this.TYPE :(
    this.type = L.EditToolbar.Buffer.TYPE;

    this.geoReader = new GeoJSONReader();
    this.geoWriter = new GeoJSONWriter();
  },

  enable() {
    if (this._enabled || !this._hasAvailableLayers()) {
      return;
    }
    this.fire('enabled', { handler: this.type });
    // this disable other handlers

    this._map.fire('draw:bufferstart', { handler: this.type });
    // allow drawLayer to be updated before beginning edition.

    this::L.Handler.prototype.enable();
    this._featureGroup
      .on('layeradd', this._enableLayerBuffer, this)
      .on('layerremove', this._disableLayerBuffer, this);
  },

  disable() {
    if (!this._enabled) {
      return;
    }
    this._featureGroup
      .off('layeradd', this._enableLayerBuffer, this)
      .off('layerremove', this._disableLayerBuffer, this);
    this::L.Handler.prototype.disable();
    this._map.fire('draw:bufferstop', { handler: this.type });
    this.fire('disabled', { handler: this.type });
  },

  addHooks() {
    const map = this._map;
    if (map) {
      map.getContainer().focus();
      this._mapDraggable = map.dragging.enabled();
      if (this._mapDraggable) {
        map.dragging.disable();
      }
      this._featureGroup.eachLayer(this._enableLayerBuffer, this);
      this._tooltip = new L.Draw.Tooltip(this._map);
      this._setTooltip(L.drawLocal.edit.handlers.buffer.tooltip.text);
      this._map.on('mousemove', this._onMouseMove, this);
    }
  },

  removeHooks() {
    if (this._map) {
      // Clean up selected layers.
      this._featureGroup.eachLayer(this._disableLayerBuffer, this);

      // Clear the backups of the original layers
      this._unbufferedLayerProps = {};

      if (this._mapDraggable) {
        this._map.dragging.enable();
      }

      this._tooltip.dispose();
      this._tooltip = null;

      this._map.off('mousemove', this._onMouseMove, this);
    }
  },

  revertLayers() {
    this._featureGroup.eachLayer((layer) => {
      this._revertLayer(layer);
    });
  },

  save() {
    const bufferedLayers = new L.LayerGroup();
    const deletedPolylines = new L.LayerGroup();
    this._featureGroup.eachLayer((layer) => {
      const ol = this._originalLayers[L.Util.stamp(layer)];
      if (layer.buffered) {
        bufferedLayers.addLayer(layer);
        layer.buffered = false; // eslint-disable-line no-param-reassign
      }
      if (ol) {
        this._map.fire('draw:created', { layer });
        if (this._replacePolyline) {
          deletedPolylines.addLayer(ol);
        }
      }
    });
    this._originalLayers = {};
    this._map.fire('draw:buffered', { layers: bufferedLayers });
    this._map.fire('draw:deleted', { layers: deletedPolylines });
  },

  _backupLayer(layer) {
    const id = L.Util.stamp(layer);
    if (!this._unbufferedLayerProps[id]) {
      if (layer instanceof L.Polygon || layer instanceof L.Rectangle) {
        this._unbufferedLayerProps[id] = {
          latlngs: L.LatLngUtil.cloneLatLngs(layer.getLatLngs()),
        };
      } else if (layer instanceof L.Circle) {
        this._unbufferedLayerProps[id] = {
          latlng: L.LatLngUtil.cloneLatLng(layer.getLatLng()),
          radius: layer.getRadius(),
        };
      }
    }
  },

  _revertLayer(layer) {
    /* eslint-disable no-param-reassign */
    const id = L.Util.stamp(layer);
    layer.buffered = false;
    if (id in this._originalLayers) {
      // a polyline that got replaced with a polygon
      this._featureGroup.addLayer(this._originalLayers[id]);
      this._featureGroup.removeLayer(layer);
      delete this._originalLayers[id];
    } else if (this._unbufferedLayerProps::Object.prototype.hasOwnProperty(id)) {
      // Polygon or Rectangle
      if (layer instanceof L.Polygon || layer instanceof L.Rectangle) {
        layer.setLatLngs(this._unbufferedLayerProps[id].latlngs);
      } else if (layer instanceof L.Circle) {
        layer.setLatLng(this._unbufferedLayerProps[id].latlng);
        layer.setRadius(this._unbufferedLayerProps[id].radius);
      }
    } else if (layer instanceof L.Polygon) {
      // a Polygon created from a polyline -- just delete
      this._map.removeLayer(layer);
    }
    /* eslint-enable no-param-reassign */
  },

  _enableLayerBuffer(e) {
    const layer = e.layer || e.target || e;

    if (!(layer instanceof L.Marker)) {
      // Back up this layer (if haven't before)
      this._backupLayer(layer);
      layer.buffered = true;
      layer.on('mousedown', this._onLayerDragStart, this);
      this._map.on('mouseup', this._onLayerDragEnd, this);
    }
  },

  _disableLayerBuffer(e) {
    const layer = e.layer || e.target || e;
    layer.buffered = false;
    this._bufferData = {};

    layer.off('mousedown', this._onLayerDragStart, this);
    this._map.off('mouseup', this._onLayerDragEnd, this);
  },

  _onLayerDragStart(e) {
    let layer = e.layer || e.target || e;
    const layerIsPolygon = layer instanceof L.Polygon;
    const layerid = L.Util.stamp(layer);
    if ((layer instanceof L.Polyline && !layerIsPolygon) ||
      (this._separateBuffer && !(layerid in this._originalLayers))) {
      if (layer instanceof L.Circle) {
        layer = new L.Circle(layer.getLatLng(), { radius: layer.getRadius() });
      } else {
        const newGeo = this._buffer(layer.toGeoJSON(), 0.00001);
        layer = new L.Polygon(newGeo.coordinates[0].map(geoJsonToLatLng));
      }
      const newLayerId = L.Util.stamp(layer);
      this._originalLayers[newLayerId] = layer;
      layer.setStyle(this._bufferStyle);
      if (this._replacePolyline && !layerIsPolygon) {
        this._featureGroup.removeLayer(layer);
      }
      this._featureGroup.addLayer(layer);
    }
    this._map.on('mousemove', this._onLayerDrag, this);
    this._draggingLayer = layer;
    this._draggingLayerId = L.Util.stamp(layer);
    if (!(this._draggingLayerId in this._bufferData)) {
      if (layer instanceof L.Circle) {
        this._bufferData[this._draggingLayerId] = {
          radius: layer.getRadius(),
          temp_radius: 0,
          orig_geoJSON: layer.toGeoJSON(),
        };
      } else {
        this._bufferData[this._draggingLayerId] = {
          size: 0,
          temp_size: 0,
          radius: 0,
          temp_radius: 0,
          orig_geoJSON: layer.toGeoJSON(),
        };
      }
    }
    const centroid = layer.getCentroid();
    this._bufferData[this._draggingLayerId].centroid = centroid;
    this._bufferData[this._draggingLayerId].orig_distanceToCenter =
      e.latlng.distanceTo(this._bufferData[this._draggingLayerId].centroid);
    this._setTooltip(this._bufferData[this._draggingLayerId].radius);
  },

  _onLayerDrag(e) {
    const data = this._bufferData[this._draggingLayerId];
    // this calculates the buffer distance in ~meters
    let distance =
      (data.centroid.distanceTo(e.latlng) - data.orig_distanceToCenter);
    data.temp_radius = data.radius + distance;
    this._setTooltip(data.temp_radius);

    if (this._draggingLayer instanceof L.Circle) {
      this._draggingLayer.setRadius(data.temp_radius);
    } else {
      // buffer seems to be based on deg lat,
      // so this converts meter distance to ~degrees
      distance /= 111120;
      data.temp_size = data.size + distance;
      const newGeometry = this._buffer(data.orig_geoJSON, data.temp_size);
      if (newGeometry.type !== 'MultiPolygon') {
        this._draggingLayer.setLatLngs(
          newGeometry.coordinates[0].map(geoJsonToLatLng)
        );
      } else {
        // todo: handle multipolygons
      }
    }
  },

  _onLayerDragEnd() {
    const data = this._bufferData[this._draggingLayerId];
    if (data) {
      data.size = data.temp_size;
      data.radius = data.temp_radius;
    }
    this._map.off('mousemove', this._onLayerDrag, this);
    this._draggingLayer = null;
    this._setTooltip(L.drawLocal.edit.handlers.buffer.tooltip.text);
  },

  _onMarkerDragEnd(e) {
    const layer = e.target;
    layer.edited = true;
  },

  _onMouseMove(e) {
    this._tooltip.updatePosition(e.latlng);
  },

  _hasAvailableLayers() {
    return this._featureGroup.getLayers().length !== 0;
  },

  _setTooltip(radiusOrMessage) {
    let text;
    if (typeof radiusOrMessage === 'string') {
      text = radiusOrMessage;
    } else {
      const radiusM = radiusOrMessage;
      const radiusKm = radiusM / 1000;
      const radiusFt = radiusM * 3.28084;
      const radiusMi = radiusFt / 5280;
      const metricUnit = radiusKm >= 1 ? 'km' : 'm';
      const metricValue = (radiusKm >= 1 ? radiusKm : radiusM).toFixed(2);
      const imperialUnit = radiusMi >= 0.1 ? 'mi' : 'ft';
      const imperialValue = (radiusMi >= 0.1 ? radiusMi : radiusFt).toFixed(2);
      text = `Buffer radius: ${metricValue + metricUnit} ${imperialValue + imperialUnit}`;
    }
    this._tooltip.updateContent({ text });
  },

  _buffer(geoJSON, radius) {
    const geometry = this.geoReader.read(geoJSON).geometry.buffer(radius);
    return this.geoWriter.write(geometry);
  },
});
