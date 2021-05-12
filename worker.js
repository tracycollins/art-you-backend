const os = require("os");
let hostname = os.hostname();
hostname = hostname.replace(/.tld/g, ""); // amtrak wifi
hostname = hostname.replace(/.local/g, "");
hostname = hostname.replace(/.home/g, "");
hostname = hostname.replace(/.at.net/g, "");
hostname = hostname.replace(/.fios-router.home/g, "");
hostname = hostname.replace(/word0-instance-1/g, "google");
hostname = hostname.replace(/word-1/g, "google");
hostname = hostname.replace(/word/g, "google");

const PF = `WKR_${hostname}_${process.pid}`;

const ONE_SECOND = 1000;

const WORKER_START_TIMEOUT = process.env.WORKER_START_TIMEOUT
  ? parseInt(process.env.WORKER_START_TIMEOUT)
  : 3 * ONE_SECOND;

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

const dbName = "art47";
const mongoConnectionString = `mongodb+srv://${process.env.MONGODB_ATLAS_USERNAME}:${process.env.MONGODB_ATLAS_PASSWORD}@cluster0.kv4my.mongodb.net/${dbName}?retryWrites=true&w=majority`;

const Agenda = require("agenda");
const agenda = new Agenda({
  name: PF,
  db: { address: mongoConnectionString },
  maxConcurrency: 1,
  lockLimit: 1,
});

agenda.on("ready", async () => {
  console.log(`${PF} | AGENDA READY`);

  const jobs = await agenda.jobs({});

  if (jobs.length > 0) {
    for (const job of jobs) {
      console.log(`${PF} | AGENDA | JOB | ID: ${job.attrs._id}`);
    }
  } else {
    console.log(`${PF} | AGENDA | NO JOBS`);
  }
  await initUpdateRecsQueue();
});

agenda.on("start:recsUpdate", (job) => {
  console.log(`${PF} | AGENDA | JOB %s STARTING ...`, job.attrs.name);
});

agenda.on("complete:recsUpdate", (job) => {
  console.log(`${PF} | AGENDA | JOB %s FINISHED`, job.attrs.name);
});

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
    const params = p || {};
    console.log(
      `${PF} | updateUserRecommendations | OP: ${params.op} | OP: ${params.op}`
    );
    await waitFor(statsObj.nnt.ready);
    const results = await nnt.updateRecommendations(params);
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
  console.log(`${PF} | initUpdateRecsQueue`);

  const test = async (p) => {
    const params = p || {};
    console.log(
      `${PF} | TEST | JOB: ${params.job.attrs._id} | HOST: ${params.job.attrs.data.host} | PID: ${params.job.attrs.data.pid}`
    );
  };

  agenda.define("test", async (job) => {
    await test({ job });
    return;
  });

  agenda.define("recsUpdate", async (job) => {
    console.log(
      `${PF} | ->- WORKER | JOB START | UPDATE RECS` +
        ` | PID: ${process.pid}` +
        ` | JID: ${job.attrs._id}` +
        ` | OP: ${job.attrs.data.op}` +
        ` | OAUTHID: ${job.attrs.data.oauthID}` +
        ` | NNID: ${job.attrs.data.networkId}` +
        ` | EPOCHS: ${job.attrs.data.epochs}`
    );
    const results = await updateUserRecommendations({
      ...job.attrs.data,
      job: { id: job.attrs._id, name: job.attrs.name },
    });
    console.log(
      `${PF} | +++ WORKER | JOB COMPLETE | UPDATE RECS` +
        ` | PID: ${process.pid}` +
        ` | JID: ${job.attrs._id}` +
        ` | JOB NAME: ${job.attrs.name}`
    );
    console.log({ results });
    results.stats = statsObj;
    return results;
  });

  return;
};

const recsUpdateJob = agenda.create("recsUpdate", { op: "REC_UPDATE" });

setTimeout(async () => {
  await agenda.start();
}, WORKER_START_TIMEOUT);
