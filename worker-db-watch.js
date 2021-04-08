// const throng = require("throng");
const PF = `WATCH_${process.pid}`;

const Queue = require("bull");

console.log({ PF });

global.artyouDb = require("@threeceelabs/mongoose-artyou");
global.dbConnection = false;

const {
  // updateUserRatingCount,
  resetUserRatingCount,
  // getUserRatingCount,
  getAllUsersRatingCount,
} = require("./lib/userRatingUpdateCounter");

const ONE_SECOND = 1000;
const ONE_MINUTE = 60 * ONE_SECOND;

const FORCE_FIT =
  process.env.FORCE_FIT !== undefined ? process.env.FORCE_FIT : true;

const WORKER_START_TIMEOUT = process.env.WORKER_START_TIMEOUT
  ? parseInt(process.env.WORKER_START_TIMEOUT)
  : 10 * ONE_SECOND;

const workers = 1;
const maxJobsPerWorker = 1;

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

let initUserRatingUpdateJobQueueInterval = false;

process.on("SIGTERM", () => {
  console.log(`${PF} | ${process.pid} received a SIGTERM signal`);
  if (initUserRatingUpdateJobQueueInterval) {
    clearInterval(initUserRatingUpdateJobQueueInterval);
  }
  process.exit(0);
});

process.on("SIGINT", () => {
  console.log(`${PF} | ${process.pid} has been interrupted`);
  if (initUserRatingUpdateJobQueueInterval) {
    clearInterval(initUserRatingUpdateJobQueueInterval);
  }
  process.exit(0);
});

const configuration = {};
configuration.verbose = false;

let workQueue;

// function waitFor() {
//   return new Promise(function (resolve) {
//     console.log(`${PF} | WAIT | statsObj.nnt.ready: ${statsObj.nnt.ready}`);
//     if (statsObj.nnt.ready) {
//       return resolve();
//     }
//     const waitInterval = setInterval(() => {
//       if (statsObj.nnt.ready) {
//         console.log(
//           `${PF} | END WAIT | statsObj.nnt.ready: ${statsObj.nnt.ready}`
//         );
//         clearInterval(waitInterval);
//         resolve();
//       }
//     }, 100);
//   });
// }

const JOB_STATES = [
  "completed",
  "failed",
  "delayed",
  "active",
  "waiting",
  "paused",
  "stalled",
  "stuck",
  "null",
];

const JOB_RUNNING_STATES = [
  "delayed",
  "active",
  "waiting",
  "paused",
  "stalled",
];

const jobQueued = async (jobConfig) => {
  if (!workQueue) {
    console.log(`${PF} | JOB | jobQueued | !!! workQueue NOT READY`);
    return false;
  }
  try {
    const jobs = await workQueue.getJobs(JOB_STATES, 0, 100);

    if (jobs.length === 0) {
      console.log(`${PF} | JOB | jobQueued | --- NO JOBS IN QUEUE workQueue`);
      return false;
    }

    // jobs.forEach(async (job) => {
    for (const job of jobs) {
      job.state = await job.getState();
      console.log(
        `${PF} | JOB | jobQueued | @@@ ENQUEUED` +
          ` | JID: ${job.id}` +
          ` | STATE: ${job.state}` +
          ` | OP: ${job.data.op}` +
          ` | OAUTHID: ${job.data.oauthID}` +
          ` | EPOCHS: ${job.data.epochs}`
      );
      if (
        jobConfig &&
        JOB_RUNNING_STATES.includes(job.state) &&
        job.data.op === jobConfig.op &&
        job.data.oauthID === jobConfig.oauthID
      ) {
        console.log(
          `${PF} | JOB | jobQueued | !!! QUEUE HIT` +
            ` | JID: ${job.id}` +
            ` | STATE: ${job.state}` +
            ` | OP: ${job.data.op}` +
            ` | OAUTHID: ${job.data.oauthID}` +
            ` | EPOCHS: ${job.data.epochs}`
        );
        return job;
      }
    }

    return false;
  } catch (err) {
    console.log(`${PF} | JOB | jobQueued ERROR: ${err}`);
    throw err;
  }
};

