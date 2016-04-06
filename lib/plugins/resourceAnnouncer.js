var Promise = require('q').Promise;

var plugin = {
	name: 'resourceAnnouncer',
	resources: {}
};
module.exports = plugin;


plugin.init = function() {
	log.info('loaded plugin: ' + plugin.name);
	return Promise(
		function(resolve, reject) {
			// creates a publisher
			plugin.config = app.config[plugin.name];
			log.info('initializing plugin: ' + plugin.name);
			plugin.publisher = app.mqs.resourceAnnouncer;
			plugin.announceInterval = setInterval(plugin.announceResource, app.config.resourceAnnouncer.announceInterval);
			app.events.on(
				'resourceAnnounce',
				plugin.updateResources
			);
			for (var n in app.api._resources) {
				plugin.updateResources(app.api._resources[n]);
			}
			plugin.announceResource();
			resolve(plugin);
		}
	);
};


plugin.updateResources = function(resource) {
	plugin.resources[resource._name] = {
		documentation: resource._api._documentation[resource._name],
		model: resource.model,
		rpcKey: app.config.rabbitmq_rpc.rpcTargetKey,
		version: resource._get('version')
	};
	// log.debug('=======updateResources: ', resource._name);
	return this.resources;
};


plugin.announceResource = function() {
	return Promise(
		function(resolve, reject) {
			// log.debug('=======announceResource', plugin.resources);
			var a = plugin.publisher.publish(
				app.config.shortcut + '.resourceAnnounce',
				{
					resources: plugin.resources
				},
				{
					expiration: '1000'
				},
				function() {
					resolve(a);
				}
			);
		}
	).then(
		log.debug.bind(log, 'resource announcement sent!')
	).catch(
		log.error.bind(log, 'resource announcement FAILED!')
	);
};
