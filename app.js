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

const ONE_SECOND = 1000;
const ONE_MINUTE = 60 * ONE_SECOND;
const ONE_HOUR = 60 * ONE_MINUTE;

const EPOCHS = process.env.ART47_NN_FIT_EPOCHS
  ? parseInt(process.env.ART47_NN_FIT_EPOCHS)
  : 1000;

console.log(`A47BE | NN FIT EPOCHS: ${EPOCHS}`);

// const REDIS_URL = process.env.REDIS_URL;
console.log(`A47BE | process.env.REDIS_URL: ${process.env.REDIS_URL}`);

const WORKER_QUEUE_LIMITER_MAX = process.env.WORKER_QUEUE_LIMITER_MAX
  ? parseInt(process.env.WORKER_QUEUE_LIMITER_MAX)
  : 2;

console.log(`A47BE | WORKER_QUEUE_LIMITER_MAX: ${WORKER_QUEUE_LIMITER_MAX}`);

const WORKER_QUEUE_LIMITER_DURATION = process.env.WORKER_QUEUE_LIMITER_DURATION
  ? parseInt(process.env.WORKER_QUEUE_LIMITER_DURATION)
  : 2 * ONE_HOUR;

console.log(
  `A47BE | WORKER_QUEUE_LIMITER_DURATION: ${WORKER_QUEUE_LIMITER_DURATION}`
);

console.log(`A47BE | START WORKER UPDATE RECS QUEUE: updateRecommendations`);

const Queue = require("bull");

const { join } = require("path");
const createError = require("http-errors");
const express = require("express");
const cors = require("cors");
const chalk = require("chalk");

// const jwt = require('express-jwt');
// const jwks = require('jwks-rsa');

// const { auth, requiresAuth } = require("express-openid-connect");
const { auth } = require("express-openid-connect");

const cookieSession = require("cookie-session");
const path = require("path");
const cookieParser = require("cookie-parser");
const logger = require("morgan");

let workUpdateRecommendationsQueue;

global.artyouDb = require("@threeceelabs/mongoose-artyou");
global.dbConnection = false;

const Redis = require("ioredis");
// const redis = require("redis");

function redisReady() {
  return new Promise(function (resolve) {
    const redisClient = new Redis(process.env.REDIS_URL);
    // const redisClient = redis.createClient(process.env.REDIS_URL);
    console.log(
      `A47BE | WAIT REDIS | CLIENT STATUS: ${redisClient.status} process.env.REDIS_URL: ${process.env.REDIS_URL}`
    );
    const redisReadyInterval = setInterval(() => {
      if (redisClient.status === "ready") {
        console.log(
          `A47BE | REDIS CLIENT | STATUS: ${redisClient.status} | process.env.REDIS_URL: ${process.env.REDIS_URL}`
        );
        clearInterval(redisReadyInterval);
        redisClient.quit();
        resolve();
      } else {
        console.log(
          `A47BE | WAIT REDIS CLIENT | STATUS: ${redisClient.status} | process.env.REDIS_URL: ${process.env.REDIS_URL}`
        );
      }
    }, 10 * ONE_SECOND);
  });
}

const jobQueued = async (jobConfig) => {
  try {
    const jobs = await workUpdateRecommendationsQueue.getJobs(
      ["completed", "active", "failed", "stalled"],
      0,
      100
    );

    jobs.forEach(async (job) => {
      const jobState = await job.getState();
      console.log(
        `JOB` +
          ` | JID: ${job.id}` +
          ` | STATE: ${jobState}` +
          ` | OP: ${job.data.op}` +
          ` | OAUTHID: ${job.data.oauthID}` +
          ` | EPOCHS: ${job.data.epochs}`
      );
      if (
        (jobState === "active" || jobState === "stalled") &&
        job.data.op === jobConfig.op &&
        job.data.oauthID === jobConfig.oauthID
      ) {
        console.log(
          `JOB | -*- Q HIT` +
            ` | JID: ${job.id}` +
            ` | STATE: ${jobState}` +
            ` | OP: ${job.data.op}` +
            ` | OAUTHID: ${job.data.oauthID}` +
            ` | EPOCHS: ${job.data.epochs}`
        );
        return true;
      }
    });
    return false;
  } catch (err) {
    console.log(`JOB | jobQueued ERROR: ${err}`);
    throw err;
  }
};

