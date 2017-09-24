'use strict';

const express = require('express');
const serveIndex = require('serve-index');
const path = require('path');
const del = require('del');
const fs = require('fs');
const asar = require('asar');

exports = module.exports = SlaxServer;

function SlaxServer(options) {
  options = options || {};

  this.name = options.name;
  this.host = options.host;
  this.port = options.port;
  this.cors = options.cors;
  this.cachePath = path.join(__dirname, './.cache');
  this.slaxFileName = options.slax;
 
  Object.defineProperty(this, '_express', {
    configurable: true,
    enumerable: false,
    writable: true,
    value: null
  });
}


/**
Start listening on the given host:port
@param callback {Function}    the function to call once the server is ready
*/
SlaxServer.prototype.start = function start(callback) {

    console.log("slaxFileName:" + this.slaxFileName);
    if (!this.slaxFileName) {
        console.error("Please specify a skylark application!");
        return ;
    }

    let slaxAppFileExt = path.extname(this.slaxFileName);
    if (slaxAppFileExt !== ".slax") {
        console.error("The skylark application file extension should be .slax!");
        return ;
    }

    this.slaxAppName = path.parse(this.slaxFileName).name;

    this.slaxAppDir = this.cachePath+"/apps/" + this.slaxAppName;

    console.log("slaxAppDir:" + this.slaxAppDir);

    if (fs.existsSync(this.slaxAppDir)) {
        del.sync([this.slaxAppDir + '/**/*'], {
            force: true
        });       
    }

    asar.extractAll(path.resolve(this.slaxFileName),this.slaxAppDir);

    this.slaxAppConf = require("./.cache/apps/"+ this.slaxAppName + "/slax-config");
    if (!this.slaxAppConf) {
        console.error("The slax-config.json is not found!");
        return ;
    }
  
    var self = this;
    let express = require("express");

    this._express =  express();

    this._express.use(express.static(this.slaxAppDir));

    let handler = (req, res) => res.sendFile(path.join(this.slaxAppDir, "index.html"))

    let routes = [];
    
    if (this.slaxAppConf.routes) {
        for (var name in this.slaxAppConf.routes) {
            if (this.slaxAppConf.routes[name].pathto) {
                routes.push(this.slaxAppConf.routes[name].pathto);
                console.log("route:" + routes[routes.length-1]);
            }
        }
    }

    routes.forEach(route => self._express.get(route, handler));

    var args = [];
    args.push(this.port);
    if (this.host) {
        args.push(this.host);
    }
    args.push(function(){
        callback && callback();
    });

    this._server = this._express.listen.apply(this._express,args);
}


/**
Stop listening
*/
SlaxServer.prototype.stop = function stop() {
  if (this._server) {
    this._server.close();
    this._server = null;
    this.extension = null;
  }
}






