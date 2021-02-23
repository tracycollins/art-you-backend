const model = 'Rating';
const express = require('express');
const router = express.Router();

const findOneAndUpdateOptions = {
  new: true,
  upsert: true,
}

const convertOathUser = async (oathUser) => {

  const oathType = oathUser.sub.split("|")[0];
  const user = Object.assign({}, oathUser)

  switch (oathType) {
    case "google-oauth2":
      user.id = oathUser.sub
      user.oauthID = oathUser.sub
      user.firstName = oathUser.given_name
      user.lastName = oathUser.family_name
      user.image = new global.artyouDb.Image({
        id: oathUser.sub,
        url: oathUser.picture,
        title: oathUser.name
      })
    break;

    default:
  }

  return user;
}

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
    console.log(`${model} | POST | CREATE ${model} | USER: ${req.body.user.sub} | ARTWORK: ${req.body.artwork.id} | RATE: ${req.body.rate}`)

    const userObj = await convertOathUser(req.body.user)

    console.log(userObj)

    const dbUser = await global.artyouDb.User.findOneAndUpdate({id: userObj.id}, userObj, findOneAndUpdateOptions)

    const ratingObj = {
      id: `rating_${Date.now()}`,
      user: dbUser,
      artwork: req.body.artwork,
      rate: req.body.rate
    }

    const doc = new global.artyouDb[model](ratingObj);

    await doc.save();

    // add new rating to artwork.ratings array
    const updateRatingsSet = {
      $addToSet: { ratings: doc }
    }
    
    await global.artyouDb.Artwork.findOneAndUpdate({id: doc.artwork.id}, {updateRatingsSet}, findOneAndUpdateOptions)

    const populatedDoc = await doc.populate('user').populate('artwork').execPopulate();

    console.log(`CREATED | ${model} | ID: ${populatedDoc.id} | USER: ${populatedDoc.user.id} | ARTWORK: ${populatedDoc.artwork.id}`)
    console.log({populatedDoc})

    res.json(populatedDoc)
  }
  catch(err){
    console.error(`POST | CREATE | ${model} | USER: ${req.body.user.sub} | ARTWORK: ${req.body.artwork.id} | ERROR: ${err}`)
    res.status(400).send(`POST | CREATE | ${model} | USER: ${req.body.user.sub} | ARTWORK: ${req.body.artwork.id} | ERROR: ${err}`)
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
