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

process.on("SIGTERM", () => {
  console.log(`${PF} | ${process.pid} received a SIGTERM signal`);
  process.exit(0);
});

process.on("SIGINT", () => {
  console.log(`${PF} | ${process.pid} has been interrupted`);
  process.exit(0);
});

const configuration = {};
configuration.verbose = false;

const statsObj = {};
statsObj.nnt = {};
statsObj.nnt.ready = false;
statsObj.usr = {};
statsObj.usr.ready = false;

const Queue = require("bull");

const NeuralNetworkTools = require("./lib/nnTools.js");
const nnt = new NeuralNetworkTools(`${PF}_NNT`);

nnt.on("ready", async (appName) => {
  statsObj.nnt.ready = true;
  console.log(
    `${PF} | READY | APP NAME: ${appName} | READY: ${statsObj.nnt.ready}`
  );
});

const UserTools = require("./lib/userTools.js");
const usr = new UserTools(`${PF}_USR`);

usr.on("ready", async (appName) => {
  statsObj.usr.ready = true;
  console.log(
    `${PF} | READY | APP NAME: ${appName} | READY: ${statsObj.usr.ready}`
  );
});

function waitFor(signal) {
  return new Promise(function (resolve) {
    console.log(`${PF} | WAIT | SIGNAL: ${signal}`);
    if (signal) {
      return resolve();
    }
    const waitInterval = setInterval(() => {
      if (signal) {
        console.log(`${PF} | END WAIT | SIGNAL: ${signal}`);
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

const updateUserUnrated = async (p) => {
  try {
    console.log(`${PF} | updateUserUnrated`, p.data);
    await waitFor(statsObj.usr.ready);
    const results = await usr.getUnratedArtworks(p.data);
    console.log(
      `${PF} | END updateUserUnrated | ${results.unrated.length} UNRATED`
    );
    return results;
  } catch (err) {
    console.log(`${PF} | ERROR updateUserUnrated`, err);
    throw err;
  }
};

const initUpdateRecsQueue = async () => {
  const updateRecommendationsQueue = new Queue(
    "updateRecommendations",
    process.env.REDIS_URL
  );

  updateRecommendationsQueue.process(maxJobsPerWorker, async (job) => {
    try {
      console.log(
        `${PF} | ->- WORKER | JOB START | UPDATE RECS` +
          ` | PID: ${process.pid}` +
          ` | JID: ${job.id}` +
          ` | OP: ${job.data.op}` +
          ` | OAUTHID: ${job.data.oauthID}`
      );
      const results = await updateUserRecommendations(job);
      console.log(
        `${PF} | +++ WORKER | JOB COMPLETE | UPDATE RECS` +
          ` | PID: ${process.pid}` +
          ` | JID: ${job.id}` +
          ` | OP: ${job.data.op}` +
          ` | OAUTHID: ${job.data.oauthID}`
      );
      console.log({ results });
      results.stats = statsObj;
      return results;
    } catch (err) {
      console.log(
        `${PF} | *** WORKER | *** JOB ERROR | UPDATE RECS` +
          ` | PID: ${process.pid}` +
          ` | JID: ${job.id}` +
          ` | OP: ${job.data.op}` +
          ` | OAUTHID: ${job.data.oauthID}` +
          ` | ERR: ${err}`
      );
      return {
        op: job.op,
        stats: statsObj,
        err: err,
      };
    }
  });

  updateRecommendationsQueue.on("waiting", function (jobId) {
    console.log(
      `${PF} | ... WORKER | UPDATE RECS | PID: ${process.pid} | JOB WAITING: ${jobId}`
    );
  });

  updateRecommendationsQueue.on("resumed", function (job, err) {
    console.log(
      `${PF} | --- WORKER | UPDATE RECS | PID: ${process.pid} | JOB RESUMED: ${job.id}`
    );
  });
  updateRecommendationsQueue.on("failed", function (job, err) {
    console.log(
      `${PF} | XXX WORKER | UPDATE RECS | PID: ${process.pid} | JOB FAILED: ${job.id} | ERROR: ${err}`
    );
  });
  updateRecommendationsQueue.on("stalled", function (job) {
    console.log(
      `${PF} | ??? WORKER | UPDATE RECS | PID: ${process.pid} | JOB STALLED: ${job.id}`
    );
  });

  return;
};

const initUpdateUnratedQueue = async () => {
  const updateUnratedQueue = new Queue("updateUnrated", process.env.REDIS_URL);

  updateUnratedQueue.process(maxJobsPerWorker, async (job, done) => {
    try {
      console.log(
        `${PF} | ->- WORKER | JOB START` +
          ` | PID: ${process.pid}` +
          ` | JID: ${job.id}` +
          ` | OP: ${job.data.op}` +
          ` | OAUTHID: ${job.data.oauthID}`
      );
      const results = await updateUserUnrated(job);
      console.log(
        `${PF} | +++ WORKER | JOB COMPLETE` +
          ` | PID: ${process.pid}` +
          ` | JID: ${job.id}` +
          ` | OP: ${job.data.op}` +
          ` | OAUTHID: ${job.data.oauthID}` +
          ` | ${results.unrated.length} UNRATED`
      );
      results.stats = statsObj;
      done(null, {
        op: job.op,
        stats: statsObj,
        unrated: results.unrated.length,
      });
    } catch (err) {
      console.log(
        `${PF} | *** WORKER | *** JOB ERROR | UPDATE UNRATED` +
          ` | PID: ${process.pid}` +
          ` | JID: ${job.id}` +
          ` | OP: ${job.data.op}` +
          ` | OAUTHID: ${job.data.oauthID}` +
          ` | ERR: ${err}`
      );
      done(
        {
          op: job.op,
          stats: statsObj,
          err: err,
        },
        null
      );
    }
  });

  updateUnratedQueue.on("waiting", function (jobId) {
    console.log(
      `${PF} | ... WORKER | UPDATE UNRATED | PID: ${process.pid} | JOB WAITING: ${jobId}`
    );
  });

  updateUnratedQueue.on("resumed", function (job, err) {
    console.log(
      `${PF} | --- WORKER | UPDATE UNRATED | PID: ${process.pid} | JOB RESUMED: ${job.id}`
    );
  });
  updateUnratedQueue.on("failed", function (job, err) {
    console.log(
      `${PF} | XXX WORKER | UPDATE UNRATED | PID: ${process.pid} | JOB FAILED: ${job.id} | ERROR: ${err}`
    );
  });
  updateUnratedQueue.on("stalled", function (job) {
    console.log(
      `${PF} | ??? WORKER | UPDATE UNRATED | PID: ${process.pid} | JOB STALLED: ${job.id}`
    );
  });

  return;
};

const start = async () => {
  console.log(`${PF} | ... WAIT | WORKER | PID: ${process.pid} START`);
  console.log(`${PF} | +++ WORKER | PID: ${process.pid} START`);

  await initUpdateRecsQueue();
  await initUpdateUnratedQueue();
};

setTimeout(() => {
  start();
}, WORKER_START_TIMEOUT);
