const dotenv = require("dotenv");

if (process.env.ARTYOU_ENV_VARS_FILE) {
  const envConfig = dotenv.config({ path: process.env.ARTYOU_ENV_VARS_FILE });
  if (envConfig.error) {
    throw envConfig.error;
  }
  console.log("A47BE | +++ ENV CONFIG LOADED");
  console.log({ envConfig });
} else {
  console.log(`A47BE | !!! ENV CONFIG NOT SET: ARTYOU_ENV_VARS_FILE`);
  console.log(`A47BE | !!! ENV CONFIG NOT LOADED`);
}
const DYNO = process.env.DYNO || "NO_DYNO";

console.log(`DYNO: ${DYNO}`);

process.on("SIGTERM", () => {
  console.log(`APP | ${process.pid} received a SIGTERM signal`);
  process.exit(0);
});

process.on("SIGINT", () => {
  console.log(`APP | ${process.pid} has been interrupted`);
  process.exit(0);
});

// const ONE_SECOND = 1000;
// const ONE_MINUTE = 60 * ONE_SECOND;
// const ONE_HOUR = 60 * ONE_MINUTE;

const EPOCHS = process.env.ART47_NN_FIT_EPOCHS
  ? parseInt(process.env.ART47_NN_FIT_EPOCHS)
  : 1000;

console.log(`A47BE | NN FIT EPOCHS: ${EPOCHS}`);
console.log(`A47BE | process.env.REDIS_URL: ${process.env.REDIS_URL}`);

console.log(`A47BE | START WORKER UPDATE RECS QUEUE: updateRecommendations`);

const Queue = require("bull");
const { join } = require("path");
const createError = require("http-errors");
const express = require("express");
const slash = require("express-slash");
const cors = require("cors");
const chalk = require("chalk");
const { auth } = require("express-openid-connect");
const cookieSession = require("cookie-session");
const path = require("path");
const cookieParser = require("cookie-parser");
const logger = require("morgan");

let workUpdateRecommendationsQueue;

global.artyouDb = require("@threeceelabs/mongoose-artyou");
global.dbConnection = false;

const jobQueued = async (jobConfig) => {
  if (!workUpdateRecommendationsQueue) {
    console.log(
      `JOB | jobQueued | !!! workUpdateRecommendationsQueue NOT READY`
    );
    return false;
  }
  try {
    console.log(
      `JOB | jobQueued | =============================================================================`
    );
    const jobs = await workUpdateRecommendationsQueue.getJobs(
      [
        // "completed",
        // "failed",
        "delayed",
        "active",
        "waiting",
        "paused",
        "stalled",
        "stuck",
        // "null",
      ],
      0,
      100
    );

    if (jobs.length === 0) {
      console.log(
        `JOB | jobQueued | --- NO JOBS IN QUEUE workUpdateRecommendationsQueue`
      );
      console.log(
        `JOB | jobQueued | =============================================================================`
      );
      return false;
    }

    // jobs.forEach(async (job) => {
    for (const job of jobs) {
      job.state = await job.getState();

      if (
        jobConfig &&
        (job.state === "active" || job.state === "stalled") &&
        job.data.op === jobConfig.op &&
        job.data.oauthID === jobConfig.oauthID
      ) {
        console.log(
          `JOB | jobQueued | @@@ QUEUED  ` +
            ` | JID: ${job.id}` +
            ` | STATE: ${job.state}` +
            ` | OP: ${job.data.op}` +
            ` | EPOCHS: ${job.data.epochs}` +
            ` | OAUTHID: ${job.data.oauthID}`
        );
        console.log(
          `JOB | jobQueued | =============================================================================`
        );
        return job;
      }

      console.log(
        `JOB | jobQueued | @@@ ENQUEUED` +
          ` | JID: ${job.id}` +
          ` | STATE: ${job.state}` +
          ` | OP: ${job.data.op}` +
          ` | EPOCHS: ${job.data.epochs}` +
          ` | OAUTHID: ${job.data.oauthID}`
      );
      console.log(
        `JOB | jobQueued | =============================================================================`
      );
    }

    return false;
  } catch (err) {
    console.log(`JOB | jobQueued ERROR: ${err}`);
    throw err;
  }
};

(async () => {
  try {
    global.dbConnection = await global.artyouDb.connect();

    console.log(`A47BE | ... CREATING WORKER QUEUE`);

    await jobQueued();

    workUpdateRecommendationsQueue = new Queue(
      "updateRecommendations",
      process.env.REDIS_URL
    );

    workUpdateRecommendationsQueue.on(
      "global:completed",
      async (jobId, result) => {
        console.log(
          `A47BE | UPDATE REC JOB ${jobId} | COMPLETE | RESULT`,
          result
        );
        await jobQueued();
      }
    );
    workUpdateRecommendationsQueue.on(
      "global:failed",
      async (jobId, result) => {
        console.log(
          `A47BE | UPDATE REC JOB ${jobId} | *** FAILDED | RESULT`,
          result
        );
        await jobQueued();
      }
    );
    workUpdateRecommendationsQueue.on("global:error", async (jobId, result) => {
      console.log(
        `A47BE | UPDATE REC JOB ${jobId} | *** ERROR | RESULT`,
        result
      );
      await jobQueued();
    });

    await workUpdateRecommendationsQueue.clean(1000, "active");
    await workUpdateRecommendationsQueue.clean(1000, "completed");
    await workUpdateRecommendationsQueue.clean(1000, "failed");
    await jobQueued();
  } catch (err) {
    console.log(`A47BE | *** ERROR DB + REDIS + WORKER QUEUE INIT | ERR:`, err);
  }
})();

