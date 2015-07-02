var nconf = require('nconf');
var util = require('util');

// First consider commandline arguments and environment variables, respectively.
nconf.argv().env();

// Then load configuration from a designated file.
nconf.file({ file: 'cc_config.json' });

var cc_app_id = nconf.get('app_id');

var mirror_devices = nconf.get('imagemirrors');

var WebSocketServer = require('ws').Server, WebSocket = require('ws')
  , wss = new WebSocketServer({port: 8080});

var sessions = {};

var nodecastor = require('nodecastor');
var device = new nodecastor.CastDevice({
      friendlyName: 'Living Room',
      address: '192.168.2.238',
      port: 8009
});

device.on('connect',function() {
	connected(device);
});

nodecastor.scan().on('offline', function(d) {
    console.log('Lost device');
    (sessions[d.friendlyName] || []).splice(0,-1);
  })
  .start();

var current_app_id = '';
var launched = false;

var handle_status = function(status,device) {
  if ( ! status ) {
    return;
  }
  if (status.applications && status.applications.length > 0) {
    current_app_id = status.applications[0].appId;
    if (status.applications[0].displayName == 'Backdrop') {
      current_app_id = null;
    }
  } else {
    return;
  }
  if (current_app_id === null || current_app_id === cc_app_id ) {
    handle_status = function() {};
    device.application(cc_app_id, function(err, a) {
      handle_status = orig_handle_status;
      if (!err) {
        if ( ! launched ) {
          launched = true;
          console.log("Launching "+cc_app_id+' application');
          got_application(a);
        }
      }
    });
  }
};

var orig_handle_status = handle_status;

var connected = function(d) {
  console.log("Connected to device");
  d.status(function(err, status) {
    if (err) {
      console.log(err);
      return;
    }
    handle_status(status,d);
  });

  d.on('status', function(status) {
    console.log("Got a status, launched is "+launched);
    if ( ! launched ) {
      handle_status(status,d);
    }
  });
};

var got_application =  function(a) {
  a.run('urn:x-cast:org.phototriage', function(err, s) {
    if (!err) {
      console.log('Got a session');
      session_manager(s);
    }
  });
};

var join_application =  function(a) {
  a.join('urn:x-cast:org.phototriage', function(err, s) {
    if (!err) {
      console.log('Got a session');
      session_manager(s);
    }
  });
};


var session_manager = function(s) {
  var connection_block = {
    "send" : function(message,callback) {
      s.send(message,function(err,data) {
        if (!err) {
          if (callback) {
            callback();
          } else {
            console.log("Message successfully sent");
          }
        }
      });
    }
  };
  var device = s.device;
  console.log("Adding session to device_sessions");
  console.log(device.friendlyName);
  if ( ! sessions[device.friendlyName]) {
    sessions[device.friendlyName] = [];
  }
  var device_sessions = sessions[device.friendlyName];

  device_sessions.push(connection_block);

  console.log(sessions);

  s.on('message', function(data) {
    if (data.type == 'CLOSE') {
      console.log("Got a close message");
      device_sessions.splice(device_sessions.indexOf(connection_block),1);
      launched = false;
      return;
    }
    if (data.message == 'ready') {
      launched = false;
      return;
    }
    if (data.message == 'OK') {
      console.log("Device "+device.friendlyName+" OK");
      return;
    }
    console.log('Got an unexpected message', util.inspect(data));
  });
};


wss.on('connection', function(ws) {
    ws.on('close', function() {

        var device_sessions = [];
        Object.keys(sessions).forEach(function(dev) {
          device_sessions.concat(sessions[dev]);
        });

        device_sessions.forEach(function(mirror) {
          mirror.send(JSON.stringify({type:"image"}));
        });
    });

    ws.on('message', function(json_message) {
      var message = JSON.parse(json_message);
      var device_sessions = [];
      Object.keys(sessions).forEach(function(dev) {
        device_sessions = device_sessions.concat(sessions[dev]);
      });
      if (message.image) {
        device_sessions.forEach(function(mirror) {
          mirror.send(message);
        });
      }
    });
});
