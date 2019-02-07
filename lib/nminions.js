var path = require('path');
var EventEmitter = require('events').EventEmitter;
var util = require('util');
var argv = require('minimist')(process.argv.slice(2));
var bunyan = require('bunyan');
var os = require('os');

var log = {
	info: console.log,
	debug: console.log,
	error: console.error,
	warn: console.error
};
var nminapp = {
	log: log
};
// global.nminapp = nminapp;

nminapp._data = {};
nminapp._status = {};
nminapp.intervals = {};
nminapp.modules = {};
nminapp.setStatus = function(k, v) {
	return nminapp._status[k] = v;
}
nminapp.getStatus = getStatus;
nminapp.setData = function(k, v) {
	return nminapp._data[k] = v;
};
nminapp.getData = function(k) {
	return nminapp._data[k];
}
nminapp.events = new EventEmitter();
// TODO: fix path!
nminapp.packageJson = require(__dirname + '/../package.json');
nminapp.argv = argv;
nminapp.start = start;
nminapp.stop = stop;
nminapp.errorHandler = errorHandler;
process.on('uncaughtException', nminapp.errorHandler);


// process.on("unhandledRejection", function(err) {
//    console.error("==== Q ==== Unhandled Rejection detected: ");
//    console.error(err.stack || err);
// });
process.on('SIGTERM', nminapp.stop.bind(this));
process.on('SIGINT', nminapp.stop.bind(this));
nminapp.get = function(parentKey, childKey) {
	return nminapp._data[parentKey][childKey];
};
nminapp.set = function(parentKey, childKey, value) {
	if (!nminapp._data[parentKey]) {
		nminapp._data[parentKey] = {};
	}
	nminapp._data[parentKey][childKey] = value;
	return nminapp._data[parentKey][childKey];
};



function start(startupPromisesToChain) {
  nminapp.startTimestamp = Date.now();
	return new Promise(
		function(startupResolve, startupReject) {
			var init = Promise.resolve(true)
			.then(
				loadConfig
			).then(
				function() {
					// Shortcut to the nminapp name
					nminapp.config = require(__dirname + '/baseconfig.js')(nminapp.config);
					nminapp.name = nminapp.config.name;
					return nminapp.config;
				}
			).then(
				function() {
					nminapp.log = bunyan.createLogger(nminapp.config.logger);
					log.info('logger active: bunyan');
					return log;
				}
			).then(
				function() {
					return load('plugins', nminapp.config.plugins);
				}
			).then(
				function() {
					if (Array.isArray(startupPromisesToChain) !== true || startupPromisesToChain.length === 0) {
						return true;
					}
					log.info('running startupPromisesToChain :' + startupPromisesToChain.length);
					var P = chainPromises('startupPromisesToChain', startupPromisesToChain);
					return P;
				}
			).then(
				function() {
					if (
						typeof nminapp.config.packageJson !== 'object'
						|| nminapp.config.packageJson === null
					) {
						log.warn ('no config.packageJson available! please load it!');
						nminapp.config.packageJson = { version: 'unknown' };
					} else {
						log.info('init complete. v' + nminapp.config.packageJson.version);
					}

					startIntervals();

					nminapp.events.emit('init.complete', nminapp);
					startupResolve(nminapp);
					return true;
				}
			).catch(
				function(err) {
					log.error('========== STARTUP FAILED !!! ', arguments);
					startupReject(err);
					errorHandler(err);
				}
			);
		}
	);
};



function stop() {
	log.info('service shutdown triggered - 2sec max | ' + Date.now() + '');
	setTimeout(
		function() {
			process.disconnect && process.disconnect();
			process.exit(1);
		},
		2000
	);
};



// -------- HELPERS
//--[[ load the config file
function loadConfig() {
	try {
		var configArgument = argv.config || argv.c || argv._[0];
		if (typeof configArgument !== 'string') {
			console.error('ERROR: you need to supply a config file as argument! exiting. ')
			return process.exit(1);
		}
		var configPath = path.resolve(process.cwd(), configArgument);
		nminapp.config = require(configPath);
	} catch(err) {
		console.error('! failed to load config [%s]', configPath);
		nminapp.errorHandler(err);
		process.exit(1);
	}
	log.info('loaded config [' + configPath + ']');
	return true;
};


