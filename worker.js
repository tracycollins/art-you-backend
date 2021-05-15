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
const ONE_MINUTE = 60 * ONE_SECOND;
const ONE_HOUR = 60 * ONE_MINUTE;

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
    console.log(
      `${PF} | ================================================================================================`
    );
    console.log(`${PF} | AGENDA JOBS: ${jobs.length}`);
    console.log(
      `${PF} | ================================================================================================`
    );
    for (const job of jobs) {
      console.log(
        `${PF} | ID: ${job.attrs._id}` +
          ` | NAME: ${job.attrs.name}` +
          ` | WORKER: ${job.attrs.lastModifiedBy}` +
          ` | LOCKED: ${nnt.getTimeStamp(job.attrs.lockedAt)}` +
          ` | RUN: ${nnt.getTimeStamp(job.attrs.lastRunAt)}` +
          ` | FINISHED: ${nnt.getTimeStamp(job.attrs.lastFinishedAt)}` +
          ` | NEXT: ${nnt.getTimeStamp(job.attrs.nextRunAt)}`
      );
    }
    console.log(
      `${PF} | ================================================================================================`
    );
  } else {
    console.log(`${PF} | AGENDA | NO JOBS`);
  }
  await initUpdateRecsQueue();
});

agenda.on("start:recsUpdate", (job) => {
  console.log(`${PF} | AGENDA | JOB %s STARTING ...`, job.attrs.name);
});

agenda.on("start:test", (job) => {
  console.log(`${PF} | AGENDA | JOB %s STARTING ...`, job.attrs.name);
});

agenda.on("complete:test", (job) => {
  console.log(`${PF} | AGENDA | JOB %s FINISHED`, job.attrs.name);
});

agenda.on("complete:recsUpdate", (job) => {
  console.log(`${PF} | AGENDA | JOB %s FINISHED`, job.attrs.name);
});

agenda.on("fail", (err, job) => {
  console.log(`${PF} | AGENDA | *** JOB FAIL: ${job.attrs.name} | ERR: ${err}`);
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
      `${PF} | >>> START updateUserRecommendations` +
        ` | ${nnt.getTimeStamp(0)}` +
        ` | OP: ${params.op}`
    );
    await waitFor(statsObj.nnt.ready);
    const results = await nnt.updateRecommendations(params);
    console.log(
      `${PF} | +++ END updateUserRecommendations` +
        ` | ${nnt.getTimeStamp(0)}` +
        ` | OP: ${params.op}`
    );
    console.log(nnt.jsonPrint(results));
    return { results: results, timestamp: nnt.getTimeStamp(0) };
  } catch (err) {
    console.log(`${PF} | ERROR updateUserRecommendations`, err);
    throw err;
  }
};

const updateUserUnrated = async (p) => {
  try {
    const params = {} || p;
    console.log(
      `${PF} | >>> START updateUserUnrated` +
        ` | ${nnt.getTimeStamp(0)}` +
        ` | OP: ${params.op}`
    );
    console.log(nnt.jsonPrint(params));
    await waitFor(statsObj.usr.ready);
    const results = await usr.getUnratedArtworks(params.data);
    console.log(
      `${PF} | +++ END updateUserUnrated` +
        ` | ${nnt.getTimeStamp(0)}` +
        `| ${results.unrated.length} UNRATED`
    );
    console.log(nnt.jsonPrint(results));
    return results;
  } catch (err) {
    console.log(`${PF} | ERROR updateUserUnrated`, err);
    throw err;
  }
};

const initUpdateRecsQueue = async () => {
  console.log(`${PF} | +++ START initUpdateRecsQueue`);

  const test = async (p) => {
    const params = p || {};
    console.log(
      `${PF} | START TEST | JOB: ${params.job.attrs._id}` +
        ` | ${nnt.getTimeStamp(0)}` +
        ` | HOST: ${params.job.attrs.data.host}` +
        ` | PID: ${params.job.attrs.data.pid}` +
        ` | PERIOD: ${params.job.attrs.data.period}`
    );
    await nnt.delay({ period: params.job.attrs.data.duration });
  };

  agenda.define("test", {}, async (job) => {
    console.log(
      `${PF} | TEST | START JOB: ${job.attrs._id}` +
        ` | ${nnt.getTimeStamp(0)}` +
        ` | HOST: ${job.attrs.data.host}` +
        ` | PID: ${job.attrs.data.pid}`
    );
    await test({ job });
  });

  agenda.define("recsUpdate", { lockLifetime: ONE_HOUR }, async (job) => {
    console.log(
      `${PF} | ->- WORKER | JOB START | UPDATE RECS` +
        ` | ${nnt.getTimeStamp(0)}` +
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
        ` | ${nnt.getTimeStamp(0)}` +
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

setTimeout(async () => {
  await agenda.start();
}, WORKER_START_TIMEOUT);
