const model = "Recommendation";
const express = require("express");
const router = express.Router();

router.get("/user/:id", async (req, res) => {
  try {
    console.log(`GET ${model} | FILTER: USER OAUTHID: ${req.params.id}`);

    const docs = await global.art47db[model].aggregate([
      {
        $lookup: {
          from: "users",
          localField: "user",
          foreignField: "_id",
          as: "user",
        },
      },
      {
        $unwind: {
          path: "$user",
        },
      },
      {
        $match: {
          "user.oauthID": req.params.id,
        },
      },
      {
        $sort: {
          score: -1,
        },
      },
      {
        $limit: 10,
      },
      {
        $lookup: {
          from: "artworks",
          localField: "artwork",
          foreignField: "_id",
          as: "artwork",
        },
      },
      {
        $unwind: {
          path: "$artwork",
        },
      },
    ]);

    console.log(
      `FOUND ${model} BY USER OAUTHID: ${req.params.id} | ${docs.length} ${model}s`
    );

    res.json(docs);
  } catch (err) {
    console.error(`GET | ${model} | OAUTHID: ${req.body.id} ERROR: ${err}`);
    res
      .status(400)
      .send(`GET | ${model} | OAUTHID: ${escape(req.body.id)} | ERROR: ${err}`);
  }
});

router.get("/:id", async (req, res) => {
  const query = {};

  console.log(`GET ${model} | ID: ${req.params.id}`);
  query.id = req.params.id;

  const doc = await global.art47db[model]
    .findOne(query)
    .populate({ path: "artwork", populate: { path: "artist" } })
    .populate("user")
    .lean();
  console.log(`FOUND ${model} | ${doc.id}`);

  res.json(doc);
});

router.get("/", async (req, res) => {
  try {
    console.log(`${model} | GET`);
    const docs = await global.art47db[model]
      .find({})
      .populate("artwork")
      .populate("user")
      .lean();
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