//--[[ load all plugins and wait for their init to complete
function load(name, list) {
	nminapp[name] = {};
	return new Promise(
		function(loadResolve, loadReject) {
			log.info('loading ' + name);
			if (typeof list !== 'object' || typeof list.length !== 'number' || list.length <1) {
				return loadResolve('nothing to load');
			}
			var eHandler = function(err) {
				if (!err) {
					err = new Error('unknown problem')
				}
				log.error('load error during ' + name, err.stack);
				loadReject(err);
			};
			var result = Promise.resolve('load init');
			var promises = [];
			list.map(
				function(item) {
					try {
            var r = null;
            if (typeof item !== 'object' || typeof item.name !== 'string') {
							log.debug('load skipped item: ', item);
            } else if (typeof item.plugin === 'object' && typeof item.plugin.init === 'function') {
              r = item.plugin;
						} else if (typeof item.file === 'string') {
						  r = require(item.file);
            }
            if (r !== null && typeof r.init === 'function') {
						  promises.push(r.init);
              nminapp[name][r.name] = r;
            }
						return item;
					} catch(erro) {
						console.error('load map error in ' + item.name, erro.stack || erro);
					}
				}
			);
			promises.push(
				function() {
					return new Promise(
						function(resolve, reject) {
							log.info('completed loading ' + name);
							loadResolve(nminapp[name]);
							return resolve('complete');
						}
					)
				}
			);
			promises.forEach(
				function (p) {
					result = result.then(p).catch(eHandler);
				}
			);
			return result;
		}
	);
};



function errorHandler(err) {
	console.error('============ UNCAUGHT EXCEPTION ' + new Date() + '============');
	console.error(err.stack || err);
	process.exit(1);
	return err;
};



function chainPromises(name, list) {
	return new Promise(
		function(chainResolve, chainReject) {
			var eHandler = function(err) {
				log.error('chainPromises error ', err.stack);
				chainReject(err);
				// nminapp.errorHandler(err);
			};
			var result = Promise.resolve('chainPromises init');
			// result.catch(eHandler);
			list.unshift(
				function() {
					return new Promise(
						function(resolve, reject) {
							log.info('chainPromises start ' + name);
							resolve('chainPromises start ' + name);
						}
					)
				}
			);
			list.push(
				function() {
					return new Promise(
						function(resolve, reject) {
							chainResolve(result);
							log.info('chainPromises complete ' + name);
							resolve('chainPromises complete ' + name);
						}
					)
				}
			);
			list.forEach(
				function (p) {
					result = result.then(p).catch(eHandler);
				}
			);
			return result;
		}
	);
};


function startIntervals() {
  nminapp.intervals.every250ms = setInterval(
    function() {
      nminapp.events.emit('next250RelativeMS');
    },
    250
  );
  nminapp.intervals.ever500ms = setInterval(
    function() {
      nminapp.events.emit('next500RelativeMS');
    },
    500
  );
  nminapp.intervals.everySecond = setInterval(
    function() {
      nminapp.events.emit('nextRelativeSecond');
    },
    1000
  );
  nminapp.intervals.every5Seconds = setInterval(
    function() {
      nminapp.events.emit('next3RelativeSeconds');
    },
    3000
  );    nminapp.intervals.every5Seconds = setInterval(
    function() {
      nminapp.events.emit('next5RelativeSeconds');
    },
    5000
  );
  nminapp.intervals.every10Seconds = setInterval(
    function() {
      nminapp.events.emit('next10RelativeSeconds');
    },
    10000
  );
  nminapp.intervals.every5Minutes = setInterval(
    function() {
      nminapp.events.emit('next5RelativeMinutes');
    },
    (1000 * 60 * 5)
  );
  nminapp.events.on(
    'nextRelativeSecond',
    function() {
      var thisMinute = getCurrentFullMinute();
      if (nminapp.getData('currentFullMinute') !== thisMinute) {
        nminapp.setData('currentFullMinute', getCurrentFullMinute());
        nminapp.events.emit('nextFullMinute', nminapp.getData('currentFullMinute') - 1 , nminapp.getData('currentFullMinute'));
      }
    }
  );
  nminapp.events.emit('intervalsStarted');
};

function getCurrentFullMinute() {
  return Math.floor( Date.now() / (1000 * 60) );
};


function getStatus() {
  var data = {};
  data.id = nminapp.config.id;
  data.name = nminapp.config.packageJson.name;
  data.version = nminapp.config.packageJson.version;
  data.startTime = nminapp.startTimestamp;
  var memory = process.memoryUsage();
  var loadAverage = os.loadavg();
  data.cpuMillicoreLoadAvg1Min = Math.round(loadAverage[0] * 1000);
  var sys = os.platform() + ' ' + os.release();
  data.usedMemoryTotalMB = Math.round((memory.rss + memory.heapTotal) / 1024 / 1024);
  data.systemMemoryTotalMB = Math.round((os.totalmem()) / 1024 / 1024);
  data.timestamp = Date.now();
  data.hostname = process.env.HOSTNAME || os.hostname();
  for (var n in nminapp._status) {
    data[n] = nminapp._status[n];
  }
  return data;
};

module.exports = nminapp;
