var express = require('express');
var router = express.Router();

/* GET users listing. */
router.get('/', function(req, res) {
  res.render('users', { title: 'Users', visits: req.session.count});
});

module.exports = router;
