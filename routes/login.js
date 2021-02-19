const express = require('express');
const router = express.Router();
const cors = require('cors');

const allowlist = ['http://localhost:3000', 'http://localhost:3001']

const corsOptionsDelegate = function (req, callback) {

  let corsOptions;

  if (allowlist.indexOf(req.header('Origin')) !== -1) {
    corsOptions = { origin: true } // reflect (enable) the requested origin in the CORS response
  } else {
    corsOptions = { origin: false } // disable CORS for this request
  }

  console.log({corsOptions});

  callback(null, corsOptions) // callback expects two parameters: error and options
}

router.head("/", cors(corsOptionsDelegate), (req, res) => {
  console.info("HEAD /");
  res.sendStatus(204);
});

router.get("/", cors(corsOptionsDelegate), (req, res) => {
  console.info("GET /");
  // res.render('login', { title: 'art:you | login', visits: req.session.count});
  res.json({
    text: "Simple CORS requests are working. [GET]"
  });
});

router.post("/", cors(corsOptionsDelegate), (req, res) => {
  console.info("POST /");
  res.json({
    text: "Simple CORS requests are working. [POST]"
  });
});

// router.get('/', function(req, res) {
//   res.render('login', { title: 'art:you | login', visits: req.session.count});
// });

module.exports = router;
