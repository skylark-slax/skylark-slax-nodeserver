'use strict';

const express = require('express'),
    _ = require('lodash'),
    serveIndex = require('serve-index'),
    path = require('path'),
    colors = require('colors'),
    del = require('del'),
    zipper = require("zip-local"),
    fs = require('fs'),
    asar = require('asar'),
    mkdirp = require('mkdirp'),
    rimraf = require('rimraf'),
    replacestream = require('replacestream');

exports = module.exports = SlaxServer;

function extractSlaxFile(slaxFileName, slaxAppDir) {
    function ensureAppDir() {
        if (fs.existsSync(slaxAppDir)) {
            rimraf.sync(slaxAppDir);
        }
        mkdirp.sync(slaxAppDir);
    }

    ensureAppDir();
    console.log(slaxFileName);
    console.log(slaxAppDir);
    try {
        zipper.sync.unzip(slaxFileName).save(slaxAppDir);
    } catch (e) {
        console.log("The slax file is not a zipped file? extract as a asar file", e);
        asar.extractAll(slaxFileName, slaxAppDir);
    }
};

function SlaxServer(options) {
    options = options || {};

    this.name = options.name;
    this.host = options.host;
    this.port = options.port;
    this.cors = options.cors;
    this.cachePath = path.join(__dirname, './.cache');

    this.slax = options.slax;
    this.slaxs = options.slaxs;
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

SlaxServer.prototype.initSlaxApp = function(appPath, contextPath, routeMiddleware) {
    let self = this,
        slaxAppFileExt = path.extname(appPath);
    if (slaxAppFileExt !== ".slax") {
        console.error(appPath + ": the skylark application file extension should be .slax!");
        return;
    }

    let slaxAppName = path.parse(appPath).name,
        slaxAppDir = self.cachePath + "/apps/" + slaxAppName;

    extractSlaxFile(path.resolve(appPath), slaxAppDir);

    let slaxAppConf = require("./.cache/apps/" + slaxAppName + "/slax-config");

    if (!slaxAppConf) {
        console.error(appPath + ": the slax-config.json is not found!");
        return;
    }

    slaxAppConf.contextPath = contextPath;

    let slaxAppConfJSON = JSON.stringify(slaxAppConf);

    self._express.get(contextPath + "/slax-config.json", (req, res) => {
        res.setHeader('content-type', 'application/json');
        res.send(slaxAppConfJSON);
    });

    //let handler = (req, res) => res.sendFile(path.join(this.slaxAppDir, "index.html"))
    self._express.get(contextPath + "/index.html", (req, res) => {
        res.status(404);
        res.end('notfound! : ' + req.path);
    });

    let handler = (req, res) => {
        let html = path.join(slaxAppDir, "index.html");
        res.setHeader('content-type', 'text/html');
        let replacement = `</title><base href="${contextPath}/">`;

        fs.createReadStream(html).pipe(replacestream('</title>', replacement)).pipe(res);

    };

    let routes = [];

    console.log(colors.yellow("context path:" + contextPath));
    if (slaxAppConf.routes) {
        for (var name in slaxAppConf.routes) {
            if (slaxAppConf.routes[name].pathto) {
                routes.push(slaxAppConf.routes[name].pathto);
                console.log(colors.blue.underline("route:" + routes[routes.length - 1]));
            }
        }
    }

    self._express.get("", handler);

    routes.forEach(route => {
        if (routeMiddleware) {
            self._express.get(contextPath + route, routeMiddleware, handler);
        } else {
            self._express.get(contextPath + route, handler);
        }
    });

    self._express.use(contextPath, express.static(slaxAppDir));

    return {
        "appPath": appPath,
        "slaxAppName": slaxAppName,
        "slaxAppDir": slaxAppDir,
        "slaxAppConf": slaxAppConf
    };
};
SlaxServer.prototype.start = function start(callback) {

    let express = require("express");

    this._express = express();

    if (this.root) {
        this._express.use(express.static(path.resolve(this.root)));
    }


    if (!this.slax && !this.slaxs && !this.slaxs.length) {
        console.warn("skylark application is not specified!");
        return;
    }

    let self = this,
        slaxApps = this.slaxApps = {};

    if (this.slaxs) _.each(this.slaxs, function(item) {
        console.info(colors.yellow("slax:" + item.name));
        slaxApps[item.contextPath] = self.initSlaxApp(item.slaxPath, item.contextPath, item.middleware);
    });

    if (this.slax) this.slax.split(",").forEach(function(oneSlax) {
        let slaxApp = oneSlax.split(":");
        console.info(colors.yellow("slax:" + slaxApp[0]));
        slaxApps[slaxApp[1]] = self.initSlaxApp(slaxApp[0], slaxApp[1] || "");
    });

    var args = [];
    args.push(this.port);
    if (this.host) {
        args.push(this.host);
    }
    args.push(function() {
        callback && callback();
    });

    this._server = this._express.listen.apply(this._express, args);
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