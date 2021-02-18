const createError = require('http-errors');
const express = require('express');
// const session = require('express-session');
const cookieSession = require('cookie-session');
const path = require('path');
const cookieParser = require('cookie-parser');
const logger = require('morgan');

const indexRouter = require('./routes/index');
const artworksRouter = require('./routes/artworks');
const artistsRouter = require('./routes/artists');
const usersRouter = require('./routes/users');
const neuralnetworksRouter = require('./routes/neuralnetworks');

const NeuralNetworkTools = require("./lib/nnTools.js");
const nnt = new NeuralNetworkTools("NNT");

nnt.on("ready", (appName) => {
  console.log(`NNT READY | APP NAME: ${appName}`)
})

nnt.on("connect", async (appName) => {
  console.log(`NNT | DB CONNECTED | APP NAME: ${appName}`)
  console.log(`NNT | >>> START NETWORK TEST`)
  await nnt.runNetworkTest();
})

const app = express();

// app.use(session({
//   resave: false, // don't save session if unmodified
//   saveUninitialized: false, // don't create session until something stored
//   secret: 'keyboard cat'
// }));

// view engine setup
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'jade');

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
app.use('/artists', artistsRouter);
app.use('/artworks', artworksRouter);
app.use('/users', usersRouter);
app.use('/neuralnetworks', neuralnetworksRouter);

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

// setTimeout(async () => {
//   await nnt.runNetworkTest();
// }, 1000);

module.exports = app;
