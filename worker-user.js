// const throng = require("throng");
const PF = `UST_${process.pid}`;

console.log({ PF });

const UserTools = require("./lib/userTools.js");
let usr;

const ONE_SECOND = 1000;
const ONE_MINUTE = 60 * ONE_SECOND;

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

process.on("message", async (data) => {
  const response = await usr.getUnratedArtworks({
    model: "Artwork",
    user_id: user_id,
    populate: "ratings",
    // limit: 10,
    lean: true,
  });

  console.log(`${response.results.length} RESULTS`);
});

(async () => {
  try {
    usr = new UserTools("TUSR");

    usr.on("ready", async (appName) => {
      try {
        console.log(`USR | READY | APP NAME: ${appName}`);
      } catch (err) {
        console.error(err);
      }
    });
  } catch (err) {
    console.log(`${PF} | *** ERROR DB INIT | ERR:`, err);
  }
})();
