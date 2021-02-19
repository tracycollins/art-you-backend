const { join } = require("path");
const createError = require('http-errors');
const express = require('express');
const cors = require('cors');
const jwt = require('express-jwt');
const jwks = require('jwks-rsa');

// const session = require('express-session');
const cookieSession = require('cookie-session');
const path = require('path');
const cookieParser = require('cookie-parser');
const logger = require('morgan');

const indexRouter = require('./routes/index');
const loginRouter = require('./routes/login');
const artworksRouter = require('./routes/artworks');
const artistsRouter = require('./routes/artists');
const usersRouter = require('./routes/users');
const neuralnetworksRouter = require('./routes/neuralnetworks');

const NeuralNetworkTools = require("./lib/nnTools.js");
const nnt = new NeuralNetworkTools("NNT");

nnt.on("ready", async (appName) => {
  console.log(`NNT READY | APP NAME: ${appName}`)
})

nnt.on("connect", async (appName) => {
  console.log(`NNT | DB CONNECTED | APP NAME: ${appName}`)
  console.log(`NNT | >>> START NETWORK TEST`)
  await nnt.runNetworkTest();
})

//==================================================================================
//==================================================================================
//==================================================================================

const app = express();
app.use(cors())

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

// app.get('/authorized', function (req, res) {
//     res.send('Secured Resource');
// });


// app.use(session({
//   resave: false, // don't save session if unmodified
//   saveUninitialized: false, // don't create session until something stored
//   secret: 'keyboard cat'
// }));

// view engine setup
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'pug');

// add req.session cookie support
app.use(cookieSession({ secret: 'manny is cool' }));

// do something with the session

// custom middleware
function count(req, res, next) {
  req.session.count = (req.session.count || 0) + 1
  next();
  // res.send('viewed ' + req.session.count + ' times\n')
}

app.use(logger('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));
app.use(count);

app.use('/', indexRouter);
app.use('/login', loginRouter);
app.use('/artists', artistsRouter);
app.use('/artworks', artworksRouter);
app.use('/users', usersRouter);
app.use('/neuralnetworks', neuralnetworksRouter);

// Endpoint to serve the configuration file
app.get("/auth_config.json", (req, res) => {
  console.info(`GET /auth_config.json: ${join(__dirname, "auth_config.json")}`);
  res.sendFile(join(__dirname, "auth_config.json"));
});

app.head("/simple-cors", cors(), (req, res) => {
  console.info("HEAD /simple-cors");
  res.sendStatus(204);
});
app.get("/simple-cors", cors(), (req, res) => {
  console.info("GET /simple-cors");
  res.json({
    text: "Simple CORS requests are working. [GET]"
  });
});
app.post("/simple-cors", cors(), (req, res) => {
  console.info("POST /simple-cors");
  res.json({
    text: "Simple CORS requests are working. [POST]"
  });
});

// catch 404 and forward to error handler
app.use(function(req, res, next) {
  next(createError(404));
});

// error handler
app.use(function(err, req, res, next) {
  // set locals, only providing error in development
  res.locals.message = err.message;
  res.locals.error = req.app.get('env') === 'development' ? err : {};

  // render the error page
  res.status(err.status || 500);
  res.render('error');
});

module.exports = app;
