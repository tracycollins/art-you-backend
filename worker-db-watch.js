const PF = `WATCH_${process.pid}`;

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

const configuration = {};
configuration.verbose = false;

const throng = require("throng");
const Queue = require("bull");

let workQueue;

(async () => {
  try {
    global.dbConnection = await global.artyouDb.connect();
  } catch (err) {
    console.log(`${PF} | *** ERROR DB + REDIS + WORKER QUEUE INIT | ERR:`, err);
  }
})();

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

let nntUpdateRecommendationsReady = true;
const initUserRatingUpdateJobQueue = async () => {
  // eslint-disable-next-line no-useless-catch
  try {
    console.log(`${PF} | initUserRatingUpdateJobQueue`);

    const triggerNetworkFitRatingsUpdateNumber =
      process.env.TRIGGER_RATINGS_UPDATE_NUMBER || 10;
    const allUsersRatingCount = getAllUsersRatingCount();
    const userIds = Object.keys(allUsersRatingCount);
    const epochs = process.env.ART47_NN_FIT_EPOCHS || 1000;

    console.log({ allUsersRatingCount });

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
          `${PF} | ADDING JOB TO WORKER QUEUE | UPDATE_RECS | OAUTH ID: ${user.id} | ${epochs} EPOCHS | FORCE FIT: ${FORCE_FIT}`
        );

        const jobUpdateRecs = await workQueue.add({
          op: "UPDATE_RECS",
          oauthID: user.id,
          epochs: epochs,
          forceFit: FORCE_FIT,
        });

        console.log(`${PF} | JOB ADDED`);
        console.log({ jobUpdateRecs });

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
  console.log(`${PF} | ... WAIT | WORKER | PID: ${process.pid} START`);
  console.log(`${PF} | +++ WORKER | PID: ${process.pid} START`);

  workQueue = new Queue("updateRecommendations", process.env.REDIS_URL);

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

  console.log(`${PF} | initUserRatingUpdateJobQueue`);
};

setInterval(async () => {
  await initUserRatingUpdateJobQueue();
}, ONE_MINUTE);

console.log(
  `${PF} | WORKER | WAIT START TIMEOUT: ${WORKER_START_TIMEOUT / 1000} SEC`
);

setTimeout(() => {
  throng({ workers, start });
}, WORKER_START_TIMEOUT);
