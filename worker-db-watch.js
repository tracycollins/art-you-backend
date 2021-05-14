const PF = `WATCH_${process.pid}`;
const moment = require("moment");
const defaultDateTimeFormat = "YYYYMMDD_HHmmss";

console.log({ PF });

global.art47db = require("@threeceelabs/mongoose-art47");
global.dbConnection = false;

const dbName = "art47";
const mongoConnectionString = `mongodb+srv://${process.env.MONGODB_ATLAS_USERNAME}:${process.env.MONGODB_ATLAS_PASSWORD}@cluster0.kv4my.mongodb.net/${dbName}?retryWrites=true&w=majority`;

const Agenda = require("agenda");
const agenda = new Agenda({ db: { address: mongoConnectionString } });

agenda.on("ready", async (data) => {
  console.log(`${PF} | AGENDA | READY`);
});

agenda.on("start", (job) => {
  console.log(`${PF} | AGENDA | JOB ${job.attrs.name} STARTING ...`);
});

agenda.on("fail", (err, job) => {
  console.log(`${PF} | AGENDA | *** JOB FAIL: ${job.attrs.name} | ERR: ${err}`);
});

agenda.on("complete", (job) => {
  console.log(
    `${PF} | AGENDA | JOB ${job.attrs.name} FINISHED | RATING COUNT: ${job.attrs.data.ratingCount}`
  );
  if (
    job.attrs.data.ratingCount &&
    allUsersRatingCount[job.attrs.data.user_id]
  ) {
    if (
      allUsersRatingCount[job.attrs.data.user_id] >= job.attrs.data.ratingCount
    ) {
      allUsersRatingCount[job.attrs.data.user_id] -= job.attrs.data.ratingCount;
    } else {
      delete allUsersRatingCount[job.attrs.data.user_id];
    }
  }
  console.log(
    `${PF} | AGENDA | JOB ${
      job.attrs.name
    } FINISHED | RATING COUNT REMAINING: ${
      allUsersRatingCount[job.attrs.data.user_id]
    }`
  );
});

const getTimeStamp = function (inputTime) {
  let currentTimeStamp;

  if (inputTime === null || inputTime === undefined) {
    return "N/A";
  }
  if (inputTime === 0) {
    currentTimeStamp = moment().format(defaultDateTimeFormat);
    return currentTimeStamp;
  }
  if (moment.isMoment(inputTime)) {
    currentTimeStamp = moment(inputTime).format(defaultDateTimeFormat);
    return currentTimeStamp;
  }
  if (moment.isDate(new Date(inputTime))) {
    currentTimeStamp = moment(new Date(inputTime)).format(
      defaultDateTimeFormat
    );
    return currentTimeStamp;
  }
  currentTimeStamp = moment(parseInt(inputTime)).format(defaultDateTimeFormat);
  return currentTimeStamp;
};

