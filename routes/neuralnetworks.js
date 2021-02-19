const express = require('express');
const router = express.Router();
const NeuralNetworkTools = require("../lib/nnTools.js");
const nnt = new NeuralNetworkTools("NNT");

const statsObj = {};
statsObj.evolve = {};
statsObj.evolve.stats = {};

nnt.on("ready", async () => {
  console.log(`NNT READY`)
  nnt.verbose(true)
})

/* GET users listing. */
router.get('/', function(req, res) {
  res.render('neuralnetworks', { title: 'neural networks', visits: req.session.count});
});

router.get('/test', async function(req, res) {
  res.render('networkTest', { title: 'neural networks test', visits: req.session.count});
  await nnt.runNetworkTest();
});

module.exports = router;
