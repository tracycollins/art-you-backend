/* eslint-disable no-underscore-dangle */
/* eslint-disable dot-notation */
const express = require("express");
const ObjectID = require("mongodb").ObjectID;
const escape = require("escape-html");
const router = express.Router({
  strict: true,
});

router.get("/cursor/:cursor/", async (req, res) => {
  try {
    console.log(`URL: ${req.url} | PARAMS:`, req.params);
    const cursor = req.params.cursor || 0;
    const limit = 20;
    console.log(`ARTWORKS | GET CURSOR: ${cursor} | LIMIT: ${limit}`);

    const docs = await global.art47db.Artwork.find({ id: { $gt: cursor } })
      .sort()
      .limit(limit)
      .populate("image")
      .populate({ path: "artist", populate: { path: "image" } })
      .populate({ path: "ratings", populate: { path: "user" } })
      .populate({ path: "recommendations", populate: { path: "user" } })
      .populate({ path: "tags", populate: { path: "user" } })
      .lean();

    console.log(`ARTWORKS | GET | ${docs.length} ARTWORKS | LIMIT: ${limit}`);

    res.json(docs);
  } catch (err) {
    const message = `GET | ARTWORKS | ID: ${req.body.id} | USER ID: ${escape(
      req.params.userid
    )} | CURSOR: ${req.params.cursor} | ERROR: ${err}`;
    console.error(message);
    res.status(400).send(message);
  }
});

router.get(
  "/user/:userid/cursor/:cursorid/(:subdoc)?(.:sort.:value)?",
  async (req, res) => {
    try {
      const userDoc = req.params.userid
        ? await global.art47db.User.findOne({
            id: req.params.userid,
          }).select("_id")
        : false;

      const user_id = userDoc ? userDoc._id.toString() : false;
      const cursorid = req.params.cursorid !== "0" ? req.params.cursorid : null;
      const subDoc = req.params.subdoc || "none"; // rating, recommendation, unrated
      const sort = req.params.sort || "none"; // name of field :'rate', 'score'
      const value = req.params.value || false; // field value: rate, score, ratingAverage
      const limit = process.env.PAGE_SIZE || 20;

      if (subDoc === "unrated") {
        if (user_id !== 0) {
          console.log(`GET | UNRATED | FOUND USER | _ID: ${user_id}`);
        }
      }

      console.log(
        `GET Artwork | URL: ${req.url} | CURSOR | SORT (subDoc): ${subDoc}` +
          ` | FILTER BY USER _ID: ${user_id}` +
          ` | CURSOR_ID: _id: ${cursorid} | value: ${value}`
      );

      const sortByOptions = {
        user_id,
        subDoc,
        limit,
        sort,
        minDocId: cursorid,
        maxDocId: cursorid,
        minValue: value,
        maxValue: value,
      };

      const artworks = await global.art47db.sortBySubDocUserPaginate(
        sortByOptions
      );

      let nextKey = {};

      if (artworks.length < limit) {
        console.log(
          // eslint-disable-next-line no-underscore-dangle
          `XXX END XXXX | FOUND Artwork BY USER _ID: ${user_id}` +
            ` | SUBDOC: ${subDoc}` +
            ` | ${artworks.length} ARTWORKs`
        );
        res.json({ artworks: artworks });
      } else {
        const lastArtwork = artworks[artworks.length - 1];
        switch (subDoc) {
          case "rating":
            nextKey.id = lastArtwork.ratingUser.id;
            break;
          case "recommendation":
            nextKey.id = lastArtwork.recommendationUser.id;
            break;
          default:
            nextKey.id = lastArtwork.id;
        }
        nextKey.rate = lastArtwork.ratingUser
          ? lastArtwork.ratingUser.rate
          : null;
        nextKey.score = lastArtwork.recommendationUser
          ? lastArtwork.recommendationUser.score
          : null;
        nextKey.ratingAverage = lastArtwork.ratingAverage;
        console.log(
          `FOUND Artwork BY USER _ID: ${user_id}` +
            ` | SUBDOC: ${subDoc}` +
            ` | NEXT ID: ${nextKey.id}` +
            ` | NEXT RATE: ${nextKey.rate} ` +
            ` | NEXT SCORE: ${nextKey.score}` +
            ` | ${artworks.length} ARTWORKs`
        );
        res.json({ artworks: artworks, nextKey: nextKey });
      }

      //
    } catch (err) {
      console.error(
        `GET | Artwork | OAUTHID: ${escape(req.params.userid)} ERROR: ${err}`
      );
      res
        .status(400)
        .send(
          `GET | Artwork | OAUTHID: ${escape(
            req.params.userid
          )} | ERROR: ${err}`
        );
    }
  }
);

