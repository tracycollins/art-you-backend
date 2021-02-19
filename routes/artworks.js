var express = require('express');
var router = express.Router();

router.get('/', function(req, res) {
  res.render('artworks', { title: 'artworks', visits: req.session.count});
});

module.exports = router;
