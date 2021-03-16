/* eslint-disable dot-notation */
const model = "Artwork";
const express = require("express");
const router = express.Router();

// get artworks by id, pop with rating and rec by user id

router.get("/cursor/:cursor", async (req, res) => {
  try {
    console.log(`URL: ${req.url} | PARAMS:`, req.params);
    const cursor = req.params.cursor || 0;
    const limit = 20;
    console.log(`ARTWORKS | GET CURSOR: ${cursor} | LIMIT: ${limit}`);

    const docs = await global.artyouDb.Artwork.find({ id: { $gt: cursor } })
      .sort()
      .limit(limit)
      .populate("image")
      .populate({ path: "artist", populate: { path: "image" } })
      .populate({ path: "ratings", populate: { path: "user" } })
      .populate({ path: "recommendations", populate: { path: "user" } })
      .populate({ path: "tags", populate: { path: "user" } })
      .lean();

    // const nextCursor = docs.length < limit ? 0 : docs[limit - 1].id;

    console.log(`ARTWORKS | GET | ${docs.length} | LIMIT: ${limit}`);

    res.json(docs);
  } catch (err) {
    const message = `GET | ARTWORKS | ID: ${req.body.id} | USER ID: ${req.params.userid} | CURSOR: ${req.params.cursor} | ERROR: ${err}`;
    console.error(message);
    res.status(400).send(message);
  }
});

router.get("/user/:userid/cursor/:cursor", async (req, res) => {
  try {
    console.log(`URL: ${req.url} | PARAMS:`, req.params);
    const userid = req.params.userid || 0;
    const cursor = req.params.cursor || 0;
    const limit = 20;
    console.log(
      `ARTWORKS | GET USER CURSOR | USER: ${req.params.userid} CURSOR: ${cursor} | LIMIT: ${limit}`
    );

    const docs = await global.artyouDb.Artwork.find({ id: { $gt: cursor } })
      .sort()
      .limit(limit)
      .populate("image")
      .populate({ path: "artist", populate: { path: "image" } })
      .populate({ path: "ratings", populate: { path: "user" } })
      .populate({ path: "recommendations", populate: { path: "user" } })
      .populate({ path: "tags", populate: { path: "user" } })
      .lean();

    const artworks = docs.map((artwork) => {
      artwork.ratingUser = artwork.ratings.find(
        (rating) => rating.user.id === userid
      );
      artwork.recommendationUser = artwork.recommendations.find(
        (rec) => rec.user.id === userid
      );
      return artwork;
    });

    console.log(`ARTWORKS | GET | ${artworks.length} | LIMIT: ${limit}`);

    res.json(artworks);
  } catch (err) {
    const message = `GET | ARTWORKS | ID: ${req.body.id} | USER ID: ${req.params.userid} | CURSOR: ${req.params.cursor} | ERROR: ${err}`;
    console.error(message);
    res.status(400).send(message);
  }
});

router.get("/top-rated/user/:userid", async (req, res) => {
  try {
    const userid = req.params.userid || 0;

    console.log(
      `GET ${model} | TOP 10 RATED | FILTER BY USER OAUTHID: ${userid}`
    );

    const ratings = await global.artyouDb.Rating.aggregate([
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
          "user.oauthID": userid,
        },
      },
      {
        $sort: {
          rate: -1,
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
      {
        $lookup: {
          from: "images",
          localField: "artwork.image",
          foreignField: "_id",
          as: "artwork.image",
        },
      },
      {
        $unwind: {
          path: "$artwork.image",
        },
      },
      {
        $lookup: {
          from: "recommendations",
          localField: "artwork.recommendations",
          foreignField: "_id",
          as: "artwork.recommendations",
        },
      },
    ]);

    console.log(
      `FOUND ${model} BY USER OAUTHID: ${userid} | TOP ${ratings.length} RATINGs`
    );

    const artworks = ratings.map((rating) => {
      const art = Object.assign({}, rating.artwork);
      art.ratingUser = { rate: rating.rate };
      art.recommendationUser = art.recommendations.find(
        (rec) => rec.user.id === userid
      );
      return art;
    });

    res.json(artworks);
  } catch (err) {
    console.error(`GET | ${model} | OAUTHID: ${req.body.id} ERROR: ${err}`);
    res
      .status(400)
      .send(`GET | ${model} | OAUTHID: ${req.body.id} | ERROR: ${err}`);
  }
});

router.get("/unrated/user/:id", async (req, res) => {
  try {
    console.log(
      `GET ${model} | UNRATED | FILTER BY USER OAUTHID: ${req.params.id}`
    );

    const artworks = await global.artyouDb.Artwork.aggregate([
      {
        $lookup: {
          from: "ratings",
          localField: "ratings",
          foreignField: "_id",
          as: "ratings",
        },
      },
      {
        $lookup: {
          from: "users",
          localField: "ratings.user",
          foreignField: "_id",
          as: "users",
        },
      },
      {
        $match: {
          "users.id": {
            $ne: req.params.id,
          },
        },
      },
      {
        $sort: {
          id: 1,
        },
      },
      {
        $limit: 20,
      },
      {
        $lookup: {
          from: "images",
          localField: "image",
          foreignField: "_id",
          as: "image",
        },
      },
      {
        $unwind: {
          path: "$image",
        },
      },
    ]);

    console.log(
      `FOUND ${model} BY USER OAUTHID: ${req.params.id} | ${artworks.length} UNRATED ARTWORKS`
    );

    res.json(artworks);
  } catch (err) {
    console.error(`GET | ${model} | OAUTHID: ${req.body.id} ERROR: ${err}`);
    res
      .status(400)
      .send(`GET | ${model} | OAUTHID: ${req.body.id} | ERROR: ${err}`);
  }
});

router.get("/top-recs/user/:id", async (req, res) => {
  try {
    console.log(
      `GET ${model} | TOP 10 RECS | FILTER BY USER OAUTHID: ${req.params.id}`
    );

    const recs = await global.artyouDb.Recommendation.aggregate([
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
      {
        $lookup: {
          from: "images",
          localField: "artwork.image",
          foreignField: "_id",
          as: "artwork.image",
        },
      },
      {
        $unwind: {
          path: "$artwork.image",
        },
      },
    ]);

    console.log(
      `FOUND ${model} BY USER OAUTHID: ${req.params.id} | TOP ${recs.length} RECs`
    );

    const artworks = recs.map((rec) => {
      const art = Object.assign({}, rec.artwork);
      art.recommendationUser = { score: rec.score };
      return art;
    });

    res.json(artworks);
  } catch (err) {
    console.error(`GET | ${model} | OAUTHID: ${req.body.id} ERROR: ${err}`);
    res
      .status(400)
      .send(`GET | ${model} | OAUTHID: ${req.body.id} | ERROR: ${err}`);
  }
});

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
