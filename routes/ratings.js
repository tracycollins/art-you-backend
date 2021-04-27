/* eslint-disable no-underscore-dangle */
// const REDIS_URL = process.env.REDIS_URL || "redis://127.0.0.1:6379";

const model = "Rating";
const express = require("express");
const router = express.Router();
// const Queue = require("bull");
const NeuralNetworkTools = require("../lib/nnTools.js");
const nnt = new NeuralNetworkTools("NTR");

nnt.on("ready", async (appName) => {
  console.log(`NTR | RATINGS | READY | APP NAME: ${appName}`);
});

nnt.on("connect", async (appName) => {
  console.log(`NTR | RATINGS | DB CONNECTED | APP NAME: ${appName}`);
});

// const workUpdateRecommendationsQueue = new Queue(
//   "updateRecommendations",
//   REDIS_URL
// );

// const triggerNetworkFitRatingsUpdateNumber = 10;

// const userRatingUpdateCounterHashmap = {};
// let nntUpdateRecommendationsReady = true;

// const updateUserRatingCount = async (user) => {
//   userRatingUpdateCounterHashmap[user.id] = userRatingUpdateCounterHashmap[
//     user.id
//   ]
//     ? (userRatingUpdateCounterHashmap[user.id] += 1)
//     : (userRatingUpdateCounterHashmap[user.id] = 1);

//   if (
//     nntUpdateRecommendationsReady &&
//     userRatingUpdateCounterHashmap[user.id] >=
//       triggerNetworkFitRatingsUpdateNumber
//   ) {
//     try {
//       nntUpdateRecommendationsReady = false;
//       const epochs = process.env.ART47_NN_FIT_EPOCHS || 1000;

//       console.log(
//         `NTR | ADDING JOB TO WORKER QUEUE | UPDATE_RECS | OAUTH ID: ${user.id} | ${epochs} EPOCHS`
//       );

//       const jobUpdateRecs = await workUpdateRecommendationsQueue.add({
//         op: "UPDATE_RECS",
//         oauthID: user.id,
//         epochs: epochs,
//       });

//       console.log(`NTR | JOB ADDED`);
//       console.log({ jobUpdateRecs });

//       userRatingUpdateCounterHashmap[user.id] = 0;
//       nntUpdateRecommendationsReady = true;
//     } catch (err) {
//       nntUpdateRecommendationsReady = true;
//       console.log(
//         `NTR | RATINGS | *** updateRecommendationsChild ERROR: ${err}`
//       );
//     }
//   }
//   return userRatingUpdateCounterHashmap[user.id];
// };

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
    ]);

    console.log(
      `FOUND ${model} BY USER OAUTHID: ${req.params.id} | ${docs.length} RATINGS`
    );

    res.json(docs);
  } catch (err) {
    console.error(`GET | ${model} | OAUTHID: ${req.body.id} ERROR: ${err}`);
    res
      .status(400)
      .send(`GET | ${model} | OAUTHID: ${req.body.id} | ERROR: ${err}`);
  }
});

router.get("/:id", async (req, res) => {
  try {
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
  } catch (err) {
    console.error(`GET | ${model} | ID: ${req.body.id} ERROR: ${err}`);
    res.status(400).send(`GET | ${model} | ID: ${req.body.id} | ERROR: ${err}`);
  }
});

