L.bufferVersion = '0.0.1-dev';

function geoJsonToLatLng(geoJson){
  return L.latLng(geoJson[1], geoJson[0]);
}

function haversine_distance(latLng1, latLng2){
  var haversin = function(theta){
    return Math.sin(theta/2) * Math.sin(theta/2);
  };
  var R = 6371; // km
  var lat1 = latLng1.lat * Math.PI / 180;
  var lat2 = latLng2.lat * Math.PI / 180;
  var lng1 = latLng1.lng * Math.PI / 180;
  var lng2 = latLng2.lng * Math.PI / 180;
  var d_lat = lat2 - lat1;
  var d_lng = lng2 - lng1;
  var a = haversin(d_lat) + Math.cos(lat1) * Math.cos(lat2) * haversin(d_lng);
  var c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c;
}

function cartesian_distance(latLng1, latLng2){
  var d_lat = latLng2.lat - latLng1.lat;
  var d_lng = latLng2.lng - latLng1.lng;
  return Math.sqrt(d_lat * d_lat + d_lng * d_lng);
}

L.Polygon.include({
  getCentroid: function(){
    return this.getLatLngs().reduce(function(data, next){
      data.count++;
      data.latSum += next.lat;
      data.lngSum += next.lng;
      data.avg = L.latLng(data.latSum/data.count, data.lngSum/data.count);
      return data;
    }, {count: 0, latSum: 0, lngSum: 0}).avg;
  }
});

L.drawLocal.edit.toolbar.buttons.buffer = 'Expand layers.';
L.drawLocal.edit.toolbar.buttons.bufferDisabled = 'No layers to expand.';
L.drawLocal.edit.handlers.buffer = { tooltip: { text: 'Click and drag to expand or contract a shape.' } };

var getModeHandlers = L.EditToolbar.prototype.getModeHandlers;
L.EditToolbar.prototype.getModeHandlers = function(map){
  var options = this.options.buffer;
  if( options ){
    options.featureGroup = this.options.featureGroup;
    if( !( 'replace_polyline' in options ) ){ options.replace_polyline = true; }
  }
  return getModeHandlers.call(this, map).concat([{
    enabled: options,
    handler: new L.EditToolbar.Buffer(map, options)
  }]);
};

L.EditToolbar.Buffer = L.Handler.extend({
  statics: {
    TYPE: 'buffer'
  },

  includes: L.Mixin.Events,

  _draggingLayer: null,
  _originalPolylines: {},
  _bufferData: {},

  initialize: function (map, options) {
    L.Handler.prototype.initialize.call(this, map);

    // Set options to the default unless already set
    this._selectedPathOptions = options.selectedPathOptions;

    // Store the selectable layer group for ease of access
    this._featureGroup = options.featureGroup;

    this._replace_polyline = options.replace_polyline;

    if (!(this._featureGroup instanceof L.FeatureGroup)) {
      throw new Error('options.featureGroup must be a L.FeatureGroup');
    }

    this._unbufferedLayerProps = {};

    // Save the type so super can fire, need to do this as cannot do this.TYPE :(
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
      this._tooltip.updateContent({ text: L.drawLocal.edit.handlers.buffer.tooltip.text });

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
    this._featureGroup.eachLayer(function (layer) {
      if (layer.buffered) {
        bufferedLayers.addLayer(layer);
        layer.buffered = false;
      }
    });
    this._map.fire('draw:buffered', {layers: bufferedLayers});
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
    if( id in this._originalPolylines ){
      // a polyline that got replaced with a polygon
      this._featureGroup.addLayer(this._originalPolylines[id]);
      delete this._originalPolylines[id];
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
      layer.on('mousedown', this._onLayerDragStart, this);
      this._map.on('mouseup', this._onLayerDragEnd, this);
    }
  },

  _disableLayerBuffer: function (e) {
    var layer = e.layer || e.target || e;
    layer.edited = false;

    layer.off('mousedown', this._onLayerDragStart, this);
    this._map.off('mouseup', this._onLayerDragEnd, this);
  },

  _onLayerDragStart: function(e){
    var layer = e.layer || e.target || e;
    console.log('dragging started');

    if( layer instanceof L.Polyline && !(layer instanceof L.Polygon) ){
      var temp = layer;
      var geoReader = new jsts.io.GeoJSONReader(),
          geoWriter = new jsts.io.GeoJSONWriter();
      var geometry = geoReader.read(temp.toGeoJSON()).geometry.buffer(0);
      layer = new L.Polygon(geoWriter.write(geometry).coordinates[0].map(geoJsonToLatLng));
      layer.options.fill = true;
      layer.setStyle('fill', true);
      this._originalPolylines[L.Util.stamp(layer)] = temp;
      if( this._replace_polyline ){
        this._featureGroup.removeLayer(temp);
      }
      this._featureGroup.addLayer(layer);
    }
    this._startingPosition = e.latLng;
    this._map.on('mousemove', this._onLayerDrag, this);
    this._draggingLayer = layer;
    this._draggingLayerId = L.Util.stamp(layer);
    var centroid = layer.getCentroid();
    if( !( this._draggingLayerId in this._bufferData ) ){
      this._bufferData[this._draggingLayerId] = {
        size: 0,
        orig_geoJSON: layer.toGeoJSON()
      };
    } 
    this._bufferData[this._draggingLayerId].centroid = centroid;
    this._bufferData[this._draggingLayerId].orig_distanceToCenter = e.latlng.distanceTo(this._bufferData[this._draggingLayerId].centroid);
  },

  _onLayerDrag: function(e){
    var data = this._bufferData[this._draggingLayerId];
    var distance = ( data.centroid.distanceTo( e.latlng ) - data.orig_distanceToCenter ); // 111120;
    //console.log('haversine function: '+haversine_distance(e.latlng, data.centroid));
    //console.log('built-in function: '+data.centroid.distanceTo(e.latlng));
    console.log('distance: ' + distance + 'm' );
    distance /= 111120;
    // based on Daniel Kempkens' code @ https://coderwall.com/p/zb_zdw
    var geoReader = new jsts.io.GeoJSONReader(),
        geoWriter = new jsts.io.GeoJSONWriter();
    var geometry = geoReader.read(data.orig_geoJSON).geometry.buffer(data.size + distance);
    var newGeometry = geoWriter.write(geometry);
    if( newGeometry.type !== 'MultiPolygon' ){
      this._draggingLayer.setLatLngs(newGeometry.coordinates[0].map(geoJsonToLatLng));
    }
  },

  _onLayerDragEnd: function(e){
    var data = this._bufferData[this._draggingLayerId];
    var distance = ( data.centroid.distanceTo( e.latlng ) - data.orig_distanceToCenter ); // 111120;
    distance /= 111120;
    data.size += distance;
    console.log('dragging ended');
    this._map.off('mousemove', this._onLayerDrag, this);
    this._draggingLayer = null;
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
  }
});
