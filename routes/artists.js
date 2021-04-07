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

// if subdoc === 'unrated' => sort and value can be null and can be ignored
router.get(
  "/user/:userid/cursor/:cursorid/(:subdoc)?(.:sort.:value)?",
  async (req, res) => {
    try {
      const userDoc = req.params.userid
        ? await global.artyouDb.User.findOne({
            id: req.params.userid,
          }).select("_id")
        : false;

      const user_id = userDoc ? userDoc._id.toString() : false;

      const cursorid = req.params.cursorid;
      const subDoc = req.params.subdoc || "none"; // rating, recommendation, unrated
      const sort = req.params.sort || "none"; // name of field :'rate', 'score'
      let match = sort && sort !== "none" ? { "user._id": user_id } : {};
      const value = req.params.value || false; // field value: rate, score
      const limit = process.env.PAGE_SIZE || 20;

      const cursor = {};
      cursor._id = cursorid;

      if (sort && sort !== "none") {
        cursor[sort] = parseInt(value);
      }

      if (subDoc === "unrated") {
        if (user_id !== 0) {
          console.log(`GET | FOUND USER | _ID: ${user_id}`);
          match = {};
        }
      }

      console.log(
        `GET Artist | URL: ${req.url} | CURSOR | SORT (subDoc): ${subDoc}` +
          ` | FILTER BY USER _ID: ${user_id}` +
          ` | CURSOR: _id: ${cursor._id} sort: ${sort} value: ${value}`
      );

      const paginationOptions = {};
      paginationOptions.query = match;
      if (sort && sort !== "none") {
        paginationOptions.sort = [sort, -1];
      }

      if (cursor !== undefined && cursor._id !== "0") {
        paginationOptions.nextKey = {};
        paginationOptions.nextKey._id = cursor._id;
        if (sort && sort !== "none") {
          paginationOptions.nextKey[sort] = cursor[sort];
          paginationOptions.sort = [sort, -1];
        }
      }

      const paginationResults = global.artyouDb.generatePaginationQuery(
        paginationOptions
      );

      const sortByOptions = {};
      sortByOptions.user_id = user_id ? ObjectID(user_id) : null;
      // console.log(
      //   `USER ID ${sortByOptions.user_id} | IS ObjectID: ${ObjectID.isValid(
      //     sortByOptions.user_id
      //   )}`
      // );
      sortByOptions.match = paginationResults.paginatedQuery;

      sortByOptions.limit = limit;
      sortByOptions.subDoc = subDoc || "none";
      sortByOptions.sort = sort && sort !== "none" ? { [sort]: -1 } : "none";

      // docs can be ratings or recommendations
      const docs = await global.artyouDb.sortBySubDocUserPaginate(
        sortByOptions
      );

      const nextKey = paginationResults.nextKeyFn(docs);

      if (nextKey) {
        console.log(
          // eslint-disable-next-line no-underscore-dangle
          `FOUND Artist BY USER _ID: ${user_id}` +
            ` | SUBDOC: ${subDoc}` +
            ` | NEXT ID: ${nextKey._id}` +
            ` | NEXT SORT: ${nextKey.sort} ` +
            ` | NEXT RATE: ${nextKey.rate} ` +
            ` | NEXT SCORE: ${nextKey.score}` +
            ` | TOP ${docs.length} DOCs`
        );
      } else {
        console.log(
          // eslint-disable-next-line no-underscore-dangle
          `FOUND Artist BY USER _ID: ${user_id} | SUBDOC: ${subDoc} | NEXT KEY: ${nextKey} | TOP ${docs.length} DOCs`
        );
      }

      let artists = [];

      if (subDoc !== "none" && subDoc && subDoc !== "unrated") {
        artists = docs.map((doc) => {
          const art = Object.assign({}, doc.artist);
          art.ratings = art.ratings || [];
          art.recommendations = art.recommendations || [];
          art.ratingUser =
            subDoc === "rating"
              ? doc
              : art.ratings.find(
                  (rating) =>
                    rating.user === user_id || rating.user._id === user_id
                );
          art.recommendationUser =
            subDoc === "recommendation"
              ? doc
              : art.recommendations.find(
                  (rec) => (rec.user === user_id || rec.user._id) === user_id
                );
          return art;
        });
      } else {
        artists = docs.map((artist) => artist);
      }

      res.json({ artists: artists, nextKey: nextKey });
    } catch (err) {
      console.error(
        `GET | Artist | OAUTHID: ${req.params.userid} ERROR: ${err}`
      );
      res
        .status(400)
        .send(`GET | Artist | OAUTHID: ${req.params.userid} | ERROR: ${err}`);
    }
  }
);

router.get("/user/:userid/id/:artistId/", async (req, res) => {
  try {
    const userDoc =
      req.params.userid !== "0"
        ? await global.artyouDb.User.findOne({
            id: req.params.userid,
          }).select("_id")
        : false;

    const user_id = userDoc ? userDoc._id.toString() : false;
    const artistId = req.params.artistId || false;

    console.log(
      `GET Artist | URL: ${req.url}` +
        ` | USER _ID: ${user_id}` +
        ` | ARTIST ID: ${artistId}`
    );

    const artist = await global.artyouDb.Artist.findOne({ id: artistId })
      .populate("image")
      .lean();

    console.log(`FOUND ARTIST BY ID } | ID: ${artist.id} | _ID: ${artist._id}`);

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
