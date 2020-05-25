var BunyanFormat = require('bunyan-format');
var logOutStream = BunyanFormat({ outputMode: 'short' });

module.exports = function(config) {
	var baseConfig = {};

	// Application id
	if (typeof config.id !== 'string') {
		config.id = 'nminion_' + UUID;
		log.warn('you should specify "config.id" to be a unique service identifier in you network!');
	}
	// Application name
	if (typeof config.name !== 'string') {
		config.name = 'nminions based service ' + UUID;
		log.warn('you should specify "config.name" to be a identifier for your service in you network!');
	}
	if (typeof config.directories !== 'object') {	// --- DIRECTORIES
		baseConfig.directories = {}
		log.warn('you should specify "config.directories" to make your skeleton informative to your plugins!');
	}
	if (typeof config.directories.home !== 'string') {
		config.directories.home = process.cwd();
	}
	if (typeof config.directories.plugins !== 'string') {
		config.directories.plugins = process.cwd() + '/lib/plugins';
	}
	if (typeof config.directories.config !== 'string') {
		config.directories.config = process.cwd() + '/config';
	}
	if (typeof config.directories.logs !== 'string') {
		config.directories.logs = process.cwd()+ '/logs';
	}
	// --- Application shortcut (4 letters)
	if (typeof config.shortcut !== 'string') {
		config.shortcut = '????';
		log.warn('you should specify "config.shortcut" to as a 4-letter string to identify your app as a api client!');
	}
	// Application plugins
	if (typeof config.plugins !== 'object' && Array.isArray(config.plugins) !== true) {
		// Application plugins
		config.plugins = [];
		log.warn('you should specify "config.plugins" to as a Array and add your plugins to it!');
	}
	// --- LOGGER === BUNYAN
	if (typeof config.logger !== 'object') {
		config.logger = {
			name: config.name,
			streams: [
				// {
					// level: 'debug',
					// path: config.directories.logs + '/nminions.debug.log',
				// },
				// {
					// level: 'warn',
					// path: config.directories.logs + '/nminions.error.log'
				// },
				{
					level: 'debug',
					stream: logOutStream
				}
			]
		};
	}
	return config;
};
