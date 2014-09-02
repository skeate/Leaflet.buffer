L.bufferVersion = '0.0.1-dev';

function geoJsonToLatLng(geoJson){
  return L.latLng(geoJson[1], geoJson[0]);
}

function haversine_distance(latLng1, latLng2){
  var haversin = function(theta){
    return Math.sin(theta/2) * Math.sin(theta/2);
  };
  var R = 6.371; // Mm
  var lat1 = latLng1.lat * 180 / Math.PI;
  var lat2 = latLng2.lat * 180 / Math.PI;
  var lng1 = latLng1.lng * 180 / Math.PI;
  var lng2 = latLng2.lng * 180 / Math.PI;
  var d_lat = lat2 - lat1;
  var d_lng = lng2 - lng1;
  var a = haversin(d_lat/2) * Math.cos(lat1) * Math.cos(lat2) * haversin(d_lng/2);
  var c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c;
}

function cartesian_distance(latLng1, latLng2){
  var d_lat = latLng2.lat - latLng1.lat;
  var d_lng = latLng2.lng - latLng1.lng;
  return Math.sqrt(d_lat * d_lat + d_lng * d_lng);
}

L.drawLocal.edit.toolbar.buttons.buffer = 'Expand layers.';
L.drawLocal.edit.toolbar.buttons.bufferDisabled = 'No layers to expand.';
L.drawLocal.edit.handlers.buffer = { tooltip: { text: 'Click and drag to expand or contract a shape.' } };

L.EditToolbar.prototype.options.buffer = {};
var getModeHandlers = L.EditToolbar.prototype.getModeHandlers;
L.EditToolbar.prototype.getModeHandlers = function(map){
  return getModeHandlers.call(this, map).concat([{
    enabled: this.options.buffer,
    handler: new L.EditToolbar.Buffer(map, {
      featureGroup: this.options.featureGroup
    })
  }]);
};

L.EditToolbar.Buffer = L.Handler.extend({
	statics: {
		TYPE: 'buffer'
	},

	includes: L.Mixin.Events,

  _draggingLayer: null,

	initialize: function (map, options) {
		L.Handler.prototype.initialize.call(this, map);

		// Set options to the default unless already set
		this._selectedPathOptions = options.selectedPathOptions;

		// Store the selectable layer group for ease of access
		this._featureGroup = options.featureGroup;

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
		this._map.fire('draw:buffered', {layers: editedLayers});
	},

	_backupLayer: function (layer) {
		var id = L.Util.stamp(layer);

		if (!this._unbufferedLayerProps[id]) {
			// Polyline, Polygon or Rectangle
			if (layer instanceof L.Polyline || layer instanceof L.Polygon || layer instanceof L.Rectangle) {
				this._unbufferedLayerProps[id] = {
					latlngs: L.LatLngUtil.cloneLatLngs(layer.getLatLngs())
				};
			} else if (layer instanceof L.Circle) {
				this._unbufferedLayerProps[id] = {
					latlng: L.LatLngUtil.cloneLatLng(layer.getLatLng()),
					radius: layer.getRadius()
				};
			} else if (layer instanceof L.Marker) { // Marker
				this._unbufferedLayerProps[id] = {
					latlng: L.LatLngUtil.cloneLatLng(layer.getLatLng())
				};
			}
		}
	},

	_revertLayer: function (layer) {
		var id = L.Util.stamp(layer);
		layer.buffered = false;
		if (this._unbufferedLayerProps.hasOwnProperty(id)) {
			// Polyline, Polygon or Rectangle
			if (layer instanceof L.Polyline || layer instanceof L.Polygon || layer instanceof L.Rectangle) {
				layer.setLatLngs(this._unbufferedLayerProps[id].latlngs);
			} else if (layer instanceof L.Circle) {
				layer.setLatLng(this._unbufferedLayerProps[id].latlng);
				layer.setRadius(this._unbufferedLayerProps[id].radius);
			} else if (layer instanceof L.Marker) { // Marker
				layer.setLatLng(this._unbufferedLayerProps[id].latlng);
			}
		}
	},

	_enableLayerBuffer: function (e) {
		var layer = e.layer || e.target || e,
			isMarker = layer instanceof L.Marker;

    if( !isMarker ){
      // Back up this layer (if haven't before)
      this._backupLayer(layer);
      layer.on('mousedown', this._onLayerDragStart, this);
      //layer.on('click', this._onLayerDragEnd, this);
      this._map.on('mouseup', this._onLayerDragEnd, this);
    }
	},

	_disableLayerBuffer: function (e) {
		var layer = e.layer || e.target || e;
		layer.edited = false;

    layer.off('mousedown', this._onLayerDragStart, this);
    //layer.off('click', this._onLayerDragEnd, this);
    this._map.off('mouseup', this._onLayerDragEnd, this);
	},

  _onLayerDragStart: function(e){
    console.log('dragging started');
    this._startingPosition = e.latLng;
    //debugger;
    this._map.on('mousemove', this._onLayerDrag, this);
    this._draggingLayer = e.layer || e.target || e;
    //debugger;
    this._originalGeoJSON = this._draggingLayer.toGeoJSON();
    this._originalLatLng = e.latlng;
  },

  _onLayerDrag: function(e){
    var distance = cartesian_distance( e.latlng, this._originalLatLng );
    // based on Daniel Kempkens' code @ https://coderwall.com/p/zb_zdw
    var geoReader = new jsts.io.GeoJSONReader(),
        geoWriter = new jsts.io.GeoJSONWriter();
    var geometry = geoReader.read(this._originalGeoJSON).geometry.buffer(distance);
    this._draggingLayer.setLatLngs(geoWriter.write(geometry).coordinates[0].map(geoJsonToLatLng));
    if( this._draggingLayer instanceof L.Polyline ){
      this._draggingLayer.__proto__ = L.Polygon.prototype;
      this._draggingLayer.options.fill = true;
      this._draggingLayer.setStyle('fill', true);
    }
  },
  
  _onLayerDragEnd: function(e){
    console.log('dragging ended');
    this._featureGroup.off('mousemove', this._onLayerDrag, this);
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
