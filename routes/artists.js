const express = require('express');
const router = express.Router();

const model = 'Artist';

global.artyouDb = require("@threeceelabs/mongoose-artyou");
global.dbConnection = false;

const main = async () => {
  try{
    global.dbConnection = await global.artyouDb.connect();
  }
  catch(err){
    console.error(`AYBE | ROUTE: ${model} | *** DB CONNECT ERROR: ${err}`)
    throw err;
  }
}

main()
.then(() => {
  console.log(`AYBE | ROUTE: ${model} | MAIN OK`)
})
.catch((err) => console.error(err))

router.get('/:id', async (req, res) => {

  const query = {}

  console.log(`GET ${model} | ID: ${req.params.id}`)
  query.id = req.params.id

  const doc = await global.artyouDb[model].findOne(query).populate('image').populate('tags').lean();
  console.log(`FOUND ${model} | ${doc.id}`)

  res.json(doc)

});

router.get('/', async (req, res) => {
  try{
    console.log(`${model} | GET`)
    const docs = await global.artyouDb[model].find({}).populate('image').populate('tags').lean();
    console.log(`FOUND ${docs.length} ${model}s`)
    res.json(docs)
  }
  catch(err){
    console.error(`GET | ${model} | ID: ${req.body.id} ERROR: ${err}`)
    res.status(400).send(`GET | ${model} | ID: ${req.body.id} | ERROR: ${err}`)
  }
});
  
module.exports = router;
