const model = 'Recommendation';

const express = require('express');
const router = express.Router();

router.get('/:id', async (req, res) => {

  const query = {}

  console.log(`GET ${model} | ID: ${req.params.id}`)
  query.id = req.params.id

  const doc = await global.artyouDb[model].findOne(query).populate({path: 'artwork', populate: { path: 'artist'}}).populate('user').lean();
  console.log(`FOUND ${model} | ${doc.id}`)

  res.json(doc)

});

router.get('/', async (req, res) => {
  try{
    console.log(`${model} | GET`)
    const docs = await global.artyouDb[model].find({}).populate('artwork').populate('user').lean();
    console.log(`FOUND ${docs.length} ${model}s`)
    res.json(docs)
  }
  catch(err){
    console.error(`GET | ${model} | ID: ${req.body.id} ERROR: ${err}`)
    res.status(400).send(`GET | ${model} | ID: ${req.body.id} | ERROR: ${err}`)
  }
});
  
module.exports = router;
