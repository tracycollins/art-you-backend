const express = require('express');
const router = express.Router();

const model = 'Rating';

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

  try{
    const query = {}

    console.log(`GET ${model} | ID: ${req.params.id}`)
    query.id = req.params.id

    const doc = await global.artyouDb[model].findOne(query).populate({path: 'artwork', populate: { path: 'artist'}}).populate('user').lean();
    console.log(`FOUND ${model} | ${doc.id}`)

    res.json(doc)
  }
  catch(err){
    console.error(`GET | ${model} | ID: ${req.body.id} ERROR: ${err}`)
    res.status(400).send(`GET | ${model} | ID: ${req.body.id} | ERROR: ${err}`)
  }

});

router.post('/create', async (req, res) => {
  try{
    console.log(req.body)
    console.log(`${model} | POST | CREATE ${model} | USER: ${req.body.user.email} | ARTWORK: ${req.body.artwork.id} | RATE: ${req.body.rate}`)
    const doc = new global.artyouDb[model](req.body);
    console.log(`CREATED | ${model} | ID: ${doc.id}`)
    console.log({doc})
    res.json(doc)
  }
  catch(err){
    console.error(`POST | CREATE | ${model} | ID: ${req.body.id} ERROR: ${err}`)
    res.status(400).send(`GET | ${model} | ID: ${req.body.id} | ERROR: ${err}`)
  }
});
  
router.post('/update', async (req, res) => {

  try{

    console.log(`${model} | POST | UPDATE ${model} | ID: ${req.body.id} | USER: ${req.user.email} | ARTWORK: ${req.artwork.id} | RATE: ${req.body.rate}`)
    console.log(req.body)

    const doc = await global.artyouDb[model].findOne({id: req.body.id}).populate({path: 'artwork', populate: { path: 'artist'}}).populate('user');
    doc.rate = req.body.rate;
    await doc.save()

    console.log(`UPDATED | ${model} | ID: ${doc.id}`)
    console.log({doc})

    res.json(doc)
  }
  catch(err){
    console.error(`POST | UPDATE | ${model} | ID: ${req.body.id} ERROR: ${err}`)
    res.status(400).send(`GET | ${model} | ID: ${req.body.id} | ERROR: ${err}`)
  }
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
