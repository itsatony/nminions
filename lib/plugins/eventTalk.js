var EventEmitter = require('events').EventEmitter;


function exampleHandler1(args) {
	return Promise(
		function(resolve, reject) {
			console.log('eventName: ', args[0]);
			console.log('parameters: ', args);
			resolve(1337);
		}
		)
}

function exampleHandler2(args) {
	return Promise(
		function(resolve, reject) {
			console.log('eventName: ', args[0]);
			console.log('parameters: ', args);
			resolve(2337);
		}
	)
}

function eventTalk(errorHandler) {
	this.counter = 0;
	this.errorHandler = (typeof errorHandler === 'function')
		? errorHandler
		: function(e) {
			console.error('error in eventTalk', e);
		}
	;
	this.handlers = {};
}

eventTalk.prototype.on = function(eventName, handlerFunction, handlerName) {
	this.counter += 1;
	if (typeof this.handlers[eventName] === 'undefined') {
		this.handlers[eventName] = {};
	}
	handlerName = (typeof handlerName === 'string') ? handlerName : 'eventName_' + this.counter;
	this.handlers[eventName][handlerName] = handlerFunction;
	return handlerName;
}

eventTalk.prototype.off = function(eventName, handlerName) {
	var result = delete this.handlers[eventName][handlerName];
	return result;
}

eventTalk.prototype.emit = function(eventName) {
	var name = eventName + '_' + Date.now();
	var debug = true;
	var args = [];
	for (var n in arguments) {
		args.push(arguments[n]);
	}
	var handlers = [];
	for (var i in this.handlers[eventName]) {
		handlers.push(this.handlers[eventName][i](args));
	}
	return allSettled(handlers).then(
		function (results) {
			var answers = [];
	    results.forEach(
				function (result) {
	        if (result.state === "fulfilled") {
            var value = result.value;
						answers.push(value);
        	} else {
            var reason = result.reason;
	        }
	    	}
			);
			return answers;
		}
	).catch(
		this.errorHandler
	);
}


function chainPromises(list, parameters, name, debug) {
	debug = debug || false;
	name = (typeof name === 'string') ? name : 'chainPromise_' + Date.now();
	return Promise(
		function(chainResolve, chainReject) {
			var eHandler = function(err) {
				if (debug === true) {
					log.error('chainPromises error ', err.stack);
				}
				chainReject(err);
				// app.errorHandler(err);
			};
			var result = new Promise(function(resolve, reject) { return resolve(); });
			// result.catch(eHandler);
			list.unshift(
				function() {
					return Promise(
						function(resolve, reject) {
							if (debug === true) {
								log.info('chainPromises start ' + name);
							}
							resolve('chainPromises start ' + name);
						}
					)
				}
			);
			list.push(
				function() {
					Promise(
						function(resolve, reject) {
							chainResolve(result);
							if (debug === true) {
								log.info('chainPromises complete ' + name);
							}
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




// testEvent = new eventTalk();

// testEvent.on('alarm', exampleHandler1);
// testEvent.on('alarm', exampleHandler2);

// testEvent.emit('alarm', 'para1', 2, { para3: true }).then(
// 	function(answers) {
// 		console.log('ANSWERS: ', answers);
// 	}
// );


function allSettled(promises) {
	let wrappedPromises = promises.map(p => Promise.resolve(p)
		.then(
			val => ({ state: 'fulfilled', value: val }),
			err => ({ state: 'rejected', reason: err })));
	return Promise.all(wrappedPromises);
}