(async () => {
  global.dbConnection = await global.artyouDb.connect();

  await redisReady();

  workUpdateRecommendationsQueue = new Queue(
    "updateRecommendations",
    {
      limiter: {
        max: WORKER_QUEUE_LIMITER_MAX,
        duration: WORKER_QUEUE_LIMITER_DURATION,
      },
    },
    process.env.REDIS_URL
  );

  workUpdateRecommendationsQueue.on("global:completed", (jobId, result) => {
    console.log(`A47BE | UPDATE REC JOB ${jobId} | COMPLETE | RESULT`, result);
  });
  workUpdateRecommendationsQueue.on("global:failed", (jobId, result) => {
    console.log(
      `A47BE | UPDATE REC JOB ${jobId} | *** FAILDED | RESULT`,
      result
    );
  });
  workUpdateRecommendationsQueue.on("global:error", (jobId, result) => {
    console.log(`A47BE | UPDATE REC JOB ${jobId} | *** ERROR | RESULT`, result);
  });

  await workUpdateRecommendationsQueue.clean(1000, "active");
  await workUpdateRecommendationsQueue.clean(1000, "completed");
  await workUpdateRecommendationsQueue.clean(1000, "failed");
})();

// const indexRouter = require('./routes/index');
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

app.use(express.json());
app.use(express.urlencoded({ extended: false }));

app.use(auth(config));

var allowedOrigins = [
  "https://www.art47.org",
  "https://art47.org",
  "http://localhost:5000",
  "http://localhost:3000",
  "https://threecee-art-you-frontend.herokuapp.com",
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
      // console.log(`CORS OK`);
      return callback(null, true);
    },
  })
);

// const jwtCheck = jwt({
//   secret: jwks.expressJwtSecret({
//     cache: true,
//     rateLimit: true,
//     jwksRequestsPerMinute: 5,
//     jwksUri: 'https://wild-disk-7982.us.auth0.com/.well-known/jwks.json'
//   }),
//   audience: 'https://artyou/api',
//   issuer: 'https://wild-disk-7982.us.auth0.com/',
//   algorithms: ['RS256']
// });

// app.use(jwtCheck);

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
      console.log(
        `APP | ADDING JOB TO WORKER QUEUE | UPDATE_RECS | ${userDoc.oauthID} | ${EPOCHS} EPOCHS | process.env.REDIS_URL: ${process.env.REDIS_URL}`
      );

      const userObj = userDoc.toObject();
      res.json({ user: userObj });

      const jobOptions = {
        op: "UPDATE_RECS",
        oauthID: userDoc.oauthID,
        epochs: EPOCHS,
      };

      const jobAlreadyQueued = await jobQueued(jobOptions);

      if (workUpdateRecommendationsQueue && !jobAlreadyQueued) {
        const jobUpdateRecs = await workUpdateRecommendationsQueue.add(
          jobOptions
        );

        console.log(`JOB ADDED`);
        console.log(jobUpdateRecs.data);
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
    // res.sendStatus(503);
  }
});

app.use("/login", loginRouter);
app.use("/artists/", artistsRouter);
app.use("/artworks", artworksRouter);
app.use("/users", usersRouter);
app.use("/ratings", ratingsRouter);
app.use("/recommendations", recommendationsRouter);
app.use("/networkinputs", networkinputsRouter);
app.use("/neuralnetworks", neuralnetworksRouter);

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

// app.head("/simple-cors", (req, res) => {
//   console.info("HEAD /simple-cors");
//   res.sendStatus(204);
// });
// app.get("/simple-cors", (req, res) => {
//   console.info("GET /simple-cors");
//   res.json({
//     text: "Simple CORS requests are working. [GET]"
//   });
// });
// app.post("/simple-cors", (req, res) => {
//   console.info("POST /simple-cors");
//   res.json({
//     text: "Simple CORS requests are working. [POST]"
//   });
// });

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