let nntUpdateRecommendationsReady = true;
const initUserRatingUpdateJobQueue = async () => {
  // eslint-disable-next-line no-useless-catch
  try {
    const triggerNetworkFitRatingsUpdateNumber =
      process.env.TRIGGER_RATINGS_UPDATE_NUMBER || 10;
    const allUsersRatingCount = getAllUsersRatingCount();
    const userIds = Object.keys(allUsersRatingCount);
    const epochs = process.env.ART47_NN_FIT_EPOCHS || 1000;

    console.log(
      `${PF} | initUserRatingUpdateJobQueue | ${userIds.length} USERS`
    );

    for (const user_id of userIds) {
      if (
        nntUpdateRecommendationsReady &&
        allUsersRatingCount[user_id] >= triggerNetworkFitRatingsUpdateNumber
      ) {
        nntUpdateRecommendationsReady = false;

        const user = await global.artyouDb.User.findOne({
          _id: user_id,
        });

        console.log(
          `${PF} | ADD JOB TO WATCHER Q | UPDATE_RECS | OAUTH ID: ${user.id} | ${epochs} EPOCHS | FORCE FIT: ${FORCE_FIT}`
        );

        const jobOptions = {
          op: "UPDATE_RECS",
          oauthID: user.oauthID,
          epochs: epochs,
          forceFit: FORCE_FIT,
        };

        let queuedJob = false;

        try {
          queuedJob = await jobQueued(jobOptions);
        } catch (e) {
          console.log(`${PF} | JOB | *** CHECK QUEUED ERROR: ${e}`);
        }

        if (workQueue && !queuedJob) {
          console.log(
            `${PF}  | --> ADDING JOB | UPDATE_RECS` +
              ` | ${user.oauthID}` +
              ` | ${epochs} EPOCHS`
          );
          const jobAddResults = await workQueue.add(jobOptions);
          console.log(
            `${PF}  | +++ ADDED JOB  | UPDATE_RECS` +
              ` | JID: ${jobAddResults.id}` +
              ` | ${user.oauthID}` +
              ` | ${epochs} EPOCHS`
          );
          await jobQueued();
        } else if (!workQueue) {
          console.log(
            `${PF}  | !!! SKIP ADD JOB --- WORKER Q NOT READY | UPDATE_RECS` +
              ` | ${user.oauthID}` +
              ` | ${epochs} EPOCHS`
          );
        } else {
          console.log(
            `${PF}  | !!! SKIP ENQUEUED | JID: ${queuedJob.id}` +
              ` | STATE: ${queuedJob.state}` +
              ` | UPDATE_RECS | ${queuedJob.data.oauthID}` +
              ` | ${queuedJob.data.epochs} EPOCHS`
          );
          await jobQueued();
        }
        resetUserRatingCount(user_id);
        nntUpdateRecommendationsReady = true;
      }
    }

    return;
  } catch (err) {
    throw err;
  }
};

const start = () => {
  console.log(`${PF} | ... WAIT | WATCHER | PID: ${process.pid} START`);
  console.log(`${PF} | +++ WATCHER | PID: ${process.pid} START`);

  workQueue = new Queue("updateRecommendations", process.env.REDIS_URL);

  workQueue.on("waiting", function (jobId) {
    console.log(
      `${PF} | ... WATCHER | PID: ${process.pid} | JOB WAITING: ${jobId}`
    );
  });

  workQueue.on("resumed", function (job, err) {
    console.log(
      `${PF} | --- WATCHER | PID: ${process.pid} | JOB RESUMED: ${job.id}`
    );
  });
  workQueue.on("failed", function (job, err) {
    console.log(
      `${PF} | XXX WATCHER | PID: ${process.pid} | JOB FAILED: ${job.id} | ERROR: ${err}`
    );
  });
  workQueue.on("stalled", function (job) {
    console.log(
      `${PF} | ??? WATCHER | PID: ${process.pid} | JOB STALLED: ${job.id}`
    );
  });

  console.log(`${PF} | initUserRatingUpdateJobQueue`);
};

initUserRatingUpdateJobQueueInterval = setInterval(async () => {
  await initUserRatingUpdateJobQueue();
}, ONE_MINUTE);

// setTimeout(() => {
// throng({ workers, start });
// }, WORKER_START_TIMEOUT);

(async () => {
  try {
    global.dbConnection = await global.artyouDb.connect();
    start();
  } catch (err) {
    console.log(`${PF} | *** ERROR DB INIT | ERR:`, err);
  }
})();
