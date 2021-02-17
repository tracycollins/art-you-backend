var express = require('express');
var router = express.Router();

/* GET users listing. */
router.get('/', function(req, res) {
  res.render('artworks', { title: 'Artworks', visits: req.session.count});
});

module.exports = router;
