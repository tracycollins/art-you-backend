/* eslint-disable no-underscore-dangle */
/* eslint-disable dot-notation */
const model = "Artwork";
const express = require("express");
const ObjectID = require("mongodb").ObjectID;
const treeify = require("treeify");
const router = express.Router({
  strict: true,
});

const jsonPrint = function (obj) {
  if (obj && obj != undefined) {
    return treeify.asTree(obj, true, true);
  } else {
    return "UNDEFINED";
  }
};

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

    console.log(`ARTWORKS | GET | ${docs.length} ARTWORKS | LIMIT: ${limit}`);

    res.json(docs);
  } catch (err) {
    const message = `GET | ARTWORKS | ID: ${req.body.id} | USER ID: ${req.params.userid} | CURSOR: ${req.params.cursor} | ERROR: ${err}`;
    console.error(message);
    res.status(400).send(message);
  }
});

// if subdoc === 'unrated' => sort and value can be null and can be ignored
router.get(
  // "/user/:userid/cursor/:cursorid/(:subdoc.:sort.:value)?",
  "/user/:userid/cursor/:cursorid/(:subdoc)?(.:sort.:value)?",
  async (req, res) => {
    try {
      const userDoc = req.params.userid
        ? await global.artyouDb.User.findOne({
            id: req.params.userid,
          }).select("_id")
        : false;

      const user_id = userDoc ? userDoc._id : false;

      // let userid = req.params.userid || 0;
      const cursorid = req.params.cursorid;
      const subDoc = req.params.subdoc || false; // rating, recommendation, unrated
      const sort = req.params.sort || false; // name of field :'rate', 'score'
      let match = sort ? { "user._id": user_id } : {};
      const value = req.params.value || false; // field value: rate, score
      const limit = process.env.PAGE_SIZE || 20;

      const cursor = {};
      cursor._id = cursorid;

      if (sort) {
        cursor[sort] = parseInt(value);
      }

      if (subDoc === "unrated") {
        if (user_id !== 0) {
          console.log(`GET | FOUND USER | _ID: ${user_id}`);
          match = {
            "ratings.user._id": { $nin: [user_id] },
          };
          console.log(`match\n${jsonPrint(match)}`);
        }
      }

      console.log(
        `GET ${model} | URL: ${req.url} | CURSOR | SORT (subDoc): ${subDoc}` +
          ` | FILTER BY USER _ID: ${user_id}` +
          ` | CURSOR: _id: ${cursor._id} sort: ${sort} value: ${value}`
      );

      const paginationOptions = {};
      paginationOptions.query = match;
      if (sort) {
        paginationOptions.sort = [sort, -1];
      }

      if (cursor !== undefined && cursor._id !== "0") {
        paginationOptions.nextKey = {};
        paginationOptions.nextKey._id = cursor._id;
        if (sort) {
          // paginationOptions[sort] = parseInt(cursor[sort].value);
          paginationOptions.nextKey[sort] = cursor[sort];
          paginationOptions.sort = [sort, -1];
        }
      }

      console.log({ paginationOptions });

      //   query: match,
      //   sort: ["rate", -1],
      //   nextKey,
      // }

      const paginationResults = global.artyouDb.generatePaginationQuery(
        paginationOptions
      );

      const sortByOptions = {};

      sortByOptions.match = paginationResults.paginatedQuery;
      sortByOptions.limit = limit;
      sortByOptions.subDoc = subDoc || null;
      sortByOptions.sort = { [sort]: -1 } || null;

      // docs can be ratings or recommendations
      const docs = await global.artyouDb.sortBySubDocUserPaginate(
        sortByOptions
      );

      const nextKey = paginationResults.nextKeyFn(docs);

      if (nextKey) {
        console.log({ nextKey });
        console.log(
          // eslint-disable-next-line no-underscore-dangle
          `FOUND ${model} BY USER _ID: ${user_id}` +
            ` | NEXT ID: ${nextKey._id}` +
            ` | NEXT SORT: ${nextKey.sort} ` +
            ` | NEXT RATE: ${nextKey.rate} ` +
            ` | NEXT SCORE: ${nextKey.score}` +
            ` | TOP ${docs.length} DOCs`
        );
      } else {
        console.log(
          // eslint-disable-next-line no-underscore-dangle
          `FOUND ${model} BY USER _ID: ${user_id} | NEXT KEY: ${nextKey} | TOP ${docs.length} DOCs`
        );
      }

      let artworks = [];

      if (subDoc && subDoc !== "unrated") {
        artworks = docs.map((doc) => {
          const art = Object.assign({}, doc.artwork);
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
        artworks = docs.map((artwork) => {
          artwork.ratingUser = artwork.ratings.find(
            (rating) => rating.user === user_id || rating.user._id === user_id
          );
          artwork.recommendationUser = artwork.recommendations.find(
            (rec) => rec.user === user_id || rec.user._id === user_id
          );
          return artwork;
        });
      }

      res.json({ artworks: artworks, nextKey: nextKey });
    } catch (err) {
      console.error(
        `GET | ${model} | OAUTHID: ${req.params.userid} ERROR: ${err}`
      );
      res
        .status(400)
        .send(`GET | ${model} | OAUTHID: ${req.params.userid} | ERROR: ${err}`);
    }
  }
);

// router.get("/unrated/user/:id", async (req, res) => {
//   try {
//     const limit = process.env.UNRATED_LIMIT || 20;

//     console.log(
//       `GET ${model} | UNRATED | FILTER BY USER OAUTHID: ${req.params.id} | LIMIT: ${limit}`
//     );

//     const artworks = await global.artyouDb.Artwork.aggregate([
//       {
//         $lookup: {
//           from: "ratings",
//           localField: "ratings",
//           foreignField: "_id",
//           as: "ratings",
//         },
//       },
//       {
//         $lookup: {
//           from: "artists",
//           localField: "artist",
//           foreignField: "_id",
//           as: "artist",
//         },
//       },
//       {
//         $unwind: {
//           path: "$artist",
//         },
//       },
//       {
//         $lookup: {
//           from: "users",
//           localField: "ratings.user",
//           foreignField: "_id",
//           as: "users",
//         },
//       },
//       {
//         $match: {
//           "users.id": {
//             $ne: req.params.id,
//           },
//         },
//       },
//       {
//         $sort: {
//           id: 1,
//         },
//       },
//       {
//         $limit: limit,
//       },
//       {
//         $lookup: {
//           from: "images",
//           localField: "image",
//           foreignField: "_id",
//           as: "image",
//         },
//       },
//       {
//         $unwind: {
//           path: "$image",
//         },
//       },
//     ]);

//     console.log(
//       `FOUND ${model} BY USER OAUTHID: ${req.params.id} | ${artworks.length} UNRATED ARTWORKS`
//     );

//     res.json(artworks);
//   } catch (err) {
//     console.error(`GET | ${model} | OAUTHID: ${req.body.id} ERROR: ${err}`);
//     res
//       .status(400)
//       .send(`GET | ${model} | OAUTHID: ${req.body.id} | ERROR: ${err}`);
//   }
// });

router.get("/top-recs/user/:id", async (req, res) => {
  try {
    const limit = process.env.UNRATED_LIMIT || 20;

    console.log(
      `GET ${model} | TOP RECS | FILTER BY USER OAUTHID: ${req.params.id} | LIMIT: ${limit}`
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
