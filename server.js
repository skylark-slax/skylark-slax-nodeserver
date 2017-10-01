'use strict';

const express = require('express');
const serveIndex = require('serve-index');
const path = require('path');
const del = require('del');
const fs = require('fs');
const asar = require('asar');
const replacestream = require('replacestream');

exports = module.exports = SlaxServer;

function SlaxServer(options) {
  options = options || {};

  this.name = options.name;
  this.host = options.host;
  this.port = options.port;
  this.cors = options.cors;
  this.cachePath = path.join(__dirname, './.cache');
  
  this.slax = options.slax;
  this.root = options.root;
 
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

    let express = require("express");

    this._express =  express();

    if (this.root) {
        this._express.use(express.static(path.resolve(this.root)));
    }


    console.info("slax:" + this.slax);
    if (!this.slax) {
        console.warn("skylark application is not specified!");
        return ;
    }

    let self = this,
        slaxApps = this.slaxApps = {};
    this.slax.split(",").forEach(function(oneSlax){
        let a = oneSlax.split(":"),
            slaxFileName = a[0],
            slaxAppFileExt = path.extname(slaxFileName),
            slaxAppContextPath = a[1] || "";
        if (slaxAppFileExt !== ".slax") {
            console.error(slaxFileName + ": the skylark application file extension should be .slax!");
            return ;
        }

        let slaxAppName = path.parse(slaxFileName).name,
            slaxAppDir = self.cachePath+"/apps/" + slaxAppName;

        if (fs.existsSync(slaxAppDir)) {
            del.sync([slaxAppDir + '/**/*'], {
                force: true
            });       
        }

        asar.extractAll(path.resolve(slaxFileName),slaxAppDir);

        let slaxAppConf = require("./.cache/apps/"+ slaxAppName + "/slax-config");

        if (!slaxAppConf) {
            console.error(slaxFileName + ": the slax-config.json is not found!");
            return ;
        }

        slaxAppConf.contextPath = slaxAppContextPath;

        let slaxAppConfJSON = JSON.stringify(slaxAppConf);

        self._express.get(slaxAppContextPath+"/slax-config.json", (req, res) =>  {
            res.setHeader('content-type', 'application/json');
            res.send(slaxAppConfJSON);
        });

        //let handler = (req, res) => res.sendFile(path.join(this.slaxAppDir, "index.html"))
        self._express.get(slaxAppContextPath+"/index.html", (req, res) =>  {
            res.status(404);
            res.end('notfound! : ' + req.path);
        });

        let handler = (req, res) => {
          let html= path.join(slaxAppDir, "index.html");

          res.setHeader('content-type', 'text/html');
          let replacement = `</title><base href="${slaxAppContextPath}/">`;

          fs.createReadStream(html).pipe(replacestream('</title>', replacement)).pipe(res);

        };


        let routes = [];
        
        console.log("context path:" + slaxAppContextPath);
        if (slaxAppConf.routes) {
            for (var name in slaxAppConf.routes) {
                if (slaxAppConf.routes[name].pathto) {
                    routes.push(slaxAppConf.routes[name].pathto);
                    console.log("route:" + routes[routes.length-1]);
                }
            }
        }

        routes.forEach(route => {
            self._express.get(slaxAppContextPath+route, handler);
        });

        self._express.use(slaxAppContextPath,express.static(slaxAppDir));

        slaxApps[slaxAppContextPath] = {
            "slaxFileName" : slaxFileName,
            "slaxAppName" : slaxAppName,
            "slaxAppDir" : slaxAppDir,
            "slaxAppConf" : slaxAppConf

        }
    });



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






