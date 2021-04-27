const express = require("express");
const cors = require("cors");
const router = express.Router();

global.art47db = require("@threeceelabs/mongoose-art47");
global.dbConnection = false;

const main = async () => {
  try {
    global.dbConnection = await global.art47db.connect();
  } catch (err) {
    console.error(`AYBE | ROUTE: TAGS | *** DB CONNECT ERROR: ${err}`);
    throw err;
  }
};

main()
  .then(() => {
    console.log(`AYBE | ROUTE: TAGS | MAIN OK`);
  })
  .catch((err) => console.error(err));

router.get("/:id", cors(), async (req, res) => {
  const query = {};

  if (req.params.id) {
    console.log(`GET TAG | ID: ${req.params.id}`);
    query.id = req.params.id;
  }

  const docs = await global.art47db.Artist.find(query).lean();
  console.log(`FOUND ${docs.length} TAGS`);

  res.json(docs);
});

module.exports = router;