const statsRouter = require("./routes/stats");
const loginRouter = require("./routes/login");
const artworksRouter = require("./routes/artworks");
const artistsRouter = require("./routes/artists");
const ratingsRouter = require("./routes/ratings");
const recommendationsRouter = require("./routes/recommendations");
const usersRouter = require("./routes/users");
const networkinputsRouter = require("./routes/networkinputs");
const neuralnetworksRouter = require("./routes/neuralnetworks");

const S3Client = require("./lib/awsS3Client.js");
const s3c = new S3Client("S3C");

s3c.on("ready", async (appName) => {
  console.log(`S3C | READY | APP NAME: ${appName}`);
});

s3c.on("connect", async (appName) => {
  console.log(`S3C | DB CONNECTED | APP NAME: ${appName}`);

  const bucketName = "art-you";
  const keyName = "hello_world.txt";
  const body = "Hello World!";

  const putParams = { Bucket: bucketName, Key: keyName, Body: body };
  const getParams = { Bucket: bucketName, Key: keyName };

  await s3c.putObject(putParams);
  const data = await s3c.getObject(getParams);

  if (data === body) {
    console.log(chalk.green(`${appName} | PUT/GET TEST | DATA: ${data}`));
  } else {
    console.log(
      chalk.red.bold(
        `${appName} | *** PUT/GET TEST ERROR | DATA: ${data} | EXPECTED: ${body}`
      )
    );
  }
});

const NeuralNetworkTools = require("./lib/nnTools.js");
const nnt = new NeuralNetworkTools("NNT");

nnt.on("ready", async (appName) => {
  console.log(`NNT | READY | APP NAME: ${appName}`);
});

nnt.on("connect", async (appName) => {
  console.log(`NNT | DB CONNECTED | APP NAME: ${appName}`);
  // console.log(`NNT | >>> START NETWORK TEST`);
  // await nnt.runNetworkTest();
});

//==================================================================================
//==================================================================================
//==================================================================================
const config = {
  authRequired: false,
  auth0Logout: true,
  secret: process.env.AUTH0_SECRET,
  baseURL: "http://localhost:3000",
  clientID: "Utmgokd22lCluIMbM2WzmAVgyjCsHPxB",
  issuerBaseURL: "https://wild-disk-7982.us.auth0.com",
};

const app = express();
app.enable("strict routing");

app.use(express.json());
app.use(express.urlencoded({ extended: false }));

app.use(auth(config));

var allowedOrigins = [
  "https://www.art47.org",
  "https://art47.org",
  "http://localhost:5000",
  "http://localhost:3000",
  "https://threecee-art-you-frontend.herokuapp.com",
  "https://art47-frontend.herokuapp.com",
];

console.log({ allowedOrigins });

app.use(
  cors({
    // credentials: true,
    origin: function (origin, callback) {
      // console.log({ origin });
      // allow requests with no origin
      // (like mobile apps or curl requests)
      if (!origin) return callback(null, true);
      if (allowedOrigins.indexOf(origin) === -1) {
        var msg =
          "The CORS policy for this site does not " +
          "allow access from the specified Origin.";
        console.log(`CORS FAIL`);
        return callback(new Error(msg), false);
      }
      return callback(null, true);
    },
  })
);

app.get("/authorized", function (req, res) {
  res.send("Secured Resource");
});

app.set("views", path.join(__dirname, "views"));
app.set("view engine", "pug");

app.use(cookieSession({ secret: process.env.ARTYOU_COOKIE_SESSION_SECRET }));

function count(req, res, next) {
  req.session.count = (req.session.count || 0) + 1;
  next();
}

app.use(logger("dev"));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, "public")));
app.use(count);

// set up rate limiter: maximum of 60 requests per minute
var RateLimit = require("express-rate-limit");
var limiter = new RateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 60,
});

// apply rate limiter to all requests
app.use(limiter);

