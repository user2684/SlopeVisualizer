// Global variables
var map = null
// define map options
const mapOptions = {
    zoom: 5,
    center: { lat: 46.29723451546328, lng: 4.577189759515817 },
    tooltip: {isHtml: true},
    gestureHandling: 'greedy',
}
// define chart options
var chartOptions = {
    width: "100%",
    height: "500",
    lineWidth: 5,
    pointsVisible: true,
    legend: 'none',
    vAxis: {
        title: "Elevation (m)",
    },
    hAxis: {
        title: "Distance (Km)",
    },
}
// define other variables
var distance = null
var samples = null
var origin = null
var destination = null
var marker_origin = null
var marker_destination = null
var sample_every_meters = 500
var output_every_meters = 1000
var directionsService = null
var directionsRenderer = null
var markers = []

// load dependencies
google.charts.load('current', {'packages':['corechart']});

// retrieve URL parameters
function getURLParameter(parameterName) {
    var result = null,
        tmp = [];
    window.location.hash.substr(1).split("&").forEach(function (item) {
          tmp = item.split("=");
          if (tmp[0] === parameterName) result = decodeURIComponent(tmp[1]);
    });
    return result;
}

// set URL parameters
function setURLParameter(parameterName, value) {
    var parameters = []
    if (window.location.hash != "") parameters = window.location.hash.substr(1).split("&")
    var found = false
    for (var i = 0; i < parameters.length; i++) {
        tmp = parameters[i].split("=")
        if (tmp[0] === parameterName) {
            found = true
            parameters[i] = parameterName+"="+encodeURIComponent(value)
        }
    }
    if (! found) parameters.push(parameterName+"="+encodeURIComponent(value))
    window.location.hash = parameters.join("&")
}

// get canvas position
function getCanvasXY(caurrentLatLng){
    var scale = Math.pow(2, map.getZoom());
    var nw = new google.maps.LatLng(
        map.getBounds().getNorthEast().lat(),
        map.getBounds().getSouthWest().lng()
    );
    var worldCoordinateNW = map.getProjection().fromLatLngToPoint(nw);
    var worldCoordinate = map.getProjection().fromLatLngToPoint(caurrentLatLng);
    var caurrentLatLngOffset = new google.maps.Point(
        Math.floor((worldCoordinate.x - worldCoordinateNW.x) * scale),
        Math.floor((worldCoordinate.y - worldCoordinateNW.y) * scale)
    );
    return caurrentLatLngOffset;
}

// set the context menu position
function setMenuXY(caurrentLatLng) {
  var mapWidth = $('#map').width();
  var mapHeight = $('#map').height();
  var menuWidth = $('.contextmenu').width();
  var menuHeight = $('.contextmenu').height();
  var clickedPosition = getCanvasXY(caurrentLatLng);
  var x = clickedPosition.x ;
  var y = clickedPosition.y ;
   if((mapWidth - x ) < menuWidth)
       x = x - menuWidth;
  if((mapHeight - y ) < menuHeight)
      y = y - menuHeight;
  $('.contextmenu').css('left',x  );
  $('.contextmenu').css('top',y );
}

// show the context menu
function showContextMenu(caurrentLatLng) {
    var projection;
    var contextmenuDir;
    projection = map.getProjection() ;
    $('.contextmenu').remove();
    contextmenuDir = document.createElement("div");
    contextmenuDir.className  = 'contextmenu';
    contextmenuDir.innerHTML = "<a id='set_origin'><div class=context>Set Origin<\/div><\/a><a id='set_destination'><div class=context>Set Destination<\/div><\/a>";
    $(map.getDiv()).append(contextmenuDir);
    setMenuXY(caurrentLatLng);
    contextmenuDir.style.visibility = "visible";
    // bind click actions on the menu items
    $("#set_origin").unbind().click(function() {
        setOrigin(caurrentLatLng)
        contextmenuDir.style.visibility = "hidden";
    })
    $("#set_destination").unbind().click(function() {
        setDestination(caurrentLatLng)
        contextmenuDir.style.visibility = "hidden";
    })
}

// remove all markers and routes from the map
function clearMap() {
    // remove the previously drawn route and marker
    if (directionsRenderer != null) directionsRenderer.setMap(null)
    if (marker_origin != null) marker_origin.setMap(null);
    if (marker_destination != null) marker_destination.setMap(null);
    for (var marker of markers) marker.setMap(null)
    markers.length = 0;
}

// set the origin of the route
function setOrigin(position) {
    clearMap()
    origin = position
    // draw the origin marker
    marker_origin = new google.maps.Marker({
        position: origin,
        map: map
    });
    setURLParameter("origin", position.lat()+","+position.lng())
}

// set the destination of the route
function setDestination(position) {
    clearMap()
    destination = position
    // draw the destination marker
    marker_destination = new google.maps.Marker({
        position: destination,
        map: map
    });
    // calculate the route between origin and destination
    calculateRoute()
    setURLParameter("destination", position.lat()+","+position.lng())
}

// calculate the slope percentage between two points
function calculateSlope(from, to, distance) {
    var slope = (to - from)/distance*100
    return Math.round(slope * 10) / 10
}

// on map initialize
function initMap() {
    // draw the map and initiliaze supporting services
    map = new google.maps.Map(document.getElementById('map'), mapOptions)
    directionsService = new google.maps.DirectionsService()
    directionsRenderer = new google.maps.DirectionsRenderer()
    // add left click listener (origin point)
    google.maps.event.addListener(map, 'click', function( event ) {
        showContextMenu(event.latLng)
    });
    // add right click listener (destination point)
    google.maps.event.addListener(map, 'rightclick', function( event ) {
        showContextMenu(event.latLng)
    });
    // parse parameters
    var input_origin = getURLParameter("origin")
    var input_destination = getURLParameter("destination")
    if (input_origin !=null && input_destination !=null) {
        input_origin = input_origin.split(",")
        input_destination = input_destination.split(",")
        setOrigin(new google.maps.LatLng(input_origin[0],input_origin[1]))
        setDestination(new google.maps.LatLng(input_destination[0],input_destination[1]))
        map.setCenter(marker_destination.getPosition());  
    }
  }

  // calculate the route between the origin and destination markers
