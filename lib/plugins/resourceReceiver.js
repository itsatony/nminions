var Promise = require('q').Promise;

var plugin = {
	name: 'resourceReceiver',
	resources: {}
};
module.exports = plugin;

function addResource(resourceName, resourceData) {
	function addDetails(theResource) {
		theResource._set('remoteResource', true);
		theResource._set('rpcKey', resourceData.rpcKey);
		theResource._set('version', resourceData.version);
		for (var methodName in resourceData.documentation) {
			addMethod(resourceName, methodName, resourceData.documentation[methodName]);
		}
	};
	if (typeof app.api[resourceName] !== 'undefined') {
		var localVersion = app.api[resourceName]._get('version');
		if (localVersion === resourceData.version) {
			// console.log('/ got same resource version already/');
			return true;
		}
		return addDetails(null, app.api[resourceName]);
	}
	log.debug('====== new version of [' + resourceName + '] resource received');
	try {
		var x = app.api._addResource(
			resourceName,
			[ { name: 'empty', remote: true, rpc: true } ], // adapterConfig
			resourceData.model // model
		).then(
			addDetails
		);
	} catch(err) {
		log.error(err);
		return app.errorHandler(err);
	}
};
function addMethod(resourceName, methodName, methodData) {
	for (var specifierName in methodData) {
		addSpecifier(resourceName, methodName, specifierName, methodData[specifierName]);
	}
};
function addSpecifier(resourceName, methodName, specifierName, specifierData) {
	var step = returnRemoteSpecifierExecutor(resourceName, methodName, specifierName, specifierData);
	try {
		var remoteSpecifier = app.api._resources[resourceName][methodName]._addSpecifier(
			specifierName,
			[ step ],
			specifierData.description,
			specifierData.parameters,
			specifierData.tests
		);
	} catch(err) {
		log.error('!addSpecifier!!!!!!!!!!!!!!', err.stack);
	}
};
function returnRemoteSpecifierExecutor(resourceName, methodName, specifierName, specifierData) {
	return {
		name: 'remoteSpecifier.' + resourceName + '.' + methodName + '.' + specifierName,
		resolveHandler: function(apiCall) {
			return function() {
				return Promise(
					function(resolve, reject, notify) {
						var document = apiCall.get('document') || {};
						var moreOptions = apiCall.get('options') || {};
						moreOptions.user = apiCall.get('user');
						var publishingKey = apiCall._resource._get('rpcKey');
						var fullPublishingKey = publishingKey + '.' + methodName + '.' + specifierName;
						log.info('=========== remoteSpecifierExecutor queryAPI INIT =======', fullPublishingKey);
						app.queryAPI(app.config.realm, resourceName, methodName, specifierName, document, moreOptions, fullPublishingKey)
						.then(
							function(result) {
								log.info('=========== remoteSpecifierExecutor queryAPI RESULT.length =======', result.length);
								apiCall.set('results', result);
								resolve(result);
								return result;
							}
						)
						.catch(
							function(error) {
								log.error('=========== remoteSpecifierExecutor queryAPI ERROR =======');
								apiCall.set('errors', error);
								reject(error);
								return error;
							}
						)
					}
				);
			}
		}
	};
};

plugin.init = function() {
	log.info('loaded plugin: ' + plugin.name);
	return Promise(
		function(resolve, reject) {
			// creates a listener
			plugin.config = app.config[plugin.name];
			log.info('initializing plugin: ' + plugin.name);
			app.mqs.resourceReceiver.handleMessage(
				function(message, next) {
					for (var resourceName in message.resources) {
						addResource(resourceName, message.resources[resourceName]);
					}
					next();
				}
			);
			resolve(plugin);
		}
	);
};


plugin.updateResources = function(resource) {
	plugin.resources[resource._name] = resource._parent._documentation[resource._name];
	log.debug('=======updateResources: ', resource._name);
	return this.resources;
};
