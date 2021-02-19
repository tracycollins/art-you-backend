var express = require('express');
var router = express.Router();

router.get('/', function(req, res) {
  res.render('login', { title: 'art:you | login', visits: req.session.count});
});

module.exports = router;
