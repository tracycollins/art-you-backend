const PF = `WKR_${process.pid}`;

const ONE_SECOND = 1000;

const WORKER_START_TIMEOUT = process.env.WORKER_START_TIMEOUT
  ? parseInt(process.env.WORKER_START_TIMEOUT)
  : 10 * ONE_SECOND;

const workers = process.env.WEB_CONCURRENCY || 1;
const maxJobsPerWorker = process.env.WORKER_MAX_JOBS
  ? parseInt(process.env.WORKER_MAX_JOBS)
  : 1;

console.log(
  `${PF}` +
    ` | INIT` +
    ` | process.env.WORKER_START_TIMEOUT: ${process.env.WORKER_START_TIMEOUT}` +
    ` | process.env.REDIS_URL: ${process.env.REDIS_URL}` +
    ` | process.env.WEB_CONCURRENCY: ${process.env.WEB_CONCURRENCY}` +
    ` | process.env.WORKER_MAX_JOBS: ${process.env.WORKER_MAX_JOBS}`
);
console.log(
  `${PF}` +
    ` | INIT` +
    ` | WORKER_START_TIMEOUT: ${WORKER_START_TIMEOUT}` +
    ` | workers: ${workers}` +
    ` | maxJobsPerWorker: ${maxJobsPerWorker}`
);

let waitInterval = false;

process.on("SIGTERM", () => {
  console.log(`${PF} | ${process.pid} received a SIGTERM signal`);
  if (waitInterval) {
    clearInterval(waitInterval);
  }
  process.exit(0);
});

process.on("SIGINT", () => {
  console.log(`${PF} | ${process.pid} has been interrupted`);
  if (waitInterval) {
    clearInterval(waitInterval);
  }
  process.exit(0);
});

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
    waitInterval = setInterval(() => {
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

const start = () => {
  console.log(`${PF} | ... WAIT | WORKER | PID: ${process.pid} START`);
  console.log(`${PF} | +++ WORKER | PID: ${process.pid} START`);

  const workQueue = new Queue("updateRecommendations", process.env.REDIS_URL);

  workQueue.process(maxJobsPerWorker, async (job) => {
    try {
      console.log(
        `${PF} | ->- WORKER | JOB START` +
          ` | PID: ${process.pid}` +
          ` | JID: ${job.id}` +
          ` | OP: ${job.data.op}` +
          ` | OAUTHID: ${job.data.oauthID}` +
          ` | FORCE FIT: ${job.data.forceFit}` +
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

  workQueue.on("waiting", function (jobId) {
    console.log(
      `${PF} | ... WORKER | PID: ${process.pid} | JOB WAITING: ${jobId}`
    );
  });

  workQueue.on("resumed", function (job, err) {
    console.log(
      `${PF} | --- WORKER | PID: ${process.pid} | JOB RESUMED: ${job.id}`
    );
  });
  workQueue.on("failed", function (job, err) {
    console.log(
      `${PF} | XXX WORKER | PID: ${process.pid} | JOB FAILED: ${job.id} | ERROR: ${err}`
    );
  });
  workQueue.on("stalled", function (job) {
    console.log(
      `${PF} | ??? WORKER | PID: ${process.pid} | JOB STALLED: ${job.id}`
    );
  });
};

console.log(
  `${PF} | WORKER | WAIT START TIMEOUT: ${WORKER_START_TIMEOUT / 1000} SEC`
);
setTimeout(() => {
  throng({ workers, start });
}, WORKER_START_TIMEOUT);
