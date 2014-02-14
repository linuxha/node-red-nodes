/**
 * Copyright 2013 Henrik Olsson henols@gmail.com
 *
 * Licensed under the Apache License, Version 2.0 (the "License"); you may not
 * use this file except in compliance with the License. You may obtain a copy of
 * the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS, WITHOUT
 * WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied. See the
 * License for the specific language governing permissions and limitations under
 * the License.
 */

var RED = require(process.env.NODE_RED_HOME+"/red/red");
//The Server Definition - this opens (and closes) the connection
function EmoncmsServerNode(n) {
    RED.nodes.createNode(this,n);
    this.server = n.server;
    this.name = n.name;
    var credentials = RED.nodes.getCredentials(n.id);
    if (credentials) {
        this.apikey = credentials.apikey;
    }

}
RED.nodes.registerType("emoncms-server",EmoncmsServerNode);

var querystring = require('querystring');

RED.app.get('/emoncms-server/:id',function(req,res) {
    var credentials = RED.nodes.getCredentials(req.params.id);
    if (credentials) {
        res.send(JSON.stringify({apikey:credentials.apikey}));
    } else {
        res.send(JSON.stringify({}));
    }
});

RED.app.delete('/emoncms-server/:id',function(req,res) {
    RED.nodes.deleteCredentials(req.params.id);
    res.send(200);
});

RED.app.post('/emoncms-server/:id',function(req,res) {

    var body = "";
    req.on('data', function(chunk) {
        body+=chunk;
    });
    req.on('end', function(){
        var newCreds = querystring.parse(body);
        var credentials = RED.nodes.getCredentials(req.params.id)||{};
        if (newCreds.apikey == null || newCreds.apikey == "") {
            delete credentials.apikey;
        } else {
            credentials.apikey = newCreds.apikey;
        }
        RED.nodes.addCredentials(req.params.id,credentials);
        res.send(200);
    });
});

function Emoncms(n) {
    RED.nodes.createNode(this,n);
    this.emonServer = n.emonServer;
    var sc = RED.nodes.getNode(this.emonServer);

    this.baseurl = sc.server;
    this.apikey = sc.apikey;

    this.topic = n.topic ||"";
    this.nodegroup = n.nodegroup || "";
    var node = this;
    if (this.baseurl.substring(0,5) === "https") { var http = require("https"); }
    else { var http = require("http"); }
    this.on("input", function(msg) {

        var topic = this.topic || msg.topic;
        var nodegroup = this.nodegroup || msg.nodegroup;
        this.url = this.baseurl + '/input/post.json?json={' + topic + ':' + msg.payload+'}&apikey='+this.apikey;
        if(nodegroup != ""){
            this.url += '&node='+nodegroup;
        }
        node.log("[emoncms] "+this.url);
        http.get(this.url, function(res) {
            node.log("Http response: " + res.statusCode);
            msg.rc = res.statusCode;
            msg.payload = "";
            if ((msg.rc != 200) && (msg.rc != 404)) {
                node.send(msg);
            }
            res.setEncoding('utf8');
            res.on('data', function(chunk) {
                msg.payload += chunk;
            });
            res.on('end', function() {
                node.send(msg);
            });
        }).on('error', function(e) {
            // node.error(e);
            msg.rc = 503;
            msg.payload = e;
            node.send(msg);
        });
    });
}

RED.nodes.registerType("emoncms",Emoncms);
