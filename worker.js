const PF = `WKR_${process.pid}`;

const REDIS_URL = process.env.REDIS_URL || "redis://127.0.0.1:6379";
const workers = process.env.WEB_CONCURRENCY || 2;
const maxJobsPerWorker = process.env.WORKER_MAX_JOBS || 1;

const configuration = {};
configuration.verbose = false;

const statsObj = {};
statsObj.nnt = {};
statsObj.nnt.ready = false;

const throng = require("throng");
const Queue = require("bull");

const NeuralNetworkTools = require("./lib/nnTools.js");
const nnt = new NeuralNetworkTools(`${PF}_NNT`);

nnt.on("ready", async (appName) => {
  statsObj.nnt.ready = true;
  console.log(
    `${PF} | READY | APP NAME: ${appName} | READY: ${statsObj.nnt.ready}`
  );
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
    console.log(`${PF} | updateUserRecommendations`, p.data);
    await waitFor(statsObj.nnt.ready);
    const results = await nnt.updateRecommendations(p.data);
    console.log(`${PF} | END updateUserRecommendations`, results);
    return { results: results, timestamp: nnt.getTimeStamp() };
  } catch (err) {
    console.log(`${PF} | ERROR updateUserRecommendations`, err);
    throw err;
  }
};

function start() {
  console.log(`${PF} | +++ WORKER | PID: ${process.pid} START`);

  const workQueue = new Queue("updateRecommendations", REDIS_URL);

  // job.data.
  // op: "UPDATE_RECS",
  // oauthID: userDoc.oauthID,
  // epochs: EPOCHS,

  workQueue.process(maxJobsPerWorker, async (job) => {
    try {
      console.log(
        `${PF} | ->- WORKER | JOB START` +
          ` | PID: ${process.pid}` +
          ` | JID: ${job.id}` +
          ` | OP: ${job.data.op}` +
          ` | OAUTHID: ${job.data.oauthID}` +
          ` | EPOCHS: ${job.data.epochs}`
      );
      const results = await updateUserRecommendations(job);
      console.log(
        `${PF} | +++ WORKER | JOB COMPLETE` +
          ` | PID: ${process.pid}` +
          ` | JID: ${job.id}` +
          ` | OP: ${job.data.op}` +
          ` | OAUTHID: ${job.data.oauthID}` +
          ` | EPOCHS: ${job.data.epochs}`
      );
      results.stats = statsObj;
      return results;
    } catch (err) {
      console.log(
        `${PF} | *** WORKER | *** JOB ERROR` +
          ` | PID: ${process.pid}` +
          ` | JID: ${job.id}` +
          ` | OP: ${job.data.op}` +
          ` | OAUTHID: ${job.data.oauthID}` +
          ` | EPOCHS: ${job.data.epochs}` +
          ` | ERR: ${err}`
      );
      return {
        op: job.op,
        stats: statsObj,
        err: err,
      };
    }
  });
}

// Initialize the clustered worker process
// See: https://devcenter.heroku.com/articles/node-concurrency for more info
throng({ workers, start });
