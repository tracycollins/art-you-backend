const PF = `WATCH_${process.pid}`;

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

agenda.on("start:recsUpdate", (job) => {
  console.log(`${PF} | AGENDA | JOB %s STARTING ...`, job.attrs.name);
});

agenda.on("complete:recsUpdate", (job) => {
  console.log(`${PF} | AGENDA | JOB %s FINISHED`, job.attrs.name);
});

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
  const epochs = process.env.ART47_NN_FIT_EPOCHS || 1000;

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
          `${PF} | ADD JOB TO WATCHER Q | UPDATE_RECS | OAUTH ID: ${user.id} | ${epochs} EPOCHS | FORCE FIT: ${FORCE_FIT}`
        );

        const updateRecsJobOptions = {
          op: "UPDATE_RECS",
          oauthID: user.oauthID,
          epochs: epochs,
          forceFit: FORCE_FIT,
        };

        try {
          const job = await agenda.now("recsUpdate", updateRecsJobOptions);
          const jobsInDb = await agenda.jobs(
            { name: job.attrs.name },
            { data: job.attrs.data },
            3,
            0
          );

          console.log({ jobsInDb });
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

const start = () => {
  console.log(`${PF} | ... WAIT | WATCHER | PID: ${process.pid} START`);
  console.log(`${PF} | +++ WATCHER | PID: ${process.pid} START`);

  console.log(`${PF} | initUserRatingUpdateJobQueue`);
};

initUserRatingUpdateJobQueueInterval = setInterval(async () => {
  await initUserRatingUpdateJobQueue();
}, ONE_MINUTE);

(async () => {
  try {
    global.dbConnection = await global.art47db.connect();
    start();
  } catch (err) {
    console.log(`${PF} | *** ERROR DB INIT | ERR:`, err);
  }
})();
