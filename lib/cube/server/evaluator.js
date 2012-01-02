var endpoint = require("./endpoint"),
    tiers = require("./tiers"),
	util = require("util"),
	url = require("url");

exports.register = function(db, endpoints) {
  var event = require("./event").getter(db),
	metric = require("./metric").getter(db);
  endpoints.ws.push(
    endpoint.exact("/1.0/event/get", event),
    endpoint.exact("/1.0/metric/get", metric)
  );
  endpoints.http.push(
	endpoint.exact("GET", "/1.0/event/get", get(event)),
	endpoint.exact("GET", "/1.0/metric/get", get(metric))
  )
};

function get(getter) {
  return function(request, response) {
	
	var expectedResponses = 0;
	var responses = [];
	function callback(res) {
		responses.push(res);
		
		if (responses.length >= expectedResponses) {
			//sort
			function compareDates(a, b) {
				return a.time - b.time;
			}
			var sortedResponses = responses.sort(compareDates);
			
			//finish
			response.writeHead(200, {
		        "Content-Type": "application/json",
		        "Access-Control-Allow-Origin": "*"
		    });
			response.end(JSON.stringify(sortedResponses));
			return;
		}
	}
	
    var u = url.parse(request.url, true);
	try {
		var startString = decodeURIComponent(u.query["start"]),
			stopString = decodeURIComponent(u.query["stop"]),
			step = decodeURIComponent(u.query["step"]),
			start = new Date(startString),
	        stop = new Date(stopString),
			tier = tiers[step];
		
		if (isNaN(start)) throw "invalid start date: " + startString;
		if (isNaN(stop)) throw "invalid end date: " + stopString;
		
		if (!tier) return util.log("invalid step: " + request.step);
		start = tier.floor(start);
		stop = tier.ceil(stop);
		
		//calculate expected number of results
		var startTicks = Date.parse(start.toUTCString());
		var stopTicks = Date.parse(stop.toUTCString());
		expectedResponses = (stop - start) / step;
		
		var body = {
			expression: u.query["expression"],
			start: start,
			stop: stop,
			step: u.query["step"]
		};
		
		getter(body, callback);
	}
	catch (e) {
        util.log(e);
        response.writeHead(400, {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*"
        });
        return response.end("{\"status\":400}");
      }
  };
}