function calculateRoute() {
    directionsRenderer.setMap(map);
    // define route calculation options
    var routeOptions = {
        origin: origin,
        destination: destination,
        travelMode: 'DRIVING'
    };
    // calculate the route
    directionsService.route(routeOptions, function(result, status) {
        if (status == 'OK') {
            // get the directions
            directionsRenderer.setDirections(result);
            // get the path (array of waypoints)
            var path = result["routes"][0]["overview_path"]
            // get the distance
            distance = parseInt(result["routes"][0]["legs"][0]["distance"]["value"]/100)*100
            // initialize the elevation service
            const elevationService = new google.maps.ElevationService();
            // request elevation by splitting the distance in equally distanced points
            samples = parseInt(distance/sample_every_meters)+2
            // calculate elevation along the path
            elevationService.getElevationAlongPath({
                path: path,
                samples: samples
            }).then(drawProfile)
        }
    });
}

// draw the profile of the selected path
function drawProfile({ results }) {
    // initialize variables
    var prev_segment = null
    var max_slope_segment = 0
    var max_slope_path = 0
    var max_slope_distance = 0
    var prev_point = null
    var count = 1
    var first_point = null
    var last_point = null
    var prev_distance = 0
    var climb = 0
    // define data structure
    const data = new google.visualization.DataTable();
    data.addColumn("string", "Distance"); // 0
    data.addColumn("number", "Elevation"); // 1
    data.addColumn("number", "Slope"); // 2
    data.addColumn({type:'string', role:'annotation'}); // 3
    data.addColumn({type:'string', role:'annotation'}); // 4
    data.addColumn({type: 'string', role: 'tooltip', p: {'html': true}}) // 5

    // for each point of the result set
    for (const point of results) { 
        point["elevation"] = parseInt(point["elevation"])
        // this is the first point
        if (first_point == null) {
            first_point = point
            prev_segment = point
            data.addRow(["0", point["elevation"], 0, "", "","km 0\nElevation: "+point["elevation"]+"m"]);
        }
        // save the current point
        if (prev_point == null) {
            prev_point = point
            continue
        }
        // calculate slope percentage between the previous and current point
        var slope_point = calculateSlope(prev_point["elevation"], point["elevation"], sample_every_meters)
        if (slope_point > 0) climb += point["elevation"]-prev_point["elevation"]
        // distance so far to display
        var distance_so_far = count/(1000/sample_every_meters)+"" 
        // keep track of the maximum slope along the path
        if (slope_point > max_slope_segment) max_slope_segment = slope_point
        if (slope_point > max_slope_path) {
            max_slope_distance = distance_so_far
            max_slope_path = slope_point
        }
        // if it is the time to output the results for the current segment
        if (count % (output_every_meters/sample_every_meters) == 0) {
            // calculate the slope of the segment
            var slope_segment = calculateSlope(prev_segment["elevation"], point["elevation"], output_every_meters)
            // draw the marker
            var marker = new google.maps.Marker({
                position: point["location"],
                map,
                label: distance_so_far,
            });
            markers.push(marker)
            var tooltip = "Km: "+prev_distance+" - "+distance_so_far+"\nElevation: "+prev_segment["elevation"]+"m - "+point["elevation"]+"m\nSlope: "+slope_segment+"% (max "+max_slope_segment+"%)"
            // add a new data point for the chart
            data.addRow([distance_so_far, point["elevation"], slope_segment, slope_segment+"%", "", tooltip]);
            prev_segment = point
            max_slope_segment = 0
            prev_distance = distance_so_far
        }
        prev_point = point
        last_point = point
        count++
    }
    // calculate slope of the entire route
    var slope_path = calculateSlope(first_point["elevation"], last_point["elevation"], count*sample_every_meters)
    var distance_km = Math.round(distance/100)/10
    document.getElementById("route_info").innerHTML = distance_km+"km ("+climb+"m climb)"
    document.getElementById("slope_info").innerHTML = "Slope "+slope_path+"% (max "+max_slope_path+"%)"
    // post-process the dataset
    var dataView = new google.visualization.DataView(data);
    dataView.setColumns([
     0, 1, 
        {
            calc: function(data, row) {
                // set a color of the segment based on the calculated slope
                var slope = data.getValue(row, 2)
                if (slope < 4) return '#808080'
                else if (slope < 7) return '#0000FF'
                else if (slope < 10) return '#FF0000'
                else return '#000000'
            },
            type: 'string',
            role: 'style'
        }, 3, 
        {
            calc: function(data, row) {
                // set a color of the segment based on the calculated slope
                var distance = data.getValue(row, 0)
                if (distance == max_slope_distance) return "(km "+max_slope_distance+" max "+max_slope_path+"%)"
                return ""
            },
            type: 'string',
            role: 'annotation'
        }, 5
    ]);
    // identify the slope chart
    var slopeChart = new google.visualization.LineChart(document.getElementById('elevation_chart'));
    // draw the chart
    slopeChart.draw(dataView, chartOptions);
    var latlngbounds = new google.maps.LatLngBounds();
    for (var i = 0; i < markers.length; i++) {
        latlngbounds.extend(markers[i].getPosition());
    }
    map.fitBounds(latlngbounds);
}
