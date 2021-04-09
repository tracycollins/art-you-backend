/* eslint-disable no-underscore-dangle */
/* eslint-disable dot-notation */
const express = require("express");
const router = express.Router({
  strict: true,
});
const ObjectID = require("mongodb").ObjectID;

router.get("/cursor/:cursor", async (req, res) => {
  try {
    console.log(`URL: ${req.url} | PARAMS:`, req.params);
    const cursor = req.params.cursor || 0;
    const limit = 20;
    console.log(`ARTISTS | GET CURSOR: ${cursor} | LIMIT: ${limit}`);

    const query = cursor !== "0" ? { _id: { $gt: cursor } } : {};

    const artists = await global.artyouDb.Artist.find(query)
      .sort()
      .limit(limit)
      .populate("image")
      .lean();

    const nextKey = {};

    nextKey._id = artists.length > 0 ? artists[artists.length - 1]._id : 0;

    console.log(`ARTISTS | GET | ${artists.length} ARTISTS | LIMIT: ${limit}`);

    res.json({ artists, nextKey });
  } catch (err) {
    const message = `GET | ARTISTS | ID: ${req.body.id} | USER ID: ${req.params.userid} | CURSOR: ${req.params.cursor} | ERROR: ${err}`;
    console.error(message);
    res.status(400).send(message);
  }
});
// "/user/:userid/cursor/:cursorid/(:subdoc)?(.:sort.:value)?",
router.get("/user/:userid/id/:artistId/(:artworks)?", async (req, res) => {
  try {
    const userDoc =
      req.params.userid !== "0"
        ? await global.artyouDb.User.findOne({
            id: req.params.userid,
          }).select("_id")
        : false;

    const user_id = userDoc ? userDoc._id.toString() : false;
    const artistId = req.params.artistId || false;
    const artworksFlag = req.params.artworks || false;

    console.log(
      `GET Artist | URL: ${req.url}` +
        ` | USER _ID: ${user_id}` +
        ` | ARTIST ID: ${artistId}` +
        ` | ARTWORKS FLAG: ${artworksFlag}`
    );

    let artist;

    if (artworksFlag) {
      console.log("POPULATE artworks");
      artist = await global.artyouDb.Artist.findOne({ id: artistId })
        .populate("image")
        .populate("artworks")
        .lean();
    } else {
      artist = await global.artyouDb.Artist.findOne({ id: artistId })
        .populate("image")
        .lean();
    }

    console.log(
      `FOUND ARTIST | ARTWORKS FLAG: ${artworksFlag} | ID: ${artist.id} | _ID: ${artist._id}`
    );

    res.json({ artist: artist });
  } catch (err) {
    console.error(`GET | Artist | OAUTHID: ${req.params.userid} ERROR: ${err}`);
    res
      .status(400)
      .send(`GET | Artist | OAUTHID: ${req.params.userid} | ERROR: ${err}`);
  }
});

router.get("/", async (req, res) => {
  try {
    console.log(`ARTISTS | GET`);

    const docs = await global.artyouDb.Artist.find({})
      .populate("image")
      .populate({ path: "artist", populate: { path: "image" } })
      .populate({ path: "ratings", populate: { path: "user" } })
      .populate({ path: "recommendations", populate: { path: "user" } })
      .populate({ path: "tags", populate: { path: "user" } })
      .lean();

    console.log(`FOUND ${docs.length} Artists`);
    res.json(docs);
  } catch (err) {
    console.error(`GET | Artist | ID: ${req.body.id} ERROR: ${err}`);
    res.status(400).send(`GET | Artist | ID: ${req.body.id} | ERROR: ${err}`);
  }
});

module.exports = router;
