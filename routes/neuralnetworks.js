const express = require('express');
const router = express.Router();
const cors = require('cors');

global.artyouDb = require("@threeceelabs/mongoose-artyou");
global.dbConnection = false;

const main = async () => {
  try{
    global.dbConnection = await global.artyouDb.connect();
  }
  catch(err){
    console.error(`AYBE | ROUTE: NNs | *** DB CONNECT ERROR: ${err}`)
    throw err;
  }
}

main()
.then(() => {
  console.log(`AYBE | ROUTE: NNs | MAIN OK`)
})
.catch((err) => console.error(err))

router.param('id', cors(), async (req, res, next, id) => {
  console.log(`NN | REQ | METHOD: ${req.method} | NN ID: ${id}`)
  try{
    const networkDoc = await global.artyouDb.NeuralNetwork.findOne({id: id});
    if (networkDoc){
      console.log(`NN | FOUND ${networkDoc.id}`)
      req.id = id;
      req.networkDoc = networkDoc;
      next();
    }
    else{
      next(new Error(`NN | NN ${id} NOT FOUND`))
    }
  }
  catch(err){
    console.error(`NN | ${req.method} | NN ID: ${id} | ERROR: ${err}`)
    next(err)
  }
  // next()
})

router.get('/:id', cors(), async (req, res, next) => {
  if (req.networkDoc){
    res.json(req.networkDoc)
  }
  else{
    res.status(404).send(`GET | NN ${req.id} NOT FOUND`)
  }
});

router.post('/:id', cors(), async (req, res, next) => {
  console.log(`NN | POST | ${req.body.id}`)
  try{
    const newNnDoc = new global.artyouDb.NeuralNetwork(req.body)
    await newNnDoc.save()
    res.json(newNnDoc)
  }
  catch(err){
    console.error(`NN | POST | ${req.body.id} ERROR: ${err}`)
    res.status(400).send(`POST ERROR | NN ID: ${req.body.id} | ERROR: ${err}`)
  }
});

router.patch('/:id', cors(), async (req, res, next) => {

  try{
    console.log(`NN | PATCH | ${req.body.id}`)

    if (req.networkDoc){
      console.log(`NN | PATCH | UPDATING ${req.body.id} ...`)
      for (const key of Object.keys(req.body)){
        req.networkDoc[key] = req.body[key]
        req.networkDoc.markModified(key)
      }
      await req.networkDoc.save()
      res.json(req.networkDoc)
    }
    else{
      console.log(`NN | PATCH | CREATING ${req.body.id} ...`)
      const newNnDoc = new global.artyouDb.NeuralNetwork(req.body)
      await newNnDoc.save()
      res.json(newNnDoc)
    }
  }
  catch(err){
    console.error(`NN | PATCH | ${req.body.id} ERROR: ${err}`)
    res.status(400).send(`PATCH ERROR | NN ID: ${req.body.id} | ERROR: ${err}`)
  }
    
});

router.get('/', cors(), async (req, res, next) => {
  try{
    console.log(`req.id: ${req.id}`)
    const nnArray = await global.artyouDb.NeuralNetwork.find({}).lean();
    console.log(`FOUND ${nnArray.length} NNs`)
    res.json(nnArray)
  }
  catch(err){
    console.error(`NN | GET | ERROR: ${err}`)
    res.status(400).send(`PATCH ERROR | NN ID: ${req.body.id} | ERROR: ${err}`)
  }
});


// router.route('/')
// .all(function (req, res, next) {
//   // runs for all HTTP verbs first
//   // think of it as route specific middleware!
//   console.log(`NN | REQ:`, req.params)
//   next()
// })
// .get(async (req, res, next) => {

//   if (req.id !== undefined && req.networkDoc !== undefined){
//     res.json(req.networkDoc.toObject())
//   }

//   console.log(`NN | GET QUERY: {}`)
//   const nnArray = await global.artyouDb.NeuralNetwork.find({}).lean();
//   console.log(`NN | FOUND ${nnArray.length} NNs`)
//   res.json(nnArray)

// })
// .put(async (req, res, next) => {
// // just an example of maybe updating the user

//   if (req.id === undefined){
//     res.status(400).send(`PUT | NN ID UNDEFINED`)
//   }

//   console.log(`NN | PUT PARAMS:`, req.params)

//   if (req.networkDoc === undefined){
//     res.status(404).send(`PUT | NN ${req.id} NOT FOUND`)
//   }

//   next();

// })
// .post(function (req, res, next) {
//   next(new Error('not implemented'))
// })
// .delete(function (req, res, next) {
//   next(new Error('not implemented'))
// })
  
module.exports = router;
