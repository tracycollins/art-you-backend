var express = require('express');
var router = express.Router();

router.get('/', function(req, res) {
  res.render('index', { title: 'home', visits: req.session.count});
});

module.exports = router;