router.post("/create", async (req, res) => {
  try {
    console.log(
      `${model} | POST | CREATE ${model} | USER: ${
        req.body.user.id || req.body.user.sub
      } | ARTWORK ID: ${req.body.artwork.id} | RATE: ${req.body.rate}`
    );

    const dbUser = await global.art47db.User.findOne({
      _id: req.body.user._id,
    });

    if (!dbUser) {
      console.log(`*** CREATE ERROR | Rating | USER ID ${dbUser.id} NOT FOUND`);
      throw new Error(
        `*** CREATE ERROR | Rating | USER ID ${dbUser.id} NOT FOUND`
      );
    }

    console.log(
      `--> FOUND USER | USER ID ${dbUser.id} _ID: ${dbUser._id} NAME: ${dbUser.name}`
    );

    const dbArtwork = await global.art47db.Artwork.findOne({
      id: req.body.artwork.id,
    });

    if (!dbArtwork) {
      console.log(
        `*** CREATE ERROR | Rating | ARTWORK ID ${req.body.artwork.id} NOT FOUND`
      );
      throw new Error(
        `*** CREATE ERROR | Rating | ARTWORK ID ${req.body.artwork.id} NOT FOUND`
      );
    }

    const ratingObj = {
      user: dbUser,
      artwork: dbArtwork,
      rate: parseFloat(req.body.rate),
    };

    let ratingDoc = await global.art47db.Rating.findOne({
      user: dbUser,
      artwork: dbArtwork,
    })
      .populate({ path: "artwork", populate: { path: "artist" } })
      .populate("user");

    if (!ratingDoc) {
      console.log(
        `==> NEW | Rating | | RATE: ${ratingObj.rate} | USER: ${dbUser.id} | ARTWORK: ${dbArtwork.id}`
      );
      ratingDoc = new global.art47db.Rating(ratingObj)
        .populate({ path: "artwork", populate: { path: "artist" } })
        .populate("user");
      console.log(
        `NEW | Rating | ID: ${ratingDoc.id} | RATE: ${ratingDoc.rate} | USER: ${dbUser.id} | ARTWORK: ${dbArtwork.id}`
      );
    } else {
      ratingDoc.rate = ratingObj.rate;
      console.log(
        `^^^ UPDATE | Rating | ID: ${ratingDoc.id} | RATE: ${ratingDoc.rate} | USER: ${dbUser.id} | ARTWORK: ${dbArtwork.id}`
      );
    }

    await ratingDoc.save();
    const ratingUpdated = await global.art47db.Rating.findOne({
      _id: ratingDoc._id,
    });

    dbUser.unrated.pull(dbArtwork._id);
    await dbUser.save();

    dbArtwork.updateOne();
    // eslint-disable-next-line no-underscore-dangle
    dbArtwork.ratings.addToSet(ratingUpdated._id);

    await dbArtwork.save();

    console.log(
      `SAVED | Rating` +
        ` | ID: ${ratingDoc.id}` +
        ` | _ID: ${ratingDoc._id.toString()}` +
        ` | RATE: ${ratingDoc.rate}` +
        ` | USER: ${dbUser.id}` +
        ` | ARTWORK: ${dbArtwork.id}`
    );

    const user = dbUser.toObject();
    const rating = ratingDoc.toObject();
    const artwork = dbArtwork.toObject();
    artwork.ratingUser = rating;

    res.json({ user, rating, artwork });
  } catch (err) {
    console.error(
      `POST | CREATE | ${model} | USER: ${req.body.user.sub} | ARTWORK: ${req.body.artwork.id} | ERROR: ${err}`
    );
    res
      .status(400)
      .send(
        `POST | CREATE | ${model} | USER: ${req.body.user.sub} | ARTWORK: ${req.body.artwork.id} | ERROR: ${err}`
      );
  }
});

router.post("/update", async (req, res) => {
  try {
    console.log(
      `${model}` +
        ` | POST` +
        ` | UPDATE ${model}` +
        ` | ID: ${req.body.id}` +
        ` | USER: ${req.user.email}` +
        ` | ARTWORK: ${req.artwork.id}` +
        ` | RATE: ${req.body.rate}`
    );

    const ratingDoc = await global.art47db[model]
      .findOne({ id: req.body.id })
      .populate({ path: "artwork", populate: { path: "artist" } })
      .populate("user");
    ratingDoc.rate = req.body.rate;
    await ratingDoc.save();

    // updateUserRatingCount(ratingDoc.user);

    console.log(
      `UPDATED | Rating` +
        ` | ID: ${ratingDoc.id}` +
        ` | RATE: ${ratingDoc.rate}` +
        ` | USER: ${ratingDoc.user.id}` +
        ` | ARTIST: ${ratingDoc.artist.name}` +
        ` | ARTWORK: ${ratingDoc.artwork.id}`
    );
    res.json(ratingDoc);
  } catch (err) {
    console.error(
      `POST | UPDATE | ${model} | ID: ${req.body.id} ERROR: ${err}`
    );
    res.status(400).send(`GET | ${model} | ID: ${req.body.id} | ERROR: ${err}`);
  }
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
    res.status(400).send(`GET | ${model} | ID: ${req.body.id} | ERROR: ${err}`);
  }
});

module.exports = router;
