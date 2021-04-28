const express = require("express");
const router = express.Router();

const model = "NetworkInput";

router.get("/", async (req, res) => {
  try {
    console.log(`${model} | GET`);
    const docs = await global.art47db[model].find({}).lean();
    console.log(`FOUND ${docs.length} ${model}s`);
    res.json(docs);
  } catch (err) {
    console.error(`GET | ${model} | ID: ${req.body.id} ERROR: ${err}`);
    res
      .status(400)
      .send(`GET | ${model} | ID: ${escape(req.body.id)} | ERROR: ${err}`);
  }
});

module.exports = router;
