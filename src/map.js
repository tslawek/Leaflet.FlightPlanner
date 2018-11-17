var startPoint = [50.07333304, 19.78416353];


var map = L.map('map',{
  center: startPoint,
  zoom: 6
});
var profile = L.map('profile', {
  crs: L.CRS.Simple,
  profile: true,
  minZoom: -5,
  maxBounds: [
    [-2, -5],
    [1000, 1000]
  ]
}).setView([-2,-5], -5);

var showCoord = L.control.coordinates({
  position:"bottomleft",
  useDMS:true,
  useLatLngOrder:true
});
showCoord.addTo(map);

tilelayer = L.tileLayer('https://cartodb-basemaps-{s}.global.ssl.fastly.net/light_all/{z}/{x}/{y}.png', {
    attribution: 'Data \u00a9 <a href="http://www.openstreetmap.org/copyright"> OpenStreetMap Contributors </a> Tiles \u00a9 <a href="http://carto.com">CARTO</a>'
  }).addTo(map);

// NAV layers
var subdomains = 'abc';
var navLayer = L.tileLayer('https://{s}.gis.flightplandatabase.com/tile/nav/{z}/{x}/{y}.png', {
  subdomains: subdomains,
  attribution: '',
  minZoom: 5,
  maxNativeZoom: 15
});
navLayer.addTo(map);
// FIR borders
var firBorders = L.tileLayer.wms('https://gis.icao.int/ArcGIS/rest/services/FIRMSD/MapServer/export?dpi=96&bboxSR=102100&imageSR=102100&f=image',
  {
    layers: 'FIR',
    format: 'png32',
    transparent: true,
    attribution: "ICAO",
    crs: L.CRS.EPSG3857
  });
firBorders.addTo(map);

// Airports
var airports = L.esri.featureLayer({
  url: "https://services1.arcgis.com/vHnIGBHHqDR6y0CR/arcgis/rest/services/World_Airport_Locations/FeatureServer/0",
  pointToLayer: function (airportPoint, latlng) {
    return L.circleMarker(latlng,
      {
        radius: 3,
        fillColor: "#ca7049",
        fillOpacity: 0.4,
        color: "#000",
        weight: 1
      }
    ).bindTooltip(
      "<h3>"+airportPoint.properties.ICAO+" "+"<span style='color:red'>"+airportPoint.properties.IATA+
      "</span></h3>"+airportPoint.properties["Airport_Name"]+
      "<br><small>"+airportPoint.properties.City+"<small>",
      { opacity: 0.8 }).openTooltip();
  }
});
airports.addTo(map);

// Weather layers
var d = new Date();
var cacheBypass = d.toJSON().split('T')[0] + '-' + (~~(d.getUTCHours() / 6) * 6).toFixed(0);
var tempLayer = L.tileLayer('https://{s}.gis.flightplandatabase.com/tile/temperature/{z}/{x}/{y}.png?c=' + cacheBypass, {
  subdomains: subdomains,
  attribution: '',
  maxNativeZoom: 10,
  opacity: 0.7
});
var windsLayer = L.tileLayer('https://{s}.gis.flightplandatabase.com/tile/winds/{z}/{x}/{y}.png?c=' + cacheBypass, {
  subdomains: subdomains,
  attribution: '',
  maxNativeZoom: 10
});
var cloudsLayer = L.tileLayer('https://{s}.gis.flightplandatabase.com/tile/clouds/{z}/{x}/{y}.png?c=' + cacheBypass, {
  subdomains: subdomains,
  attribution: '',
  maxNativeZoom: 10
});
var precipLayer = L.tileLayer('https://{s}.gis.flightplandatabase.com/tile/precip/{z}/{x}/{y}.png?c=' + cacheBypass, {
  subdomains: subdomains,
  attribution: '',
  maxNativeZoom: 10
});

L.control.layers(null, {
  "Temperature": tempLayer,
  "Clouds": cloudsLayer,
  "Precipitation": precipLayer,
  "Winds": windsLayer,
  "Nav": navLayer,
  "FIR": firBorders,
  "Airports": airports
}, {
  collapsed: false
}).addTo(map);

// Scale
L.control.scale().addTo(map, {
  maxWidth: 200
});

function ensurePrecision(val, precision) {
  var str = '' + val;
  if (precision > 0) {
    var pointIdx = str.indexOf('.');
    if (pointIdx > 0) {
      str = str.padEnd(precision - (str.length - pointIdx) + 1, '0');
    } else {
      str = str + '.' + '0'.repeat(precision);
    }
  }
  return str;
}

function latLabel(lat, precision = 0, NW = true) {
  var latStr = ensurePrecision( NW ? Math.abs(lat) : lat, precision);
  return latStr + (NW?(lat < 0 ? "S" : "N") : "°");
}

function lngLabel(lng, precision = 0, NW = true) {
  var lngStr = ensurePrecision(NW ? Math.abs(lng) : lng, precision);
  return lngStr + (NW?(lng < 0 ? "W" : "E") : "°");
}

