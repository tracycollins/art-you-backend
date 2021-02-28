const model = "Rating";
const express = require("express");
const router = express.Router();

const findOneAndUpdateOptions = {
  new: true,
  upsert: true,
};

const convertOathUser = async (oathUser) => {
  const oathType = oathUser.sub.split("|")[0];
  const user = Object.assign({}, oathUser);

  switch (oathType) {
    case "google-oauth2":
      user.id = oathUser.sub;
      user.oauthID = oathUser.sub;
      user.firstName = oathUser.given_name;
      user.lastName = oathUser.family_name;
      user.image = new global.artyouDb.Image({
        id: oathUser.sub,
        url: oathUser.picture,
        title: oathUser.name,
      });
      break;

    case "twitter":
      user.id = oathUser.sub;
      user.oauthID = oathUser.sub;
      user.firstName = oathUser.given_name;
      user.lastName = oathUser.family_name;
      user.image = new global.artyouDb.Image({
        id: oathUser.sub,
        url: oathUser.picture,
        title: oathUser.name,
      });
      break;

    default:
  }

  return user;
};

router.get("/:id", async (req, res) => {
  try {
    const query = {};

    console.log(`GET ${model} | ID: ${req.params.id}`);
    query.id = req.params.id;

    const doc = await global.artyouDb[model]
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
  //
  // KLUDGE: definitely a better way to update/create ratings wrt updating the artwork in db
  //

  try {
    // console.log(req.body);
    console.log(
      `${model} | POST | CREATE ${model} | USER: ${
        req.body.user.id || req.body.user.sub
      } | ARTWORK: ${req.body.artwork.id} | RATE: ${req.body.rate}`
    );

    const userObj = await convertOathUser(req.body.user);

    const dbUser = await global.artyouDb.User.findOneAndUpdate(
      { id: userObj.id },
      userObj,
      findOneAndUpdateOptions
    );

    let dbArtwork = await global.artyouDb.Artwork.findOne({
      id: req.body.artwork.id,
    })
      .populate("image")
      .populate({ path: "artist", populate: { path: "image" } })
      .populate("recommendations")
      .populate("ratings")
      .populate("tags");

    const ratingObj = {
      user: dbUser,
      artwork: dbArtwork,
      rate: parseFloat(req.body.rate),
    };

    let ratingDoc = await global.artyouDb.Rating.findOne({
      user: dbUser,
      artwork: dbArtwork,
    });

    if (!ratingDoc) {
      ratingDoc = new global.artyouDb.Rating(ratingObj);
      console.log(
        `NEW | Rating | ID: ${ratingDoc.id} | RATE: ${ratingDoc.rate} | USER: ${dbUser.id} | ARTWORK: ${dbArtwork.id}`
      );
    } else {
      ratingDoc.rate = ratingObj.rate;
      console.log(
        `UPDATE | Rating | ID: ${ratingDoc.id} | RATE: ${ratingDoc.rate} | USER: ${dbUser.id} | ARTWORK: ${dbArtwork.id}`
      );
    }

    ratingDoc = await ratingDoc.save();

    console.log(
      `SAVED | Rating | ID: ${ratingDoc.id} | RATE: ${ratingDoc.rate} | USER: ${dbUser.id} | ARTWORK: ${dbArtwork.id}`
    );

    dbArtwork.ratings.push(ratingDoc);

    const ratingsHash = {};

    for (const rating of dbArtwork.ratings) {
      ratingsHash[rating.id] = rating;
    }

    dbArtwork.ratings = Object.values(ratingsHash);

    await dbArtwork.save();
    dbArtwork = await global.artyouDb.Artwork.findOne({ id: dbArtwork.id })
      .populate("image")
      .populate({ path: "artist", populate: { path: "image" } })
      .populate("recommendations")
      .populate("ratings")
      .populate("tags");

    dbArtwork.ratingAverage = 0;
    for (const rating of dbArtwork.ratings) {
      dbArtwork.ratingAverage += rating.rate;
    }

    await dbArtwork.save();

    console.log(
      `UPDATED | Artwork` +
        ` | ID: ${dbArtwork.id}` +
        ` | TITLE: ${dbArtwork.title}` +
        ` | ARTIST: ${dbArtwork.artist.id}` +
        ` | TAGS: ${dbArtwork.tags.length}` +
        ` | RATINGS: ${dbArtwork.ratings.length}` +
        ` | AVE RATING: ${dbArtwork.ratingAverage}` +
        ` | RECS: ${dbArtwork.recommendations.length}`
    );

    const dbArtworkObj = dbArtwork.toObject();
    dbArtworkObj.ratingUser = ratingDoc;

    res.json(dbArtworkObj);
    /// ***** RETURN THE ARTWORK *NOT* THE RATING
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
      `${model} | POST | UPDATE ${model} | ID: ${req.body.id} | USER: ${req.user.email} | ARTWORK: ${req.artwork.id} | RATE: ${req.body.rate}`
    );
    console.log(req.body);

    const doc = await global.artyouDb[model]
      .findOne({ id: req.body.id })
      .populate({ path: "artwork", populate: { path: "artist" } })
      .populate("user");
    doc.rate = req.body.rate;
    await doc.save();

    console.log(`UPDATED | ${model} | ID: ${doc.id}`);
    console.log({ doc });

    res.json(doc);
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
    const docs = await global.artyouDb[model]
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
