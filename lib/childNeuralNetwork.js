const PF = "CNN";

const configuration = {};
configuration.verbose = false;

const statsObj = {};
statsObj.nnt = {};
statsObj.nnt.ready = false;

// const defaultDateTimeFormat = "YYYYMMDD_HHmmss";

// const util = require("util");
// const EventEmitter = require("events");
// const HashMap = require("hashmap").HashMap;
// const defaults = require("object.defaults");
// const empty = require("is-empty");
// const moment = require("moment");
// const _ = require("lodash");
// const treeify = require("treeify");

const NeuralNetworkTools = require("./nnTools.js");
const nnt = new NeuralNetworkTools(`${PF}_NNT`);

nnt.on("ready", async (appName) => {
  statsObj.nnt.ready = true;
  console.log(
    `${PF} | READY | APP NAME: ${appName} | READY: ${statsObj.nnt.ready}`
  );
});

// const chalk = require("chalk");
// const chalkAlert = chalk.red;
// const chalkError = chalk.bold.red;
// const chalkLog = chalk.gray;

process.on("message", async (message) => {
  console.log(`${PF} | message:`, message);
  let results = {};
  switch (message.op) {
    case "STATUS":
      process.send({ op: message.op, stats: statsObj });
      break;
    case "UPDATE_RECS":
      try {
        results = await updateUserRecommendations(message);
        process.send({ op: message.op, results: results, stats: statsObj });
        break;
      } catch (err) {
        console.log(`${PF} *** updateUserRecommendations ERROR:`, err);
        process.send({
          op: message.op,
          stats: statsObj,
          err: err,
        });
        break;
      }
    default:
      process.send({
        op: message.op,
        stats: statsObj,
        err: `UNKNOWN OP: ${message.op}`,
      });
  }
  process.exit(); // make sure to use exit() to prevent orphaned processes
});

function waitFor() {
  return new Promise(function (resolve) {
    console.log(`${PF} | WAIT | statsObj.nnt.ready: ${statsObj.nnt.ready}`);
    if (statsObj.nnt.ready) {
      return resolve();
    }
    const waitInterval = setInterval(() => {
      if (statsObj.nnt.ready) {
        console.log(
          `${PF} | END WAIT | statsObj.nnt.ready: ${statsObj.nnt.ready}`
        );
        clearInterval(waitInterval);
        resolve();
      }
    }, 100);
  });
}

const updateUserRecommendations = async (p) => {
  try {
    console.log(`${PF} | updateUserRecommendations`, p);
    await waitFor(statsObj.nnt.ready);
    const results = await nnt.updateRecommendations(p);
    console.log(`${PF} | END updateUserRecommendations`, results);
    return { results: results, timestamp: nnt.getTimeStamp() };
  } catch (err) {
    console.log({ err });
    throw err;
  }
};
