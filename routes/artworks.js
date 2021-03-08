/* eslint-disable dot-notation */
const model = "Artwork";
const express = require("express");
const router = express.Router();

// get artworks by id, pop with rating and rec by user id
router.get("/:artworkid/user/:userid", async (req, res) => {
  try {
    console.log(
      `${model} | GET ARTWORK BY ID ${req.params.artworkid} | POP RATING/REC BY USER ID: ${req.params.userid}`
    );

    const userDoc = await global.artyouDb.User.findOne({
      id: req.params.userid,
    }).lean();

    console.log(
      `${model} | GET ARTWORK BY ID | USER ID: ${userDoc.name} | ARTWORK ID: ${req.params.artworkid}`
    );

    const query = {};
    query.id = parseInt(req.params.artworkid);

    console.log({ query });

    const artworkDoc = await global.artyouDb.Artwork.findOne(query)
      .populate("image")
      .populate({ path: "artist", populate: { path: "image" } })
      .populate({ path: "ratings", populate: { path: "user" } })
      .populate({ path: "recommendations", populate: { path: "user" } })
      .populate({ path: "tags", populate: { path: "user" } })
      .lean()
      .exec();

    const ratingDoc = await global.artyouDb.Rating.findOne({
      user: userDoc,
      artwork: artworkDoc,
    }).lean();
    const recommendationDoc = await global.artyouDb.Recommendation.findOne({
      user: userDoc,
      artwork: artworkDoc,
    }).lean();

    if (artworkDoc) {
      if (ratingDoc) {
        artworkDoc.ratingUser = ratingDoc;
      }

      if (recommendationDoc) {
        artworkDoc.recommendationUser = recommendationDoc;
      }

      res.json(artworkDoc);
    } else {
      console.log(
        `ARTWORK OR USER NOT FOUND | ARTWORK ID: ${req.params.artworkid} | USER ID: ${req.params.userid}`
      );
      res.json([]);
    }
  } catch (err) {
    console.error(`GET | ${model} | ID: ${req.body.id} ERROR: ${err}`);
    res.status(400).send(`GET | ${model} | ID: ${req.body.id} | ERROR: ${err}`);
  }
});

router.get("/user/:userid", async (req, res) => {
  try {
    console.log(
      `${model} | GET ARTWORKS | POP RATING/REC BY USER ID: ${req.params.userid}`
    );

    const userDoc = await global.artyouDb.User.findOne({
      id: req.params.userid,
    }).lean();
    // console.log({ userDoc });

    const artworkDocs = await global.artyouDb.Artwork.find({})
      .populate("image")
      .populate({ path: "artist", populate: { path: "image" } })
      .populate({ path: "ratings", populate: { path: "user" } })
      .populate({ path: "recommendations", populate: { path: "user" } })
      .populate({ path: "tags", populate: { path: "user" } })
      .lean();

    // const ratingDocs = await global.artyouDb.Rating.find({user: userDoc}).lean()
    // const recommendationDocs = await global.artyouDb.Recommendation.findOne({user: userDoc}).lean()

    const docs = [];

    for (const artworkDoc of artworkDocs) {
      // console.log({artworkDoc})

      if (userDoc) {
        for (const rating of artworkDoc.ratings) {
          // console.log({ rating });
          if (rating.user && rating.user.id === userDoc.id) {
            artworkDoc.ratingUser = rating;
          }
        }

        for (const rec of artworkDoc.recommendations) {
          // console.log({ rec });
          if (rec.user && rec.user.id === userDoc.id) {
            artworkDoc.recommendationUser = rec;
          }
        }
      }

      docs.push(artworkDoc);
    }

    res.json(docs);
  } catch (err) {
    console.error(`GET | ${model} | ID: ${req.body.id} ERROR: ${err}`);
    res.status(400).send(`GET | ${model} | ID: ${req.body.id} | ERROR: ${err}`);
  }
});

router.get("/:id", async (req, res) => {
  const query = {};

  console.log(`GET ${model} | ID: ${req.params.id}`);
  query.id = parseInt(req.params.id);

  console.log({ query });

  const doc = await global.artyouDb.Artwork.findOne(query)
    .populate("image")
    .populate({ path: "artist", populate: { path: "image" } })
    .populate({ path: "ratings", populate: { path: "user" } })
    .populate({ path: "recommendations", populate: { path: "user" } })
    .populate({ path: "tags", populate: { path: "user" } })
    .lean();

  console.log(
    `FOUND ${model} | ${doc.id} | ${doc.artist.displayName} | ${doc.image.url}`
  );

  res.json(doc);
});

// get artworks by artist
router.get("/artist/:id", async (req, res) => {
  try {
    console.log(`${model} | GET ARTWORK BY ARTIST ${req.params.id}`);

    const artistDoc = await global.artyouDb[model].findOne({
      id: req.params.id,
    });

    if (artistDoc) {
      const docs = await global.artyouDb.Artwork.find({
        artist: artistDoc,
      })
        .populate("image")
        .populate({ path: "artist", populate: { path: "image" } })
        .populate({ path: "ratings", populate: { path: "user" } })
        .populate({ path: "recommendations", populate: { path: "user" } })
        .populate({ path: "tags", populate: { path: "user" } })
        .lean();

      console.log(`FOUND ${docs.length} ${model}s`);
      res.json(docs);
    } else {
      console.log(`ARTIST NOT FOUND | ARTIST ID: ${req.params.id}`);
      res.json([]);
    }
  } catch (err) {
    console.error(`GET | ${model} | ID: ${req.body.id} ERROR: ${err}`);
    res.status(400).send(`GET | ${model} | ID: ${req.body.id} | ERROR: ${err}`);
  }
});

router.get("/", async (req, res) => {
  try {
    console.log(`${model} | GET`);

    const docs = await global.artyouDb[model]
      .find({})
      .populate("image")
      .populate({ path: "artist", populate: { path: "image" } })
      .populate({ path: "ratings", populate: { path: "user" } })
      .populate({ path: "recommendations", populate: { path: "user" } })
      .populate({ path: "tags", populate: { path: "user" } })
      .lean();

    console.log(`FOUND ${docs.length} ${model}s`);
    res.json(docs);
  } catch (err) {
    console.error(`GET | ${model} | ID: ${req.body.id} ERROR: ${err}`);
    res.status(400).send(`GET | ${model} | ID: ${req.body.id} | ERROR: ${err}`);
  }
});

module.exports = router;
