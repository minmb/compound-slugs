var util = require('util'),
    async = require('async'),
    _ = require('underscore'),
    unidecode = require('unidecode'),
    inflection = require('inflection');

function reverseRoute(route, params) {

    if (typeof route === 'object') {
        route = route.path;
    }

    return route.replace(/([\/\.]):(\w+)\??/g, function (match, prefix, param) {
        return params[param] ? (prefix + params[param]) : ''; 
    }); 
};

module.exports = function(compound) {

    var app = compound.app;

    var options = {
        format: '%d-%s',
        pattern: /(\d+)(?:-(.+))?/
    };

    var params = _.chain(app.routes).
                    values().
                    flatten().
                    pluck('keys').
                    flatten().
                    where({optional: false}).
                    pluck('name').
                    uniq().
                    value();

    _.each(params, function(param) {

        app.param(param, function(req, res, next, id) {

            var captures = options.pattern.exec(id);

            req.slugs = req.slugs || {};
            req.params[param] = captures[1];
            req.slugs[param] = captures[2];

            next();
            
        });
    });

    _.each(app.models, function(model) {

        if (typeof model.prototype.slug === 'function') {
            model.prototype.to_param = function() {
                return util.format(options.format, this.id, this.slug());
            }
        }

    });

    compound.controller.prototype.routeWithSlugs = function() {

        var getters = [],
            _this = this,
            slugs = this.req.slugs || {};

        _.each(slugs, function(slug, param) {

            var resource, match;

            if (param === 'id') {
                resource = inflection.singularize(_this.controllerName);
            } else if (match = param.match(/(.+?)_id$/)) {
                resource = match[1];
            }

            var model = app.models[inflection.classify(resource)];

            if (model && typeof model.prototype.slug === 'function') {
                getters.push(function(callback) {
                    model.find(_this.req.params[param], function(err, obj) {
                        _this.req[resource] = obj;
                        callback(err, [param, obj]);
                    });
                });
            }

        });

        if (_.isEmpty(getters)) {
            _this.next();
        } else {

            async.parallel(getters, function(err, results) {

                if (err) {
                    _this.next(err);
                } else {

                    if (!_.isEmpty(results)) {

                        var doRedirect = false;

                        _.each(results, function(result) {

                            var param = result[0],
                                obj = result[1];

                            if (obj.slug() !== slugs[param]) {
                                _this.req.params[param] = util.format(options.format, _this.req.params[param], obj.slug());
                                doRedirect = true;
                            }

                        });

                        if (doRedirect) {
                            _this.redirect(reverseRoute(_this.req.route, _this.req.params));
                        } else {
                            _this.next();
                        }

                    }
                    
                }
            });
    
        }
    };

    compound.utils.slugify = function(str, delim) {

        if (!delim) delim = '-';

        var re = /[\t !"#$%&\'()*\-/<=>?@\[\\\]^_`{|},.]+/,
            words = (str + '').toLowerCase().split(re);

        return _.chain(words).map(function(word) {
            return unidecode(word).split(/\s+/)
        }).flatten().value().join(delim);

    };

};