router.get("/user/:userid/id/:artworkId/", async (req, res) => {
  try {
    const userDoc =
      req.params.userid !== "0"
        ? await global.art47db.User.findOne({
            id: req.params.userid,
          }).select("_id")
        : false;

    const user_id = userDoc ? userDoc._id.toString() : false;
    const artworkId = req.params.artworkId || false;

    console.log(
      `GET Artwork | URL: ${req.url}` +
        ` | USER _ID: ${user_id}` +
        ` | ARTWORK ID: ${artworkId}`
    );

    // docs can be ratings or recommendations
    const artwork = await global.art47db.Artwork.findOne({ id: artworkId })
      .populate("image")
      .populate({ path: "artist", populate: { path: "image" } })
      .populate({ path: "ratings", populate: { path: "user" } })
      .populate({ path: "recommendations", populate: { path: "user" } })
      .populate({ path: "tags", populate: { path: "user" } })
      .lean();

    const ratingDoc = await global.art47db.Rating.findOne({
      user: userDoc,
      artwork: artwork,
    }).lean();
    const recommendationDoc = await global.art47db.Recommendation.findOne({
      user: userDoc,
      artwork: artwork,
    }).lean();

    if (artwork) {
      if (ratingDoc) {
        artwork.ratingUser = ratingDoc;
      }

      if (recommendationDoc) {
        artwork.recommendationUser = recommendationDoc;
      }

      console.log(
        `FOUND ARTWORK BY ID` +
          ` | ID: ${artwork.id}` +
          ` | _ID: ${artwork._id}` +
          ` | ${artwork.ratings.length} RATINGS` +
          ` | RATING USER: ${
            artwork.ratingUser ? artwork.ratingUser.user.name : "none"
          }` +
          ` | REC USER: ${
            artwork.recommendationUser
              ? artwork.recommendationUser.user.id
              : "none"
          }`
      );
      res.json({ artwork });
    } else {
      console.log(
        `ARTWORK OR USER NOT FOUND | ARTWORK ID: ${
          req.params.artworkid
        } | USER ID: ${escape(req.params.userid)}`
      );
      res.json();
    }
  } catch (err) {
    console.error(
      `GET | Artwork | OAUTHID: ${escape(req.params.userid)} ERROR: ${err}`
    );
    res
      .status(400)
      .send(
        `GET | Artwork | OAUTHID: ${escape(req.params.userid)} | ERROR: ${err}`
      );
  }
});

router.get("/user/:userid/recs/top/(:unrated)?", async (req, res) => {
  try {
    const limit = process.env.UNRATED_LIMIT || 9;

    console.log(
      `GET Artwork | USER TOP RECS | USER ID: ${escape(
        req.params.userid
      )} | UNRATED FLAG: ${req.params.unrated} | LIMIT: ${limit}`
    );

    const user = req.params.userid
      ? await global.art47db.User.findOne({
          id: req.params.userid,
        })
          .populate({ path: "artist", populate: { path: "image" } })
          .select("_id unrated")
          .lean()
      : false;

    if (!user) {
      console.log(
        `GET Artwork | !!! USER TOP UNRATED RECS | USER ID: ${escape(
          req.params.userid
        )} NOT FOUND`
      );
      return res.status(404);
    }

    console.log(
      `GET Artwork | USER TOP UNRATED RECS | USER ID: ${
        req.params.userid
      } | UNRATED: ${user.unrated ? user.unrated.length : 0}`
    );

    if (user.unrated && user.unrated.length === 0) {
      console.log(
        `GET Artwork | --- USER TOP UNRATED RECS | USER ID: ${escape(
          req.params.userid
        )} | NO UNRATED FOUND`
      );
      return res.json({ artworks: [] });
    }

    const sortByOptions = {
      user_id: user._id,
      subDoc: "unrated",
      sort: "top",
      limit,
    };

    const artworks = await global.art47db.sortBySubDocUserPaginate(
      sortByOptions
    );

    res.json({ artworks });
  } catch (err) {
    console.error(`GET | Artwork | OAUTHID: ${req.body.id} ERROR: ${err}`);
    res
      .status(400)
      .send(`GET | Artwork | OAUTHID: ${escape(req.body.id)} | ERROR: ${err}`);
  }
});

