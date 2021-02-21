const express = require('express');
const router = express.Router();

global.artyouDb = require("@threeceelabs/mongoose-artyou");
global.dbConnection = false;

const main = async () => {

  try{
    global.dbConnection = await global.artyouDb.connect();
    
    router.get('/:id', async (req, res) => {

      const query = {}

      if (req.params.id){
        console.log(`GET ARTIST | ID: ${req.params.id}`)
        query.id = req.params.id
      }

      const docs = await global.artyouDb.Artist.find(query).populate('artist').populate('tags').lean();
      console.log(`FOUND ${docs.length} ARTIST`)

      res.json(docs)
      
    });

  }
  catch(err){
    console.error(`AYBE | ROUTE: ARTISTS | *** DB CONNECT ERROR: ${err}`)
    throw err;
  }
}

main()
.then(() => {
  console.log(`AYBE | ROUTE: ARTISTS | MAIN OK`)
})
.catch((err) => console.error(err))

module.exports = router;