app.post("/authenticated", async (req, res) => {
  try {
    console.info(`POST /authenticated`, req.body);

    if (req.body && req.body.sub) {
      let userDoc = await global.artyouDb.User.findOne({
        oauthID: req.body.sub,
      });

      if (!userDoc) {
        console.log(
          `APP | authenticated | ??? USER NOT FOUND | oauthID: ${req.body.sub}`
        );
        userDoc = new global.artyouDb.User({
          id: req.body.sub,
          oauthID: req.body.sub,
          email: req.body.email,
          name: req.body.name,
        });

        userDoc.image = new global.artyouDb.Image({
          url: req.body.picture,
        });

        await userDoc.save();
      } else {
        console.log(
          `APP | authenticated | USER FOUND | oauthID: ${userDoc.oauthID} | NAME: ${userDoc.name}`
        );
      }

      const userObj = userDoc.toObject();
      res.json({ user: userObj });

      const jobOptions = {
        op: "UPDATE_RECS",
        oauthID: userDoc.oauthID,
        epochs: EPOCHS,
      };

      console.log(
        `APP | JOB | ... CHECK QUEUED | OP: ${jobOptions.op} |  OAUTH ID: ${jobOptions.oauthID} | ${EPOCHS} EPOCHS`
      );

      let queuedJob = false;

      try {
        queuedJob = await jobQueued(jobOptions);
      } catch (e) {
        console.log(`APP | JOB | *** CHECK QUEUED ERROR: ${e}`);
      }

      if (workUpdateRecommendationsQueue && !queuedJob) {
        console.log(
          `APP | --> ADDING JOB | UPDATE_RECS | ${userDoc.oauthID} | ${EPOCHS} EPOCHS`
        );
        const jobAddResults = await workUpdateRecommendationsQueue.add(
          jobOptions
        );
        console.log(
          `APP | +++ ADDED JOB  | UPDATE_RECS | JID: ${jobAddResults.id} | ${userDoc.oauthID} | ${EPOCHS} EPOCHS`
        );
        await jobQueued();
      } else if (!workUpdateRecommendationsQueue) {
        console.log(
          `APP | !!! SKIP ADD JOB --- WORKER Q NOT READY | UPDATE_RECS | ${userDoc.oauthID} | ${EPOCHS} EPOCHS`
        );
      } else {
        console.log(
          `APP | !!! SKIP ENQUEUED | JID: ${queuedJob.id} | STATE: ${queuedJob.state} | UPDATE_RECS | ${queuedJob.data.oauthID} | ${queuedJob.data.epochs} EPOCHS`
        );
        await jobQueued();
      }
    } else {
      console.log("APP | ??? USER AUTHENTICATION SUB UNDEFINED");
      res.json({
        status: "ERROR",
        err: "USER AUTHENTICATION SUB UNDEFINED",
        req: req.body,
      });
    }
  } catch (err) {
    console.log(`APP | *** POST AUTH ERROR: ${err}`);
  }
});

app.use("/stats", statsRouter);
app.use("/login", loginRouter);
app.use("/artists", artistsRouter);
app.use("/artworks", artworksRouter);
app.use("/users", usersRouter);
app.use("/ratings", ratingsRouter);
app.use("/recommendations", recommendationsRouter);
app.use("/networkinputs", networkinputsRouter);
app.use("/neuralnetworks", neuralnetworksRouter);

app.use(slash());

app.get("/authorize", (req, res) => {
  console.info(`GET /authorize`);
  console.log(`req.oidc.isAuthenticated: ${req.oidc.isAuthenticated()}`);
  console.log(req.oidc);
  res.send(req.oidc.isAuthenticated() ? "Logged in" : "Logged out");
});

app.get("/authenticated", (req, res) => {
  console.info(`GET /authenticated`);
  console.log(`req.oidc.isAuthenticated: ${req.oidc.isAuthenticated()}`);
  console.log(req.oidc);
  res.send(req.oidc.isAuthenticated() ? "Logged in" : "Logged out");
});

app.get("/auth", (req, res) => {
  console.info(`GET /auth`);
  console.log(`req.oidc.isAuthenticated: ${req.oidc.isAuthenticated()}`);
  console.log(req.oidc);
  res.send(req.oidc.isAuthenticated() ? "Logged in" : "Logged out");
});

app.get("/", (req, res) => {
  console.log(`req.oidc.isAuthenticated: ${req.oidc.isAuthenticated()}`);
  console.log(req.oidc);
  res.send(req.oidc.isAuthenticated() ? "Logged in" : "Logged out");
});

app.get("/callback", (req, res) => {
  console.info(`GET /callback`);
  res.sendStatus(200);
});

app.get("/logout", (req, res) => {
  console.info(`GET /logout`);
  res.sendStatus(200);
});

// Endpoint to serve the configuration file
app.get("/auth_config.json", (req, res) => {
  console.info(`GET /auth_config.json: ${join(__dirname, "auth_config.json")}`);
  res.sendFile(join(__dirname, "auth_config.json"));
});

// catch 404 and forward to error handler
app.use(function (req, res, next) {
  next(createError(404));
});

// error handler
app.use(function (err, req, res) {
  // set locals, only providing error in development
  res.locals.message = err.message;
  res.locals.error = req.app.get("env") === "development" ? err : {};

  // render the error page
  res.status(err.status || 500);
  res.render("error");
});

module.exports = app;
