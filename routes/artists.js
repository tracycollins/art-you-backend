const model = "Artist";
const express = require("express");
const router = express.Router();

router.get("/cursor/:cursor", async (req, res) => {
  try {
    console.log(`URL: ${req.url} | PARAMS:`, req.params);
    const cursor = req.params.cursor || 0;
    const limit = 20;
    console.log(`ARTISTS | GET CURSOR: ${cursor} | LIMIT: ${limit}`);

    const docs = await global.artyouDb.Artist.find({ id: { $gt: cursor } })
      .sort()
      .limit(limit)
      .populate("image")
      .populate({ path: "artist", populate: { path: "image" } })
      .populate({ path: "ratings", populate: { path: "user" } })
      .populate({ path: "recommendations", populate: { path: "user" } })
      .populate({ path: "tags", populate: { path: "user" } })
      .lean();

    console.log(`ARTISTS | GET | ${docs.length} | LIMIT: ${limit}`);

    res.json(docs);
  } catch (err) {
    const message = `GET | ARTISTS | ID: ${req.body.id} | USER ID: ${req.params.userid} | CURSOR: ${req.params.cursor} | ERROR: ${err}`;
    console.error(message);
    res.status(400).send(message);
  }
});

router.get("/:id", async (req, res) => {
  const query = {};

  console.log(`GET ${model} | ID: ${req.params.id}`);
  query.id = req.params.id;

  const doc = await global.artyouDb[model]
    .findOne(query)
    .populate("image")
    .populate("tags")
    .lean();
  console.log(`FOUND ${model} | ${doc.id}`);

  res.json(doc);
});

router.get("/", async (req, res) => {
  try {
    console.log(`${model} | GET`);
    const docs = await global.artyouDb[model]
      .find({})
      .populate("image")
      .populate("tags")
      .lean();
    console.log(`FOUND ${docs.length} ${model}s`);
    res.json(docs);
  } catch (err) {
    console.error(`GET | ${model} | ID: ${req.body.id} ERROR: ${err}`);
    res.status(400).send(`GET | ${model} | ID: ${req.body.id} | ERROR: ${err}`);
  }
});

module.exports = router;
