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
    console.error(`AYBE | ROUTE: ARTWORKS | *** DB CONNECT ERROR: ${err}`)
    throw err;
  }
}

main()
.then(() => {
  console.log(`AYBE | ROUTE: ARTWORKS | MAIN OK`)
})
.catch((err) => console.error(err))

router.get('/', cors(), async (req, res) => {
  const artworkArray = await global.artyouDb.Artwork.find({}).lean();
  console.log(`FOUND ${artworkArray.length} ARTWORKS`)
  res.json(artworkArray)
});

module.exports = router;