const {
  resetUserRatingCount,
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

let nntUpdateRecommendationsReady = true;
const initUserRatingUpdateJobQueue = async () => {
  // eslint-disable-next-line no-useless-catch

  const triggerNetworkFitRatingsUpdateNumber =
    process.env.TRIGGER_RATINGS_UPDATE_NUMBER || 10;
  const allUsersRatingCount = getAllUsersRatingCount();
  const userIds = Object.keys(allUsersRatingCount);
  const epochs = process.env.ART47_NN_FIT_EPOCHS || 100;

  try {
    console.log(
      `${PF}` +
        ` | initUserRatingUpdateJobQueue` +
        ` | nntUpdateRecommendationsReady: ${nntUpdateRecommendationsReady}` +
        ` | triggerNetworkFitRatingsUpdateNumber: ${triggerNetworkFitRatingsUpdateNumber}` +
        ` | ${userIds.length} USERS`
    );

    console.log({ allUsersRatingCount });

    for (const user_id of userIds) {
      if (
        nntUpdateRecommendationsReady &&
        allUsersRatingCount[user_id] >= triggerNetworkFitRatingsUpdateNumber
      ) {
        nntUpdateRecommendationsReady = false;

        const user = await global.art47db.User.findOne({
          _id: user_id,
        });

        console.log(
          `${PF} | ADD JOB TO WATCHER Q` +
            ` | UPDATE_RECS` +
            ` | OAUTH ID: ${user.oauthID}` +
            ` | ${epochs} EPOCHS` +
            ` | ${allUsersRatingCount[user._id]} RATINGS` +
            ` | FORCE FIT: ${FORCE_FIT}`
        );

        const updateRecsJobOptions = {
          op: "UPDATE_RECS",
          oauthID: user.oauthID,
          user_id: user._id,
          epochs: epochs,
          forceFit: FORCE_FIT,
          ratingCount: allUsersRatingCount[user._id],
        };

        try {
          const jobsInDb = await agenda.jobs(
            {
              name: "recsUpdate",
              "data.oauthID": updateRecsJobOptions.oauthID,
              $or: [{ lockedAt: { $ne: null } }, { nextRunAt: { $ne: null } }],
            },
            { lastRunAt: -1 },
            100,
            0
          );

          if (jobsInDb.length > 0) {
            console.log(
              `${PF} | !!! JOB ALREADY IN QUEUE` +
                ` | NAME: recsUpdate` +
                ` | OP: ${updateRecsJobOptions.op}` +
                ` | oauthID: ${updateRecsJobOptions.oauthID}`
            );

            for (const job of jobsInDb) {
              console.log(
                `${PF} | !!! JOB ALREADY IN QUEUE` +
                  ` | NAME: ${job.attrs.name}` +
                  ` | ID: ${job.attrs._id}` +
                  ` | OP: ${job.attrs.data.op}` +
                  ` | oauthID: ${job.attrs.data.oauthID}` +
                  ` | nextRunAt: ${moment(job.attrs.nextRunAt).format(
                    defaultDateTimeFormat
                  )}` +
                  ` | lockedAt: ${moment(job.attrs.lockedAt).format(
                    defaultDateTimeFormat
                  )}`
              );
            }
          } else {
            const job = await agenda.now("recsUpdate", updateRecsJobOptions);
            console.log(
              `${PF} | JOB START | OP: ${job.attrs.data.op}` +
                ` | NAME: ${job.attrs.name}` +
                ` | oauthID: ${job.attrs.data.oauthID}`
            );

            job.unique({
              name: job.attrs.name,
              "data.op": job.attrs.data.op,
              "data.oauthID": job.attrs.data.oauthID,
            });

            await job.save();
          }
        } catch (err) {
          if (err.code === 11000) {
            console.log(
              `${PF} | -X- JOB ALREADY RUNNING | OP: ${updateRecsJobOptions.op}` +
                ` | NAME: recsUpdate` +
                ` | oauthID: ${updateRecsJobOptions.oauthID}`
            );
          } else {
            console.log(
              `${PF} | *** JOB START ERROR | OP: ${updateRecsJobOptions.op}` +
                ` | NAME: recsUpdate` +
                ` | oauthID: ${updateRecsJobOptions.oauthID}`
            );
            console.log(err);
          }
        }
        nntUpdateRecommendationsReady = true;
      }
    }
  } catch (err) {
    console.log(
      `${PF}` +
        ` | *** initUserRatingUpdateJobQueue ERROR: ${err}` +
        ` | nntUpdateRecommendationsReady: ${nntUpdateRecommendationsReady}` +
        ` | triggerNetworkFitRatingsUpdateNumber: ${triggerNetworkFitRatingsUpdateNumber}` +
        ` | ${userIds.length} USERS`
    );

    nntUpdateRecommendationsReady = false;
    throw err;
  }
};

const jobComplete = (job) => {
  return (
    job.lastFinishedAt !== undefined &&
    job.lastRunAt !== undefined &&
    !job.lockedAt &&
    !job.nextRunAt
  );
};

let jobChangeStream;

async function initDbJobChangeStream() {
  console.log(`${PF} | initDbJobChangeStream`);

  const jobCollection = global.dbConnection.collection("agendaJobs");

  const jobChangeFilter = {
    $match: {
      $or: [
        { operationType: "insert" },
        { operationType: "delete" },
        { operationType: "update" },
        { operationType: "replace" },
      ],
    },
  };

  const jobChangeOptions = { fullDocument: "updateLookup" };

  jobChangeStream = jobCollection.watch([jobChangeFilter], jobChangeOptions);

  jobChangeStream.on("change", function (change) {
    const job = change.fullDocument;
    if (job) {
      console.log(job);
      if (jobComplete(job) && job.data.ratingCount !== undefined) {
        console.log(
          `${PF} | AGENDA | JOB ${job.name} FINISHED | RATING COUNT: ${job.data.ratingCount}`
        );
        if (job.data.ratingCount && allUsersRatingCount[job.data.user_id]) {
          if (allUsersRatingCount[job.data.user_id] >= job.data.ratingCount) {
            allUsersRatingCount[job.data.user_id] -= job.data.ratingCount;
          } else {
            delete allUsersRatingCount[job.data.user_id];
          }
        }
        console.log(
          `${PF} | AGENDA | JOB ${
            job.name
          } FINISHED | RATING COUNT REMAINING: ${
            allUsersRatingCount[job.data.user_id]
          }`
        );

        console.log(
          `${PF} | agendaJobs | ${change.operationType}` +
            ` | ${job._id}` +
            ` | ${job.name}` +
            ` | ratingCount: ${job.data.ratingCount}` +
            ` | lastModifiedBy: ${job.lastModifiedBy}` +
            ` | nextRunAt: ${getTimeStamp(job.nextRunAt)}` +
            ` | lockedAt: ${getTimeStamp(job.lockedAt)}` +
            ` | lastRunAt: ${getTimeStamp(job.lastRunAt)}` +
            ` | lastFinishedAt: ${getTimeStamp(job.lastFinishedAt)}`
        );
      }
    }
  });

  return;
}

const start = async () => {
  console.log(`${PF} | ... WAIT | WATCHER | PID: ${process.pid} START`);
  console.log(`${PF} | +++ WATCHER | PID: ${process.pid} START`);
  console.log(`${PF} | initUserRatingUpdateJobQueue`);
  await initDbJobChangeStream();
};

initUserRatingUpdateJobQueueInterval = setInterval(async () => {
  await initUserRatingUpdateJobQueue();
}, ONE_MINUTE);

(async () => {
  try {
    global.dbConnection = await global.art47db.connect();
    await start();
  } catch (err) {
    console.log(`${PF} | *** ERROR DB INIT | ERR:`, err);
  }
})();
