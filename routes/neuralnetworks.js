var express = require('express');
var router = express.Router();
const NeuralNetworkTools = require("../lib/nnTools.js");
const nnt = new NeuralNetworkTools("NNT");

nnt.on("ready", () => {
  console.log(`NNT READY`)
  nnt.verbose(true)
})


/* GET users listing. */
router.get('/', function(req, res) {
  res.render('neuralnetworks', { title: 'Neural Networks', visits: req.session.count});
});

module.exports = router;
