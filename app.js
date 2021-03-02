const dotenv = require("dotenv");

if (process.env.ARTYOU_ENV_VARS_FILE) {
  const envConfig = dotenv.config({ path: process.env.ARTYOU_ENV_VARS_FILE });
  if (envConfig.error) {
    throw envConfig.error;
  }
  console.log("AYBE | +++ ENV CONFIG LOADED");
} else {
  console.log(`AYBE | !!! ENV CONFIG NOT SET: ARTYOU_ENV_VARS_FILE`);
  console.log(`AYBE | !!! ENV CONFIG NOT LOADED`);
}

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

global.artyouDb = require("@threeceelabs/mongoose-artyou");
global.dbConnection = false;

(async () => {
  global.dbConnection = await global.artyouDb.connect();
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

app.post("/authenticated", (req, res) => {
  console.info(`POST /authenticated`);
  console.log(req.body);
  res.send(req.body);
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
  res.sendStatus(200);
});

app.get("/auth", (req, res) => {
  console.info(`GET /auth`);
  res.sendStatus(200);
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
