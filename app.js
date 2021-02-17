var createError = require('http-errors');
var express = require('express');
var session = require('express-session');
var cookieSession = require('cookie-session');
var path = require('path');
var cookieParser = require('cookie-parser');
var logger = require('morgan');

var indexRouter = require('./routes/index');
var artworksRouter = require('./routes/artworks');
var artistsRouter = require('./routes/artists');
var usersRouter = require('./routes/users');

var app = express();

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
