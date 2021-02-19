var express = require('express');
var router = express.Router();

router.get('/', function(req, res) {
  res.render('artists', { title: 'artists', visits: req.session.count});
});

module.exports = router;
