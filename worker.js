const PF = `WKR_${process.pid}`;

const ONE_SECOND = 1000;
// const ONE_MINUTE = 60 * ONE_SECOND;
// const ONE_HOUR = 60 * ONE_MINUTE;

const WORKER_START_TIMEOUT = process.env.WORKER_START_TIMEOUT
  ? parseInt(process.env.WORKER_START_TIMEOUT)
  : 10 * ONE_SECOND;

// const REDIS_URL = process.env.REDIS_TLS_URL;
const workers = process.env.WEB_CONCURRENCY || 2;
const maxJobsPerWorker = process.env.WORKER_MAX_JOBS
  ? parseInt(process.env.WORKER_MAX_JOBS)
  : 1;
// const maxJobsPerWorker = 1;

console.log(
  `${PF}` +
    ` | INIT` +
    ` | process.env.WORKER_START_TIMEOUT: ${process.env.WORKER_START_TIMEOUT}` +
    ` | process.env.REDIS_TLS_URL: ${process.env.REDIS_TLS_URL}` +
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

const url = require("url");
const Redis = require("ioredis");
// const redis = require("redis");

function redisReady() {
  return new Promise(function (resolve) {
    // const redisClient = new Redis(process.env.REDIS_TLS_URL, {
    //   tls: {
    //     rejectUnauthorized: false,
    //   },
    // });
    // const redisClient = redis.createClient(process.env.REDIS_TLS_URL);

    const redis_uri = url.parse(process.env.REDIS_TLS_URL);
    const redisClient = new Redis({
      port: Number(redis_uri.port) + 1,
      host: redis_uri.hostname,
      password: redis_uri.auth.split(":")[1],
      db: 0,
      tls: {
        rejectUnauthorized: false,
        requestCert: true,
        agent: false,
      },
    });

    console.log(
      `${PF} | WAIT REDIS | CLIENT STATUS: ${redisClient.status} process.env.REDIS_TLS_URL: ${process.env.REDIS_TLS_URL}`
    );
    const redisReadyInterval = setInterval(() => {
      if (redisClient.status === "ready") {
        console.log(
          `${PF} | REDIS CLIENT | STATUS: ${redisClient.status} | process.env.REDIS_TLS_URL: ${process.env.REDIS_TLS_URL}`
        );
        clearInterval(redisReadyInterval);
        redisClient.quit();
        resolve();
      } else {
        console.log(
          `${PF} | WAIT REDIS CLIENT | STATUS: ${redisClient.status} | process.env.REDIS_TLS_URL: ${process.env.REDIS_TLS_URL}`
        );
      }
    }, 30 * ONE_SECOND);
  });
}

const start = () => {
  console.log(
    `${PF} | ... WAIT | WORKER | PID: ${process.pid} START | process.env.REDIS_TLS_URL: ${process.env.REDIS_TLS_URL}`
  );

  redisReady()
    .then(() => {
      console.log(
        `${PF} | +++ WORKER | PID: ${process.pid} START | process.env.REDIS_TLS_URL: ${process.env.REDIS_TLS_URL}`
      );
      const workQueue = new Queue(
        "updateRecommendations",
        process.env.REDIS_TLS_URL
      );

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
    })
    .catch((err) => {
      console.log(`${PF} | *** REDIS READY ERROR: ${err}`);
    });
};

// Initialize the clustered worker process
// See: https://devcenter.heroku.com/articles/node-concurrency for more info

setTimeout(() => {
  throng({ workers, start });
}, WORKER_START_TIMEOUT);
