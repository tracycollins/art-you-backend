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
    console.error(`AYBE | ROUTE: USERS | *** DB CONNECT ERROR: ${err}`)
    throw err;
  }
}

main()
.then(() => {
  console.log(`AYBE | ROUTE: USERS | MAIN OK`)
})
.catch((err) => console.error(err))

router.get('/', cors(), async (req, res) => {
  const userArray = await global.artyouDb.User.find({}).lean();
  console.log(`FOUND ${userArray.length} USERS`)
  res.json(userArray)
});

module.exports = router;
