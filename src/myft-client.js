/* global console, fetch */
'use strict';

var Notifications = require('./notifications-client');
var User = require('next-user-model-component');
var cleanUpFollow = require('./clean-up-follow');

var verbConfig = {
	followed: {
		category: 'activities',
		subjectPrefix: 'Topic:'
	},
	recommended: {
		category: 'activities',
		subjectPrefix: 'Article:'
	},
	forlater: {
		category: 'activities',
		subjectPrefix: 'Article:'
	},
	preferred: {
		category: 'activities',
		subjectPrefix: 'Preference:'
	},
	articleFromFollow: {
		category: 'events',
		subjectPrefix: 'Article:'
	}
};

var MyFtClient = function (opts) {
	if (!opts || !opts.apiRoot) {
		throw 'User prefs must be constructed with an api root';
	}
	this.apiRoot = opts.apiRoot;
};

MyFtClient.prototype.init = function (opts) {

	if (!this.initialised) {
		this.initialised = true;

		this.loaded = {};

		this.user = new User(document.cookie);
		// must be initialised here as its methods are documented in the public api
		this.notifications = new Notifications(this);

		if (!this.user.id()) {
			return console.warn('No eRights ID found in your cookie.');
		}

		if (!this.user.session()) {
			return console.warn('No session ID found in your cookie.');
		}

		this.headers = {
			'Content-Type': 'application/json',
			'X-FT-SESSION': this.user.session()
		};

		opts = opts || {};

		if (opts.userPrefsCleanup) {
			cleanUpFollow(this);
		}

		if (opts.follow) {

			document.body.addEventListener('myft.followed.load', function(e) {
				if(e.detail.Count && e.detail.Count > 0) {
					this.notifications.start();
				}
			}.bind(this));

			this.load('followed');
		}

		if (opts.saveForLater) {
			this.load('forlater');
		}
		if (opts.recommend) {
			this.load('recommended');
		}
		if (opts.preferred) {
			this.load('preferred');
		}
	}
};


MyFtClient.prototype.emit = function(name, data) {
	document.body.dispatchEvent(new CustomEvent('myft.' + name, {
		detail: data,
		bubbles: true
	}));
};

MyFtClient.prototype.fetch = function (method, endpoint, meta) {

	var options = {
		method: method,
		headers: this.headers,
		credentials: 'include'
	};

	if (method !== 'GET') {
		options.body = (meta) ? JSON.stringify(meta) : '';
	}

	return fetch(this.apiRoot + endpoint, options)
		.then(function(response) {
			if (response.status >= 400 && response.status < 600) {
				throw 'Network error loading user prefs for ' + endpoint;
			} else {
				return response.json();
			}
		}.bind(this));

};

MyFtClient.prototype.load = function (verb) {
	this.fetch('GET', verbConfig[verb].category + '/User:erights-' + this.user.id() + '/' + verb + '/' + verbConfig[verb].subjectPrefix)
		.then(function (results) {
			this.loaded[verb] = results;
			this.emit(verb + '.load', results);
		}.bind(this));
};

MyFtClient.prototype.add = function (verb, subject, meta) {
	this.fetch('PUT', verbConfig[verb].category + '/User:erights-' + this.user.id() + '/' + verb + '/' + verbConfig[verb].subjectPrefix + subject, meta)
		.then(function (results) {
			this.emit(verb + '.add', {
				results: results,
				subject: subject
			});
		}.bind(this));
};

MyFtClient.prototype.remove = function (verb, subject) {
	this.fetch('DELETE', verbConfig[verb].category + '/User:erights-' + this.user.id() + '/' + verb + '/' + verbConfig[verb].subjectPrefix + subject)
		.then(function (result) {
			this.emit(verb + '.remove', {
				subject: subject
			});
		}.bind(this));
};

module.exports = MyFtClient;