router.get("/:artworkid/user/:userid", async (req, res) => {
  try {
    console.log(
      `Artwork | GET ARTWORK BY ID ${
        req.params.artworkid
      } | POP RATING/REC BY USER ID: ${escape(req.params.userid)}`
    );

    const userDoc = await global.art47db.User.findOne({
      id: req.params.userid,
    }).lean();

    console.log(
      `Artwork | GET ARTWORK BY ID | USER ID: ${userDoc.name} | ARTWORK ID: ${req.params.artworkid}`
    );

    const query = {};
    query.id = parseInt(req.params.artworkid);

    const artworkDoc = await global.art47db.Artwork.findOne(query)
      .populate("image")
      .populate({ path: "artist", populate: { path: "image" } })
      .populate({ path: "ratings", populate: { path: "user" } })
      .populate({ path: "recommendations", populate: { path: "user" } })
      .populate({ path: "tags", populate: { path: "user" } })
      .lean()
      .exec();

    const ratingDoc = await global.art47db.Rating.findOne({
      user: userDoc,
      artwork: artworkDoc,
    }).lean();
    const recommendationDoc = await global.art47db.Recommendation.findOne({
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
        `ARTWORK OR USER NOT FOUND | ARTWORK ID: ${
          req.params.artworkid
        } | USER ID: ${escape(req.params.userid)}`
      );
      res.json([]);
    }
  } catch (err) {
    console.error(`GET | Artwork | ID: ${req.body.id} ERROR: ${err}`);
    res
      .status(400)
      .send(`GET | Artwork | ID: ${escape(req.body.id)} | ERROR: ${err}`);
  }
});

router.get("/user/:userid", async (req, res) => {
  try {
    console.log(
      `Artwork | GET ARTWORKS | POP RATING/REC BY USER ID: ${escape(
        req.params.userid
      )}`
    );

    const userDoc = await global.art47db.User.findOne({
      id: req.params.userid,
    }).lean();

    const artworkDocs = await global.art47db.Artwork.find({})
      .populate("image")
      .populate({ path: "artist", populate: { path: "image" } })
      .populate({ path: "ratings", populate: { path: "user" } })
      .populate({ path: "recommendations", populate: { path: "user" } })
      .populate({ path: "tags", populate: { path: "user" } })
      .lean();

    const docs = [];

    for (const artworkDoc of artworkDocs) {
      if (userDoc) {
        for (const rating of artworkDoc.ratings) {
          if (rating.user && rating.user.id === userDoc.id) {
            artworkDoc.ratingUser = rating;
          }
        }

        for (const rec of artworkDoc.recommendations) {
          if (rec.user && rec.user.id === userDoc.id) {
            artworkDoc.recommendationUser = rec;
          }
        }
      }

      docs.push(artworkDoc);
    }

    res.json(docs);
  } catch (err) {
    console.error(`GET | Artwork | ID: ${req.body.id} ERROR: ${err}`);
    res
      .status(400)
      .send(`GET | Artwork | ID: ${escape(req.body.id)} | ERROR: ${err}`);
  }
});

router.get("/:id", async (req, res) => {
  const query = {};

  console.log(`GET Artwork | ID: ${req.params.id}`);
  query.id = parseInt(req.params.id);

  const doc = await global.art47db.Artwork.findOne(query)
    .populate("image")
    .populate({ path: "artist", populate: { path: "image" } })
    .populate({ path: "ratings", populate: { path: "user" } })
    .populate({ path: "recommendations", populate: { path: "user" } })
    .populate({ path: "tags", populate: { path: "user" } })
    .lean();

  console.log(
    `FOUND Artwork | ${doc.id} | ${doc.artist.displayName} | ${doc.image.url}`
  );

  res.json(doc);
});

// get artworks by artist
router.get("/artist/:id", async (req, res) => {
  try {
    console.log(`Artwork | GET ARTWORK BY ARTIST ${req.params.id}`);

    const artistDoc = await global.art47db.Artwork.findOne({
      id: req.params.id,
    });

    if (artistDoc) {
      const docs = await global.art47db.Artwork.find({
        artist: artistDoc,
      })
        .populate("image")
        .populate({ path: "artist", populate: { path: "image" } })
        .populate({ path: "ratings", populate: { path: "user" } })
        .populate({ path: "recommendations", populate: { path: "user" } })
        .populate({ path: "tags", populate: { path: "user" } })
        .lean();

      console.log(`FOUND ${docs.length} Artworks`);
      res.json(docs);
    } else {
      console.log(`ARTIST NOT FOUND | ARTIST ID: ${req.params.id}`);
      res.json([]);
    }
  } catch (err) {
    console.error(`GET | Artwork | ID: ${req.body.id} ERROR: ${err}`);
    res
      .status(400)
      .send(`GET | Artwork | ID: ${escape(req.body.id)} | ERROR: ${err}`);
  }
});

router.get("/", async (req, res) => {
  try {
    console.log(`Artwork | GET`);

    const docs = await global.art47db.Artwork.find({})
      .populate("image")
      .populate({ path: "artist", populate: { path: "image" } })
      .populate({ path: "ratings", populate: { path: "user" } })
      .populate({ path: "recommendations", populate: { path: "user" } })
      .populate({ path: "tags", populate: { path: "user" } })
      .lean();

    console.log(`FOUND ${docs.length} Artworks`);
    res.json(docs);
  } catch (err) {
    console.error(`GET | Artwork | ID: ${req.body.id} ERROR: ${err}`);
    res
      .status(400)
      .send(`GET | Artwork | ID: ${escape(req.body.id)} | ERROR: ${err}`);
  }
});

module.exports = router;
