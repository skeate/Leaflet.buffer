/*
 * Leaflet.buffer
 *
 * Buffering extension for Leaflet.draw
 *
 * (c) 2014 Jonathan Skeate
 * https://github.com/skeate/Leaflet.buffer
 * http://leafletjs.com
 */
(function (window, document){
  L.bufferVersion = '0.1.2';

  function geoJsonToLatLng(geoJson){
    return L.latLng(geoJson[1], geoJson[0]);
  }

  L.Polygon.include({
    getCentroid: function(latlngs){
      latlngs = latlngs || this.getLatLngs();
      if (latlngs[0] instanceof Array) {
        return this.getCentroid(latlngs.map(this.getCentroid));
      }
      return latlngs.reduce(function(data, next){
        data.count++;
        data.latSum += next.lat;
        data.lngSum += next.lng;
        data.avg = L.latLng(data.latSum/data.count, data.lngSum/data.count);
        return data;
      }, {count: 0, latSum: 0, lngSum: 0}).avg;
    }
  });

  L.Circle.include({
    getCentroid: function(){
      return this.getLatLng();
    }
  });

  L.drawLocal.edit.toolbar.buttons.buffer = 'Expand layers.';
  L.drawLocal.edit.toolbar.buttons.bufferDisabled = 'No layers to expand.';
  L.drawLocal.edit.handlers.buffer = {
    tooltip: {
      text:  'Click and drag to expand or contract a shape.'
    }
  };

  var getModeHandlers = L.EditToolbar.prototype.getModeHandlers;
  L.EditToolbar.prototype.getModeHandlers = function(map){
    var modeHandlers = getModeHandlers.call(this, map);

    var bufferOptions = this.options.buffer;

    if (!bufferOptions) {
      return modeHandlers;
    }

    if (typeof bufferOptions === 'boolean') {
      bufferOptions = {};
    }

    bufferOptions.featureGroup = this.options.featureGroup;

    if( !( 'replace_polylines' in bufferOptions ) ){
      bufferOptions.replace_polylines = true;
    }
    if( !( 'buffer_style' in bufferOptions ) ){
      bufferOptions.buffer_style = {
        fill: true,
        dashArray: '1, 10'
      };
    }
    if( !( 'separate_buffer' in bufferOptions ) ){
      bufferOptions.separate_buffer = false;
    }

    return modeHandlers.concat([{
      enabled: bufferOptions,
      handler: new L.EditToolbar.Buffer(map, bufferOptions)
    }]);
  };
  var _checkDisabled = L.EditToolbar.prototype._checkDisabled;
  L.EditToolbar.prototype._checkDisabled = function(){
    _checkDisabled.call(this);
    var featureGroup = this.options.featureGroup;
    var hasLayers = featureGroup.getLayers().length !== 0;
    var button;
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
      TYPE: 'buffer'
    },

    includes: L.Mixin.Events,

    _draggingLayer: null,
    _originalLayers: {},
    _bufferData: {},

    initialize: function (map, options) {
      L.Handler.prototype.initialize.call(this, map);
      // Set options to the default unless already set
      this._selectedPathOptions = options.selectedPathOptions;
      // Store the selectable layer group for ease of access
      this._featureGroup = options.featureGroup;
      this._replace_polyline = options.replace_polylines;
      this._separate_buffer = options.separate_buffer;
      this._buffer_style = options.buffer_style;

      if (!(this._featureGroup instanceof L.FeatureGroup)) {
        throw new Error('options.featureGroup must be a L.FeatureGroup');
      }

      this._unbufferedLayerProps = {};

      // Save the type so super can fire,
      // need to do this as cannot do this.TYPE :(
      this.type = L.EditToolbar.Buffer.TYPE;
    },

    enable: function () {
      if (this._enabled || !this._hasAvailableLayers()) {
        return;
      }
      this.fire('enabled', {handler: this.type});
      //this disable other handlers

      this._map.fire('draw:bufferstart', { handler: this.type });
      //allow drawLayer to be updated before beginning edition.

      L.Handler.prototype.enable.call(this);
      this._featureGroup
        .on('layeradd', this._enableLayerBuffer, this)
        .on('layerremove', this._disableLayerBuffer, this);
    },

    disable: function () {
      if (!this._enabled) { return; }
      this._featureGroup
        .off('layeradd', this._enableLayerBuffer, this)
        .off('layerremove', this._disableLayerBuffer, this);
      L.Handler.prototype.disable.call(this);
      this._map.fire('draw:bufferstop', { handler: this.type });
      this.fire('disabled', {handler: this.type});
    },

    addHooks: function () {
      var map = this._map;
      if (map) {
        map.getContainer().focus();
        this._featureGroup.eachLayer(this._enableLayerBuffer, this);
        this._tooltip = new L.Tooltip(this._map);
        this._setTooltip(L.drawLocal.edit.handlers.buffer.tooltip.text);
        this._map.on('mousemove', this._onMouseMove, this);
      }
    },

    removeHooks: function () {
      if (this._map) {
        // Clean up selected layers.
        this._featureGroup.eachLayer(this._disableLayerBuffer, this);

        // Clear the backups of the original layers
        this._unbufferedLayerProps = {};

        this._tooltip.dispose();
        this._tooltip = null;

        this._map.off('mousemove', this._onMouseMove, this);
      }
    },

    revertLayers: function () {
      this._featureGroup.eachLayer(function (layer) {
        this._revertLayer(layer);
      }, this);
    },

    save: function () {
      var bufferedLayers = new L.LayerGroup();
      var deletedPolylines = new L.LayerGroup();
      this._featureGroup.eachLayer(function (layer) {
        var ol = this._originalLayers[L.Util.stamp(layer)];
        if (layer.buffered) {
          bufferedLayers.addLayer(layer);
          layer.buffered = false;
        }
        if(ol){
          this._map.fire('draw:created', {layer: layer});
          if( this._replace_polyline ){
            deletedPolylines.addLayer(ol);
          }
        }
      }.bind(this));
      this._originalLayers = {};
      this._map.fire('draw:buffered', {layers: bufferedLayers});
      this._map.fire('draw:deleted', {layers: deletedPolylines});
    },

    _backupLayer: function (layer) {
      var id = L.Util.stamp(layer);
      if (!this._unbufferedLayerProps[id]) {
        // Polygon or Rectangle
        if( layer instanceof L.Polygon || layer instanceof L.Rectangle ){
          this._unbufferedLayerProps[id] = {
            latlngs: L.LatLngUtil.cloneLatLngs(layer.getLatLngs())
          };
        }
        // Circle
        else if (layer instanceof L.Circle) {
          this._unbufferedLayerProps[id] = {
            latlng: L.LatLngUtil.cloneLatLng(layer.getLatLng()),
            radius: layer.getRadius()
          };
        }
      }
    },

    _revertLayer: function (layer) {
      var id = L.Util.stamp(layer);
      layer.buffered = false;
      if( id in this._originalLayers ){
        // a polyline that got replaced with a polygon
        this._featureGroup.addLayer(this._originalLayers[id]);
        this._featureGroup.removeLayer(layer);
        delete this._originalLayers[id];
      }
      else if (this._unbufferedLayerProps.hasOwnProperty(id)) {
        // Polygon or Rectangle
        if( layer instanceof L.Polygon || layer instanceof L.Rectangle ){
          layer.setLatLngs(this._unbufferedLayerProps[id].latlngs);
        } else if (layer instanceof L.Circle) {
          layer.setLatLng(this._unbufferedLayerProps[id].latlng);
          layer.setRadius(this._unbufferedLayerProps[id].radius);
        }
      }
      else if( layer instanceof L.Polygon ){
        // a Polygon created from a polyline -- just delete
        this._map.removeLayer(layer);
      }
    },

    _enableLayerBuffer: function (e) {
      var layer = e.layer || e.target || e;

      if( !(layer instanceof L.Marker) ){
        // Back up this layer (if haven't before)
        this._backupLayer(layer);
        layer.buffered = true;
        layer.on('mousedown', this._onLayerDragStart, this);
        this._map.on('mouseup', this._onLayerDragEnd, this);
      }
    },

    _disableLayerBuffer: function (e) {
      var layer = e.layer || e.target || e;
      layer.buffered = false;
      this._bufferData = {};

      layer.off('mousedown', this._onLayerDragStart, this);
      this._map.off('mouseup', this._onLayerDragEnd, this);
    },

    _onLayerDragStart: function(e){
      var layer = e.layer || e.target || e;
      var layerIsPolygon = layer instanceof L.Polygon;
      var layerid = L.Util.stamp(layer);
      if( ( layer instanceof L.Polyline && !layerIsPolygon ) ||
          ( this._separate_buffer && !(layerid in this._originalLayers) ) ){

        var newGeo = this._buffer(layer.toGeoJSON(), 0.00001);
        layer = new L.Polygon(newGeo.coordinates[0].map(geoJsonToLatLng));
        var newLayerId = L.Util.stamp(layer);
        this._originalLayers[newLayerId] = layer;
        layer.setStyle(this._buffer_style);
        if( this._replace_polyline && !layerIsPolygon ){
          this._featureGroup.removeLayer(layer);
        }
        this._featureGroup.addLayer(layer);
      }
      this._map.on('mousemove', this._onLayerDrag, this);
      this._draggingLayer = layer;
      this._draggingLayerId = L.Util.stamp(layer);
      if( !( this._draggingLayerId in this._bufferData ) ){
        if( layer instanceof L.Circle ){
          this._bufferData[this._draggingLayerId] = {
            radius: layer.getRadius(),
            temp_radius: 0,
            orig_geoJSON: layer.toGeoJSON()
          };
        }
        else{
          this._bufferData[this._draggingLayerId] = {
            size: 0,
            temp_size: 0,
            radius: 0,
            temp_radius: 0,
            orig_geoJSON: layer.toGeoJSON()
          };
        }
      }
      var centroid = layer.getCentroid();
      this._bufferData[this._draggingLayerId].centroid = centroid;
      this._bufferData[this._draggingLayerId].orig_distanceToCenter =
        e.latlng.distanceTo(this._bufferData[this._draggingLayerId].centroid);
      this._setTooltip(this._bufferData[this._draggingLayerId].radius);
    },

    _onLayerDrag: function(e){
      e.originalEvent.stopPropagation();
      var data = this._bufferData[this._draggingLayerId];
      // this calculates the buffer distance in ~meters
      var distance =
        ( data.centroid.distanceTo( e.latlng ) - data.orig_distanceToCenter );
      data.temp_radius = data.radius + distance;
      this._setTooltip(data.temp_radius);

      if( this._draggingLayer instanceof L.Circle ){
        this._draggingLayer.setRadius( data.temp_radius );
      }
      else{
        // buffer seems to be based on deg lat,
        // so this converts meter distance to ~degrees
        distance /= 111120;
        data.temp_size = data.size + distance;
        var newGeometry = this._buffer(data.orig_geoJSON, data.temp_size);
        if( newGeometry.type !== 'MultiPolygon' ){
          this._draggingLayer.setLatLngs(
            newGeometry.coordinates[0].map(geoJsonToLatLng)
          );
        }
        else{
          // todo: handle multipolygons
        }
      }
    },

    _onLayerDragEnd: function(e){
      var data = this._bufferData[this._draggingLayerId];
      if( data ){
        data.size = data.temp_size;
        data.radius = data.temp_radius;
      }
      this._map.off('mousemove', this._onLayerDrag, this);
      this._draggingLayer = null;
      this._setTooltip(L.drawLocal.edit.handlers.buffer.tooltip.text);
    },

    _onMarkerDragEnd: function (e) {
      var layer = e.target;
      layer.edited = true;
    },

    _onMouseMove: function (e) {
      this._tooltip.updatePosition(e.latlng);
    },

    _hasAvailableLayers: function () {
      return this._featureGroup.getLayers().length !== 0;
    },

    _setTooltip: function(radiusOrMessage){
      var message;
      if( typeof radiusOrMessage === 'string' ){
        message = radiusOrMessage;
      }
      else{
        var radiusM = radiusOrMessage;
        var radiusKm = radiusM / 1000;
        var radiusFt = radiusM * 3.28084;
        var radiusMi = radiusFt / 5280;
        var metricUnit = radiusKm >= 1 ? 'km' : 'm';
        var metricValue = (radiusKm >= 1 ? radiusKm : radiusM).toFixed(2);
        var imperialUnit = radiusMi >= 0.1 ? 'mi' : 'ft';
        var imperialValue = (radiusMi >= 0.1 ? radiusMi : radiusFt).toFixed(2);
        message  = 'Buffer radius: ';
        message += metricValue + metricUnit + ' ';
        message += imperialValue + imperialUnit + ' ';
      }
      this._tooltip.updateContent({text: message});
    },

    _buffer: function(geoJSON, radius){
      // based on Daniel Kempkens' code @ https://coderwall.com/p/zb_zdw
      var geoReader = new jsts.io.GeoJSONReader();
      var geoWriter = new jsts.io.GeoJSONWriter();
      var geometry = geoReader.read(geoJSON).geometry.buffer(radius);
      return geoWriter.write(geometry);
    }
  });
})(window, document);
