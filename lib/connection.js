// Generated by CoffeeScript 1.7.1

/*
  backbone-mongo.js 0.5.5
  Copyright (c) 2013 Vidigami - https://github.com/vidigami/backbone-mongo
  License: MIT (http://www.opensource.org/licenses/mit-license.php)
 */

(function() {
  var CONNECTION_QUERIES, Connection, ConnectionPool, DatabaseUrl, MongoClient, Queue, _,
    __bind = function(fn, me){ return function(){ return fn.apply(me, arguments); }; };

  _ = require('underscore');

  Queue = require('backbone-orm/lib/queue');

  DatabaseUrl = require('backbone-orm/lib/database_url');

  ConnectionPool = require('backbone-orm/lib/connection_pool');

  CONNECTION_QUERIES = require('./connection_queries');

  MongoClient = require('mongodb').MongoClient;

  module.exports = Connection = (function() {
    Connection.options = {};

    function Connection(url, schema, options) {
      var database_url, key, value, _i, _len, _ref;
      this.url = url;
      this.schema = schema != null ? schema : {};
      if (options == null) {
        options = {};
      }
      this.ensureIndex = __bind(this.ensureIndex, this);
      if (!_.isString(this.url)) {
        throw new Error('Expecting a string url');
      }
      this.connection_options = _.extend(_.clone(Connection.options), options);
      this.collection_requests = [];
      this.db = null;
      database_url = new DatabaseUrl(this.url, true);
      this.collection_name = database_url.table;
      database_url.query || (database_url.query = {});
      delete database_url.search;
      _ref = database_url.query;
      for (key in _ref) {
        value = _ref[key];
        this.connection_options[key] = value;
      }
      database_url.query = {};
      for (_i = 0, _len = CONNECTION_QUERIES.length; _i < _len; _i++) {
        key = CONNECTION_QUERIES[_i];
        if (this.connection_options.hasOwnProperty(key)) {
          database_url.query[key] = this.connection_options[key];
          delete this.connection_options[key];
        }
      }
      this.url = database_url.format({
        exclude_table: true
      });
      this._connect();
    }

    Connection.prototype.destroy = function() {
      var collection_requests, request, _i, _len;
      if (!this.db) {
        return;
      }
      collection_requests = _.clone(this.collection_requests);
      this.collection_requests = [];
      for (_i = 0, _len = collection_requests.length; _i < _len; _i++) {
        request = collection_requests[_i];
        request(new Error('Client closed'));
      }
      this._collection = null;
      this.db.close();
      return this.db = null;
    };

    Connection.prototype.collection = function(callback) {
      if (this._collection) {
        return callback(null, this._collection);
      }
      this.collection_requests.push(callback);
      if (this.connection_error) {
        this.connection_error = null;
        return this._connect();
      }
    };

    Connection.prototype.ensureIndex = function(field_name, table_name) {
      var index_info;
      index_info = {};
      index_info[field_name] = 1;
      return this._collection.ensureIndex(index_info, {
        background: true
      }, (function(_this) {
        return function(err) {
          if (err) {
            return new Error("MongoBackbone: Failed to indexed '" + field_name + "' on " + table_name + ". Reason: " + err);
          }
          return console.log("MongoBackbone: Successfully indexed '" + field_name + "' on " + table_name);
        };
      })(this));
    };

    Connection.prototype._connect = function() {
      var queue;
      queue = new Queue(1);
      queue.defer((function(_this) {
        return function(callback) {
          if (_this.db = ConnectionPool.get(_this.url)) {
            return callback();
          }
          return MongoClient.connect(_this.url, _.clone(_this.connection_options), function(err, db) {
            if (err) {
              return callback(err);
            }
            if (_this.db = ConnectionPool.get(_this.url)) {
              db.close();
            } else {
              ConnectionPool.set(_this.url, _this.db = db);
            }
            return callback();
          });
        };
      })(this));
      queue.defer((function(_this) {
        return function(callback) {
          return _this.db.collection(_this.collection_name, function(err, collection) {
            var field, key, relation, _ref, _ref1, _results;
            if (!err) {
              _this._collection = collection;
            }
            callback(err);
            _ref = _this.schema.fields;
            for (key in _ref) {
              field = _ref[key];
              if (field.indexed) {
                _this.ensureIndex(key, _this.collection_name);
              }
            }
            _ref1 = _this.schema.relations;
            _results = [];
            for (key in _ref1) {
              relation = _ref1[key];
              if (relation.type === 'belongsTo' && !relation.isVirtual() && !relation.isEmbedded()) {
                _results.push(_this.ensureIndex(relation.foreign_key, _this.collection_name));
              }
            }
            return _results;
          });
        };
      })(this));
      return queue.await((function(_this) {
        return function(err) {
          var collection_requests, request, _i, _j, _len, _len1, _results, _results1;
          collection_requests = _this.collection_requests.splice(0, _this.collection_requests.length);
          if (_this.connection_error = err) {
            console.log("Backbone-Mongo: unable to create connection. Error: " + err);
            _results = [];
            for (_i = 0, _len = collection_requests.length; _i < _len; _i++) {
              request = collection_requests[_i];
              _results.push(request(new Error("Connection failed. Error: " + err)));
            }
            return _results;
          } else {
            _results1 = [];
            for (_j = 0, _len1 = collection_requests.length; _j < _len1; _j++) {
              request = collection_requests[_j];
              _results1.push(request(null, _this._collection));
            }
            return _results1;
          }
        };
      })(this));
    };

    return Connection;

  })();

}).call(this);
