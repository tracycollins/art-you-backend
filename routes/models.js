const express = require('express');
const router = express.Router();

global.artyouDb = require("@threeceelabs/mongoose-artyou");
global.dbConnection = false;

const ModelsRouter = (params) => {

  const self = this;
  this.model = params.model;
  console.log("MOD_RT | MODEL: " + this.model);

  global.artyouDb.connect()
  .then((dbConn) => {
    global.dbConnection = dbConn
  })
  .catch((err) => {
    console.error(`AYBE | ROUTE: ${model} | *** ERROR: ${err}`)
    throw err;
  })
};

router.param('id', async (req, res, next, id) => {

  console.log(`DB | REQ | METHOD: ${req.method} | ${model} | ID: ${id}`)

  try{

    const doc = await global.artyouDb[model].findOne({id: id});

    if (doc){
      console.log(`DB | FOUND ${doc.id}`)
      req.id = id;
      req.doc = doc;
      next();
    }
    else{
      next(new Error(`DB | ${model} | ID: ${id} NOT FOUND`))
    }
  }
  catch(err){
    console.error(`{req.method} | ${model} | ID: ${id} | ERROR: ${err}`)
    next(err)
  }
  // next()
})

router.get('/:id', async (req, res) => {

  const query = {}

  console.log(`GET ${model} | ID: ${req.params.id}`)
  query.id = req.params.id

  const docs = await global.artyouDb[model].find(query).lean();
  console.log(`FOUND ${docs.length} ${model}s`)

  res.json(docs)

});

router.post('/:id', async (req, res, next) => {

  console.log(`POST | ${model} | ID: ${req.body.id}`)

  try{
    const doc = new global.artyouDb[model](req.body)
    await doc.save()
    res.json(doc)
  }
  catch(err){
    console.error(`POST | ${model} | ID: ${req.body.id} ERROR: ${err}`)
    res.status(400).send(`POST | ${model} | ID: ${req.body.id} | ERROR: ${err}`)
  }
});


router.get('/', async (req, res, next) => {
  try{
    const docs = await global.artyouDb[model].find({}).lean();
    console.log(`FOUND ${docs.length} ${model}s`)
    res.json(docs)
  }
  catch(err){
    console.error(`GET | ${model} | ID: ${req.body.id} ERROR: ${err}`)
    res.status(400).send(`GET | ${model} | ID: ${req.body.id} | ERROR: ${err}`)
  }
});
  
module.exports = router;
