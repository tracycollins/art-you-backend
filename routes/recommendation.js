const express = require('express');
const cors = require('cors');
const router = express.Router();

global.artyouDb = require("@threeceelabs/mongoose-artyou");
global.dbConnection = false;

const main = async () => {
  try{
    global.dbConnection = await global.artyouDb.connect();
  }
  catch(err){
    console.error(`AYBE | ROUTE: RECOMMENDATIONS | *** DB CONNECT ERROR: ${err}`)
    throw err;
  }
}

main()
.then(() => {
  console.log(`AYBE | ROUTE: RECOMMENDATIONS | MAIN OK`)
})
.catch((err) => console.error(err))

router.get('/:id', cors(), async (req, res) => {

  const query = {}

  if (req.params.id){
    console.log(`GET RECOMMENDATION | ID: ${req.params.id}`)
    query.id = req.params.id
  }

  const docs = await global.artyouDb.Recommendation.find(query).populate('artwork').populate('user').lean();
  console.log(`FOUND ${docs.length} RECOMMENDATIONS`)

  res.json(docs)

});

module.exports = router;
