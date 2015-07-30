var nconf = require('nconf');
var util = require('util');

// First consider commandline arguments and environment variables, respectively.
nconf.argv().env();

// Then load configuration from a designated file.
nconf.file({ file: 'config.json' });

var cc_app_id = nconf.get('app_id');

var WebSocketServer = require('ws').Server, WebSocket = require('ws')
  , wss = new WebSocketServer({port: 8080});

var sessions = {};

var nodecastor = require('nodecastor');

var device;
var watcher_timeout;
var state = {'enabled':false};

var device_watcher = function() {
  if ( watcher_timeout ) {
    return;
  }
  watcher_timeout = setTimeout(function() {
    watcher_timeout = null;
    reconnect_device();
    if ( ! device && ! watcher_timeout ) {
      watcher_timeout = setTimeout(arguments.callee,5000);
    }
  },5000);
};

var reconnect_device = function() {
  if ( ! state.enabled ) {
    return;
  }
  device = new nodecastor.CastDevice({
        friendlyName: nconf.get('chromecast_friendly'),
        address: nconf.get('chromecast_host'),
        port: 8009
  });

  device.on('connect',function() {
    connected(device);
  });

  device.on('error',function() {
    console.log('Lost device from error');
    sessions[device.friendlyName] = (sessions[device.friendlyName] || []).splice(0,-1);  
    device.stop();
    device = null;
    launched = false;
    device_watcher();
  });

  device.on('disconnect',function() {
    console.log('Lost device from disconnect');
    sessions[device.friendlyName] = (sessions[device.friendlyName] || []).splice(0,-1);  
    device.stop();
    launched = false;
    device = null;
    device_watcher();
  });

};

device_watcher();

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
        if ( ! launched && state.enabled == true ) {
          launched = true;
          if (current_app_id === cc_app_id ) {
            console.log("Joining "+cc_app_id+' application');
            join_application(a);
          } else {
            console.log("Launching "+cc_app_id+' application');
            got_application(a);            
          }
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
  if ( ! sessions[device.friendlyName]) {
    sessions[device.friendlyName] = [];
  }
  var device_sessions = sessions[device.friendlyName];

  device_sessions.push(connection_block);


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

process.on('uncaughtException', function (err) {
  console.error(err.stack);
  console.log("Node NOT Exiting...");
});

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

exports.state = state;