function pointLatLngLabel(point, precision = 3, NW = true) {
  var lat = latLabel(_round(point.lat, precision), NW);
  var lng = lngLabel(_round(point.lng, precision), NW);
  return lat +(NW?"":":")+ lng;
}

// current location
map.on('mousemove', function(event){
  document.getElementById("currentloc").innerHTML = pointLatLngLabel(event.latlng);
});
map.on('mouseout', function(event){
  document.getElementById("currentloc").innerHTML = "";
});

// FeatureGroup is to store editable layers
var drawnItems = new L.FeatureGroup();
map.addLayer(drawnItems);

var drawControl = new L.Control.Draw({
  draw : {
    polygon: false,
    marker: false,
    rectangle: false,
    circle: false,
    circlemarker: false,
    polyline: {
      shapeOptions: {
        stroke: true,
        color: '#bb44bb',
        weight: 6,
        opacity: 0.8,
        fill: false,
        clickable: true,
        renderer: new L.Polyline.GCRenderer(),
        gcpoly: true
      }
    }
  },
  edit: {
    featureGroup: drawnItems,
    remove: false,
    edit: false
  }
});
map.addControl(drawControl);

// Truncate value based on number of decimals
var _round = function(num, len) {
  return Math.round(num*(Math.pow(10, len)))/(Math.pow(10, len));
};

// Generate popup content based on layer type
// - Returns HTML string, or null if unknown object
var getPopupContent = function(layer) {
  if (layer instanceof L.Polyline) {
    var latlngs = layer._defaultShape ? layer._defaultShape() : layer.getLatLngs(),
      distance = 0;
    if (latlngs.length < 2) {
      return "Distance: N/A";
    } else {
      for (var i = 0; i < latlngs.length-1; i++) {
        distance += latlngs[i].distanceTo(latlngs[i+1]);
      }
      return "Distance: "+_round(distance/1000, 2)+" km (" + _round(distance * 0.539957 / 1000, 2) + "NM)" +
        "<br><sub>Click to copy waypoints into clipboard</sub>";
    }
  }
  return null;
};

function resetTooltip(layer) {
  var content = getPopupContent(layer);
  if (content !== null) {
    layer.bindTooltip(content);
  }

  if (layer instanceof L.Polyline) {
    resetHeadings(layer);
    resetWaypointLabels(layer);
  }

  return content;
}

function resetHeadings(layer) {
  var headings = layer.editing.headings || [];
  var svg = map._renderer._container;
  headings.forEach(function(heading) {
    svg.removeChild(heading);
  });
  headings = [];
  var latlngs = layer.getLatLngs();
  latlngs.forEach(function(point, idx){
    if(idx===latlngs.length - 1) {
      return;
    }

    var next = latlngs[idx+1];
    var currPnt = map.latLngToLayerPoint(point), nextPnt = map.latLngToLayerPoint(next);
    if( currPnt.distanceTo(nextPnt) < 120 ) {
      // points to close one to each other with current zoom, skip to next iteration
      return;
    }

    var headingLoc = point.intermediatePointTo(next, 0.2);
    var headingLocAngleAnchor = point.intermediatePointTo(next, 0.275);

    var distance = point.distanceTo(next);
    var bearing = L.GeometryUtil.bearing(point, next);
    if(bearing<0) {
      bearing += 360;
    }
    var angle = L.GeometryUtil.angle(map, headingLoc, headingLocAngleAnchor) - 90;
    var text = (""+Math.round(bearing)).padStart(3,'0') + "° "+_round(distance * 0.539957 / 1000, 2) +"NM";

    var textNode = L.SVG.create('text'),
      rect = L.SVG.create('rect'),
      g = L.SVG.create('g');

    textNode.appendChild(document.createTextNode(text));
    textNode.setAttribute('font-size', '11px');
    textNode.setAttribute('y', '4');

    rect.setAttribute("width", "96px");
    rect.setAttribute("height", "16px");
    rect.setAttribute("fill", "white");
    rect.setAttribute("stroke", "#bb44bb");
    rect.setAttribute("stroke-width", "2");
    rect.setAttribute("rx", "8");
    rect.setAttribute("ry", "8");
    rect.setAttribute("y", "-8");

    if(angle>90) {
      angle-=180;
      textNode.setAttribute('x', '-93');
      rect.setAttribute("x", "-98");
    } else {
      textNode.setAttribute('x', '-3');
      rect.setAttribute("x", "-8");
    }

    g.appendChild(rect);
    g.appendChild(textNode);
    headingLoc = map.latLngToLayerPoint(headingLoc);
    g.setAttribute('transform', 'translate('+headingLoc.x+' '+headingLoc.y+') rotate('+angle+')');
    svg.appendChild(g);
    headings.push(g);
  });
  layer.editing.headings = headings;
}

