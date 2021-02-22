const MODULE_ID_PREFIX = "S3C";

const configuration = {};
configuration.verbose = false;

const util = require("util");
const EventEmitter = require("events");

const AWS = require('aws-sdk');

const REGION = "us-east-1"; // e.g., "us-east-1"
const s3 = new AWS.S3({region: REGION});

const chalk = require("chalk");
const chalkAlert = chalk.red;
// const chalkError = chalk.bold.red;
// const chalkLog = chalk.gray;

const Client = function(app_name){

  const self = this;
  this.appname = app_name || "DEFAULT_APP_NAME";

  console.log(`${MODULE_ID_PREFIX} | +++ AWS S3 CLIENT | ${this.appname}`)

  EventEmitter.call(this);

  setTimeout(async () => {
    try{
      self.emit("connect", self.appname);
    }
    catch(err){
      console.error(`${MODULE_ID_PREFIX} | *** AWS S3 INIT ERROR: ${err}`)
    }
    self.emit("ready", self.appname);
    
  }, 100);
};

util.inherits(Client, EventEmitter);

Client.prototype.listBuckets = async function(){
  const results = await s3.listBuckets().promise();
  return results;
};

Client.prototype.putObject = async function(params){
  const results = await s3.putObject(params).promise();
  return results;
};

Client.prototype.getObject = async function(params){
  const results = await s3.getObject(params).promise();
  return results.Body.toString('utf-8')
};

Client.prototype.verbose = function(v){
  if (v === undefined) { return configuration.verbose; }
  configuration.verbose = v;
  console.log(chalkAlert(`${MODULE_ID_PREFIX} | --> SET VERBOSE: ${configuration.verbose}`));
  return;
};

module.exports = Client;
