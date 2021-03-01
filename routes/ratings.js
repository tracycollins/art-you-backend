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

  console.log(`RATING | convertOathUser | oathType: ${oathType}`);
  console.log({ user });
  switch (oathType) {
    // email + password
    case "auth0":
      user.id = oathUser.sub;
      user.oauthID = oathUser.sub;
      user.name = oathUser.name;
      user.email = oathUser.email;
      user.image = new global.artyouDb.Image({
        id: oathUser.sub,
        url: oathUser.picture,
        title: oathUser.name,
      });
      break;

    case "github":
      user.id = oathUser.sub;
      user.oauthID = oathUser.sub;
      user.name = oathUser.name;
      user.email = oathUser.email;
      user.image = new global.artyouDb.Image({
        id: oathUser.sub,
        url: oathUser.picture,
        title: oathUser.name,
      });
      break;

    case "google-oauth2":
      user.id = oathUser.sub;
      user.oauthID = oathUser.sub;
      user.firstName = oathUser.given_name;
      user.lastName = oathUser.family_name;
      user.email = oathUser.email;
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
      user.email = oathUser.email;
      user.image = new global.artyouDb.Image({
        id: oathUser.sub,
        url: oathUser.picture,
        title: oathUser.name,
      });
      break;

    default:
      console.log(`*** UNKNOWN oathType: ${oathType}`);
      throw new Error(`*** UNKNOWN oathType: ${oathType} | ${oathUser.sub}`);
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
    console.log(
      `${model} | POST | CREATE ${model} | USER: ${
        req.body.user.id || req.body.user.sub
      } | ARTWORK: ${req.body.artwork.id} | RATE: ${req.body.rate}`
    );
    console.log(req.body.user);

    const userObj = await convertOathUser(req.body.user);

    const dbUser = await global.artyouDb.User.findOneAndUpdate(
      { id: userObj.id },
      userObj,
      findOneAndUpdateOptions
    );

    if (!dbUser) {
      console.log(`*** CREATE ERROR | Rating | USER ID ${dbUser.id} NOT FOUND`);
      throw new Error(
        `*** CREATE ERROR | Rating | USER ID ${dbUser.id} NOT FOUND`
      );
    }
    const dbArtwork = await global.artyouDb.Artwork.findOne({
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

    await ratingDoc.save();

    // eslint-disable-next-line no-underscore-dangle
    dbArtwork.ratings.addToSet(ratingDoc._id);
    await dbArtwork.save();

    console.log(
      `SAVED | Rating | ID: ${ratingDoc.id} | RATE: ${ratingDoc.rate} | USER: ${dbUser.id} | ARTWORK: ${dbArtwork.id}`
    );

    res.json(ratingDoc.toObject());
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