function resetWaypointLabels(layer) {
  var waypointLabels = layer.editing.waypointLabels || [];
  var svg = map._renderer._container;
  waypointLabels.forEach(function(label) {
    svg.removeChild(label);
  });
  waypointLabels = [];
  var latlngs = layer.getLatLngs();

  function coordLabelNode(node, coord) {
    node.appendChild(document.createTextNode(coord.padStart(7, '0')));
    node.setAttribute('font-size', '10px');
    node.setAttribute('x', '2');
    return node;
  }

  latlngs.forEach(function(point, idx){
    var currPnt = map.latLngToLayerPoint(point);
    currPnt.y -= 36;

    // rotate point where label will be placed in order to place it "outside" of the route turns
    if( idx < latlngs.length - 1 ) {
      var next = latlngs[idx+1];
      var nb = L.GeometryUtil.bearing(point, next);
      if( nb < 0) {
        nb += 360;
      }
      if( idx > 0 ) {
        var pb = L.GeometryUtil.bearing(point, latlngs[idx-1]);
        if( pb < 0) {
          pb += 360;
        }
        var bearing;
        var bd = nb - pb;
        if( bd < 0 ) {
          bearing = bd >- 180 ? nb - (360 + bd) / 2 : nb - bd / 2;
        } else {
          bearing = bd > 180 ? pb + bd / 2 : pb - (360 - bd) / 2;
        }

        currPnt = map.latLngToLayerPoint(L.GeometryUtil.rotatePoint(map, map.layerPointToLatLng(currPnt), bearing, point));
      } else {
        // route start
        currPnt = map.latLngToLayerPoint(L.GeometryUtil.rotatePoint(map, map.layerPointToLatLng(currPnt), nb - 180, point));
      }
    } else {
      // route end
      var _pb = L.GeometryUtil.bearing(point, latlngs[idx-1]);
      if( _pb < 0) {
        _pb += 360;
      }
      currPnt = map.latLngToLayerPoint(L.GeometryUtil.rotatePoint(map, map.layerPointToLatLng(currPnt), _pb - 180, point));
    }

    var textNode = L.SVG.create('text'),
      latNode = L.SVG.create('tspan'),
      lngNode = L.SVG.create('tspan'),
      flNode = L.SVG.create('tspan'),
      rect = L.SVG.create('rect'),
      g = L.SVG.create('g');

    coordLabelNode(latNode, latLabel(_round(point.lat, 2), 2)).setAttribute('y', '11');
    coordLabelNode(lngNode, lngLabel(_round(point.lng, 2), 2)).setAttribute('y', '22');

    flNode.appendChild(document.createTextNode((''+Math.round(point.alt)).padStart(3, '0')));
    flNode.setAttribute('writing-mode','tb');
    flNode.setAttribute('glyph-orientation-vertical','90');
    flNode.setAttribute('font-size', '10px');
    flNode.setAttribute('font-weight', 'bold');
    flNode.setAttribute('letter-spacing', '1');
    flNode.setAttribute('y', '4');
    flNode.setAttribute('x', '47');

    textNode.appendChild(latNode);
    textNode.appendChild(lngNode);
    textNode.appendChild(flNode);

    textNode.setAttribute('x', '0');
    textNode.setAttribute('y', '0');

    rect.setAttribute("width", "55px");
    rect.setAttribute("height", "26px");
    rect.setAttribute("fill", "white");
    rect.setAttribute("stroke", "#bb44bb");
    rect.setAttribute("stroke-width", "2");
    rect.setAttribute("rx", "4");
    rect.setAttribute("ry", "4");
    rect.setAttribute("x", "0");
    rect.setAttribute("y", "0");


    g.appendChild(rect);
    g.appendChild(textNode);
    g.setAttribute('transform', 'translate('+(currPnt.x-27)+' '+(currPnt.y-13)+')');
    svg.appendChild(g);
    waypointLabels.push(g);
  });
  layer.editing.waypointLabels = waypointLabels;
}

// Object created - bind popup to layer, add to feature group
map.on(L.Draw.Event.CREATED, function(event) {
  var layer = event.layer;
  profile.fire('path:created', layer);
  resetTooltip(layer);
  layer.editing.enable();
  layer.on('edit', function() {
    resetTooltip(layer);
    profile.fire('path:edited', layer);
  });
  layer.on('editdrag', function() {
    resetHeadings(layer);
    resetWaypointLabels(layer);
    profile.fire('path:edited', layer);
  });
  layer.on('click', function() {
    map.fire('path:clicked', layer);
    profile.fire('path:clicked', layer);
  });
  layer.on('profile:edited', function(profile) {
    resetWaypointLabels(layer);
  });
  drawnItems.addLayer(layer);
});

map.on('zoom resize viewreset profile:edited', function() {
  drawnItems.eachLayer(function (layer) {
    if (layer instanceof L.Polyline) {
      resetHeadings(layer);
      resetWaypointLabels(layer);
    }
  });
});