const PF = "CNN";

const configuration = {};
configuration.verbose = false;

const statsObj = {};
statsObj.nnt = {};
statsObj.nnt.ready = false;

const throng = require("throng");
const Queue = require("bull");

// Connect to a local redis instance locally, and the Heroku-provided URL in production
const REDIS_URL = process.env.REDIS_URL || "redis://127.0.0.1:6379";

// Spin up multiple processes to handle jobs to take advantage of more CPU cores
// See: https://devcenter.heroku.com/articles/node-concurrency for more info
const workers = process.env.WEB_CONCURRENCY || 2;

// The maximum number of jobs each worker should process at once. This will need
// to be tuned for your application. If each job is mostly waiting on network
// responses it can be much higher. If each job is CPU-intensive, it might need
// to be much lower.
const maxJobsPerWorker = 50;

const NeuralNetworkTools = require("./lib/nnTools.js");
const nnt = new NeuralNetworkTools(`${PF}_NNT`);

nnt.on("ready", async (appName) => {
  statsObj.nnt.ready = true;
  console.log(
    `${PF} | READY | APP NAME: ${appName} | READY: ${statsObj.nnt.ready}`
  );
});

function sleep(ms) {
  console.log(`WORKER SLEEP: ${ms}`);
  return new Promise((resolve) => setTimeout(resolve, ms));
}
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

function start() {
  console.log(`+++ WORKER | PID: ${process.pid} START`);
  // Connect to the named work queue
  const workQueue = new Queue("updateRecommendations", REDIS_URL);

  workQueue.process(maxJobsPerWorker, async (job) => {
    try {
      console.log(`->- WORKER | PID: ${process.pid} PROCESS | JOB: ${job}`);
      const results = await updateUserRecommendations(job);
      return { op: job.op, results: results, stats: statsObj };
    } catch (err) {
      console.log(
        `->- WORKER | PID: ${process.pid} | updateUserRecommendations ERROR:`,
        err
      );
      process.send({
        op: job.op,
        stats: statsObj,
        err: err,
      });
    }

    // // throw an error 5% of the time
    // if (Math.random() < 0.05) {
    //   throw new Error("This job failed!");
    // }

    // while (progress < 100) {
    //   await sleep(50);
    //   progress += 1;
    //   job.progress(progress);
    //   console.log(`WORKER PROCESS | JOB | PROGRESS: ${progress}`);
    // }

    // // A job can return values that will be stored in Redis as JSON
    // // This return value is unused in this demo application.
    // return { value: "This will be stored" };
  });
}

// Initialize the clustered worker process
// See: https://devcenter.heroku.com/articles/node-concurrency for more info
throng({ workers, start });
