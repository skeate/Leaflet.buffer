L.bufferVersion = '0.0.1-dev';

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

	initialize: function (map, options) {
		L.Handler.prototype.initialize.call(this, map);

		// Set options to the default unless already set
		this._selectedPathOptions = options.selectedPathOptions;

		// Store the selectable layer group for ease of access
		this._featureGroup = options.featureGroup;

		if (!(this._featureGroup instanceof L.FeatureGroup)) {
			throw new Error('options.featureGroup must be a L.FeatureGroup');
		}

		this._uneditedLayerProps = {};

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
			this._tooltip.updateContent({
				text: L.drawLocal.edit.handlers.buffer.tooltip.text
			});

			this._map.on('mousemove', this._onMouseMove, this);
		}
	},

	removeHooks: function () {
		if (this._map) {
			// Clean up selected layers.
			this._featureGroup.eachLayer(this._disableLayerBuffer, this);

			// Clear the backups of the original layers
			this._uneditedLayerProps = {};

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
		if (this._uneditedLayerProps.hasOwnProperty(id)) {
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

	_toggleMarkerHighlight: function (marker) {
		if (!marker._icon) {
			return;
		}
		// This is quite naughty, but I don't see another way of doing it. (short of setting a new icon)
		var icon = marker._icon;

		icon.style.display = 'none';

		if (L.DomUtil.hasClass(icon, 'leaflet-buffer-marker-selected')) {
			L.DomUtil.removeClass(icon, 'leaflet-buffer-marker-selected');
			// Offset as the border will make the icon move.
			this._offsetMarker(icon, -4);

		} else {
			L.DomUtil.addClass(icon, 'leaflet-buffer-marker-selected');
			// Offset as the border will make the icon move.
			this._offsetMarker(icon, 4);
		}

		icon.style.display = '';
	},

	_offsetMarker: function (icon, offset) {
		var iconMarginTop = parseInt(icon.style.marginTop, 10) - offset,
			iconMarginLeft = parseInt(icon.style.marginLeft, 10) - offset;

		icon.style.marginTop = iconMarginTop + 'px';
		icon.style.marginLeft = iconMarginLeft + 'px';
	},

	_enableLayerBuffer: function (e) {
		var layer = e.layer || e.target || e,
			isMarker = layer instanceof L.Marker,
			pathOptions;

		// Don't do anything if this layer is a marker but doesn't have an icon. Markers
		// should usually have icons. If using Leaflet.draw with Leafler.markercluster there
		// is a chance that a marker doesn't.
		if (isMarker && !layer._icon) {
			return;
		}

		// Back up this layer (if haven't before)
		this._backupLayer(layer);

		// Update layer style so appears editable
		if (this._selectedPathOptions) {
			pathOptions = L.Util.extend({}, this._selectedPathOptions);

			// Use the existing color of the layer
			if (pathOptions.maintainColor) {
				pathOptions.color = layer.options.color;
				pathOptions.fillColor = layer.options.fillColor;
			}

			if (isMarker) {
				this._toggleMarkerHighlight(layer);
			} else {
				layer.options.previousOptions = L.Util.extend({ dashArray: null }, layer.options);

				// Make sure that Polylines are not filled
				if (!(layer instanceof L.Circle) && !(layer instanceof L.Polygon) && !(layer instanceof L.Rectangle)) {
					pathOptions.fill = false;
				}

				layer.setStyle(pathOptions);
			}
		}

		if (isMarker) {
			layer.dragging.enable();
			layer.on('dragend', this._onMarkerDragEnd);
		} else {
			layer.editing.enable();
		}
	},

	_disableLayerBuffer: function (e) {
		var layer = e.layer || e.target || e;
		layer.edited = false;

		// Reset layer styles to that of before select
		if (this._selectedPathOptions) {
			if (layer instanceof L.Marker) {
				this._toggleMarkerHighlight(layer);
			} else {
				// reset the layer style to what is was before being selected
				layer.setStyle(layer.options.previousOptions);
				// remove the cached options for the layer object
				delete layer.options.previousOptions;
			}
		}

		if (layer instanceof L.Marker) {
			layer.dragging.disable();
			layer.off('dragend', this._onMarkerDragEnd, this);
		} else {
			layer.editing.disable();
		}
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
