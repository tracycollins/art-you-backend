/* eslint-disable no-underscore-dangle */
/* eslint-disable dot-notation */
// const model = "Artist";
const express = require("express");
// const ObjectID = require("mongodb").ObjectID;
const router = express.Router({
  strict: true,
});

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

// // if subdoc === 'unrated' => sort and value can be null and can be ignored
// router.get(
//   "/user/:userid/cursor/:cursorid/(:subdoc)?(.:sort.:value)?",
//   async (req, res) => {
//     try {
//       const userDoc = req.params.userid
//         ? await global.artyouDb.User.findOne({
//             id: req.params.userid,
//           }).select("_id")
//         : false;

//       const user_id = userDoc ? userDoc._id.toString() : false;

//       // let userid = req.params.userid || 0;
//       const cursorid = req.params.cursorid;
//       const subDoc = req.params.subdoc || "none"; // rating, recommendation, unrated
//       const sort = req.params.sort || "none"; // name of field :'rate', 'score'
//       let match = sort && sort !== "none" ? { "user._id": user_id } : {};
//       const value = req.params.value || false; // field value: rate, score
//       const limit = process.env.PAGE_SIZE || 20;

//       const cursor = {};
//       cursor._id = cursorid;

//       // if (sort) {
//       if (sort && sort !== "none") {
//         cursor[sort] = parseInt(value);
//       }

//       if (subDoc === "unrated") {
//         if (user_id !== 0) {
//           console.log(`GET | FOUND USER | _ID: ${user_id}`);
//           match = {
//             // "ratings.user._id": { $nin: [user_id] },
//             // "ratings.user._id": { $nin: [ObjectID(user_id), user_id] },
//           };
//           // console.log(`match.ratings.user._id: ${match.ratings.user._id}`);
//         }
//       }

//       console.log(
//         `GET Artist | URL: ${req.url} | CURSOR | SORT (subDoc): ${subDoc}` +
//           ` | FILTER BY USER _ID: ${user_id}` +
//           ` | CURSOR: _id: ${cursor._id} sort: ${sort} value: ${value}`
//       );

//       const paginationOptions = {};
//       paginationOptions.query = match;
//       // if (sort) {
//       if (sort && sort !== "none") {
//         paginationOptions.sort = [sort, -1];
//       }

//       if (cursor !== undefined && cursor._id !== "0") {
//         paginationOptions.nextKey = {};
//         paginationOptions.nextKey._id = cursor._id;
//         // if (sort) {
//         if (sort && sort !== "none") {
//           paginationOptions.nextKey[sort] = cursor[sort];
//           paginationOptions.sort = [sort, -1];
//         }
//       }

//       console.log({ paginationOptions });

//       const paginationResults = global.artyouDb.generatePaginationQuery(
//         paginationOptions
//       );

//       const sortByOptions = {};
//       sortByOptions.user_id = user_id ? ObjectID(user_id) : null;
//       console.log(
//         `USER ID ${sortByOptions.user_id} | IS ObjectID: ${ObjectID.isValid(
//           sortByOptions.user_id
//         )}`
//       );
//       // sortByOptions.user_id = user_id;
//       sortByOptions.match = paginationResults.paginatedQuery;

//       sortByOptions.limit = limit;
//       sortByOptions.subDoc = subDoc || "none";
//       sortByOptions.sort = sort && sort !== "none" ? { [sort]: -1 } : "none";

//       // docs can be ratings or recommendations
//       const docs = await global.artyouDb.sortBySubDocUserPaginate(
//         sortByOptions
//       );

//       const nextKey = paginationResults.nextKeyFn(docs);

//       if (nextKey) {
//         console.log({ nextKey });
//         console.log(
//           // eslint-disable-next-line no-underscore-dangle
//           `FOUND Artist BY USER _ID: ${user_id}` +
//             ` | SUBDOC: ${subDoc}` +
//             ` | NEXT ID: ${nextKey._id}` +
//             ` | NEXT SORT: ${nextKey.sort} ` +
//             ` | NEXT RATE: ${nextKey.rate} ` +
//             ` | NEXT SCORE: ${nextKey.score}` +
//             ` | TOP ${docs.length} DOCs`
//         );
//       } else {
//         console.log(
//           // eslint-disable-next-line no-underscore-dangle
//           `FOUND Artist BY USER _ID: ${user_id} | SUBDOC: ${subDoc} | NEXT KEY: ${nextKey} | TOP ${docs.length} DOCs`
//         );
//       }

//       let artists = [];

//       if (subDoc !== "none" && subDoc && subDoc !== "unrated") {
//         artists = docs.map((doc) => {
//           const art = Object.assign({}, doc.artist);
//           art.ratings = art.ratings || [];
//           art.recommendations = art.recommendations || [];
//           art.ratingUser =
//             subDoc === "rating"
//               ? doc
//               : art.ratings.find(
//                   (rating) =>
//                     rating.user === user_id || rating.user._id === user_id
//                 );
//           art.recommendationUser =
//             subDoc === "recommendation"
//               ? doc
//               : art.recommendations.find(
//                   (rec) => (rec.user === user_id || rec.user._id) === user_id
//                 );
//           return art;
//         });
//       } else {
//         artists = docs.map((artist) => {
//           console.log({ artist });
//           // artist.ratingUser = artist.ratings.find(
//           //   (rating) => rating.user === user_id || rating.user._id === user_id
//           // );
//           // artist.recommendationUser = artist.recommendations.find(
//           //   (rec) => rec.user === user_id || rec.user._id === user_id
//           // );
//           return artist;
//         });
//       }

//       res.json({ artists: artists, nextKey: nextKey });
//     } catch (err) {
//       console.error(
//         `GET | Artist | OAUTHID: ${req.params.userid} ERROR: ${err}`
//       );
//       res
//         .status(400)
//         .send(`GET | Artist | OAUTHID: ${req.params.userid} | ERROR: ${err}`);
//     }
//   }
// );

// router.get("/user/:userid/id/:artistId/", async (req, res) => {
//   try {
//     const userDoc =
//       req.params.userid !== "0"
//         ? await global.artyouDb.User.findOne({
//             id: req.params.userid,
//           }).select("_id")
//         : false;

//     const user_id = userDoc ? userDoc._id.toString() : false;
//     const artistId = req.params.artistId || false;

//     console.log(
//       `GET Artist | URL: ${req.url}` +
//         ` | USER _ID: ${user_id}` +
//         ` | ARTIST ID: ${artistId}`
//     );

//     // docs can be ratings or recommendations
//     const artist = await global.artyouDb.Artist.findOne({ id: artistId })
//       .populate("image")
//       .populate("ratings")
//       .populate("recommendations")
//       .lean();

//     console.log(
//       `FOUND ARTIST BY ID } | ID: ${artist.id} | _ID: ${artist._id} | ${
//         artist.ratings.length
//       } RATINGS | RATING USER: ${
//         artist.ratingUser ? artist.ratingUser.user : "none"
//       }`
//     );

//     for (const rating of artist.ratings) {
//       console.log(`RATING | ${rating._id} | USER: ${rating.user}`);
//     }
//     res.json({ artist: artist });
//   } catch (err) {
//     console.error(
//       `GET | Artist | OAUTHID: ${req.params.userid} ERROR: ${err}`
//     );
//     res
//       .status(400)
//       .send(`GET | Artist | OAUTHID: ${req.params.userid} | ERROR: ${err}`);
//   }
// });

// router.get("/top-recs/user/:id", async (req, res) => {
//   try {
//     const limit = process.env.UNRATED_LIMIT || 20;

//     console.log(
//       `GET Artist | TOP RECS | FILTER BY USER OAUTHID: ${req.params.id} | LIMIT: ${limit}`
//     );

//     const recs = await global.artyouDb.Recommendation.aggregate([
//       {
//         $lookup: {
//           from: "users",
//           localField: "user",
//           foreignField: "_id",
//           as: "user",
//         },
//       },
//       {
//         $unwind: {
//           path: "$user",
//         },
//       },
//       {
//         $match: {
//           "user.oauthID": req.params.id,
//         },
//       },
//       {
//         $sort: {
//           score: -1,
//         },
//       },
//       {
//         $limit: 10,
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
//           from: "images",
//           localField: "artist.image",
//           foreignField: "_id",
//           as: "artist.image",
//         },
//       },
//       {
//         $unwind: {
//           path: "$artist.image",
//         },
//       },
//     ]);

//     console.log(
//       `FOUND Artist BY USER OAUTHID: ${req.params.id} | TOP ${recs.length} RECs`
//     );

//     const artists = recs.map((rec) => {
//       const art = Object.assign({}, rec.artist);
//       art.recommendationUser = { score: rec.score };
//       return art;
//     });

//     res.json(artists);
//   } catch (err) {
//     console.error(`GET | Artist | OAUTHID: ${req.body.id} ERROR: ${err}`);
//     res
//       .status(400)
//       .send(`GET | Artist | OAUTHID: ${req.body.id} | ERROR: ${err}`);
//   }
// });

// router.get("/:artistid/user/:userid", async (req, res) => {
//   try {
//     console.log(
//       `Artist | GET ARTIST BY ID ${req.params.artistid} | POP RATING/REC BY USER ID: ${req.params.userid}`
//     );

//     const userDoc = await global.artyouDb.User.findOne({
//       id: req.params.userid,
//     }).lean();

//     console.log(
//       `Artist | GET ARTIST BY ID | USER ID: ${userDoc.name} | ARTIST ID: ${req.params.artistid}`
//     );

//     const query = {};
//     query.id = parseInt(req.params.artistid);

//     console.log({ query });

//     const artistDoc = await global.artyouDb.Artist.findOne(query)
//       .populate("image")
//       .populate({ path: "artist", populate: { path: "image" } })
//       .populate({ path: "ratings", populate: { path: "user" } })
//       .populate({ path: "recommendations", populate: { path: "user" } })
//       .populate({ path: "tags", populate: { path: "user" } })
//       .lean()
//       .exec();

//     const ratingDoc = await global.artyouDb.Rating.findOne({
//       user: userDoc,
//       artist: artistDoc,
//     }).lean();
//     const recommendationDoc = await global.artyouDb.Recommendation.findOne({
//       user: userDoc,
//       artist: artistDoc,
//     }).lean();

//     if (artistDoc) {
//       if (ratingDoc) {
//         artistDoc.ratingUser = ratingDoc;
//       }

//       if (recommendationDoc) {
//         artistDoc.recommendationUser = recommendationDoc;
//       }

//       res.json(artistDoc);
//     } else {
//       console.log(
//         `ARTIST OR USER NOT FOUND | ARTIST ID: ${req.params.artistid} | USER ID: ${req.params.userid}`
//       );
//       res.json([]);
//     }
//   } catch (err) {
//     console.error(`GET | Artist | ID: ${req.body.id} ERROR: ${err}`);
//     res.status(400).send(`GET | Artist | ID: ${req.body.id} | ERROR: ${err}`);
//   }
// });

// router.get("/user/:userid", async (req, res) => {
//   try {
//     console.log(
//       `Artist | GET ARTISTS | POP RATING/REC BY USER ID: ${req.params.userid}`
//     );

//     const userDoc = await global.artyouDb.User.findOne({
//       id: req.params.userid,
//     }).lean();
//     // console.log({ userDoc });

//     const artistDocs = await global.artyouDb.Artist.find({})
//       .populate("image")
//       .populate({ path: "artist", populate: { path: "image" } })
//       .populate({ path: "ratings", populate: { path: "user" } })
//       .populate({ path: "recommendations", populate: { path: "user" } })
//       .populate({ path: "tags", populate: { path: "user" } })
//       .lean();

//     // const ratingDocs = await global.artyouDb.Rating.find({user: userDoc}).lean()
//     // const recommendationDocs = await global.artyouDb.Recommendation.findOne({user: userDoc}).lean()

//     const docs = [];

//     for (const artistDoc of artistDocs) {
//       // console.log({artistDoc})

//       if (userDoc) {
//         for (const rating of artistDoc.ratings) {
//           // console.log({ rating });
//           if (rating.user && rating.user.id === userDoc.id) {
//             artistDoc.ratingUser = rating;
//           }
//         }

//         for (const rec of artistDoc.recommendations) {
//           // console.log({ rec });
//           if (rec.user && rec.user.id === userDoc.id) {
//             artistDoc.recommendationUser = rec;
//           }
//         }
//       }

//       docs.push(artistDoc);
//     }

//     res.json(docs);
//   } catch (err) {
//     console.error(`GET | Artist | ID: ${req.body.id} ERROR: ${err}`);
//     res.status(400).send(`GET | Artist | ID: ${req.body.id} | ERROR: ${err}`);
//   }
// });

// router.get("/:id", async (req, res) => {
//   const query = {};

//   console.log(`GET Artist | ID: ${req.params.id}`);
//   query.id = parseInt(req.params.id);

//   console.log({ query });

//   const doc = await global.artyouDb.Artist.findOne(query)
//     .populate("image")
//     .populate({ path: "artist", populate: { path: "image" } })
//     .populate({ path: "ratings", populate: { path: "user" } })
//     .populate({ path: "recommendations", populate: { path: "user" } })
//     .populate({ path: "tags", populate: { path: "user" } })
//     .lean();

//   console.log(
//     `FOUND Artist | ${doc.id} | ${doc.artist.displayName} | ${doc.image.url}`
//   );

//   res.json(doc);
// });

// // get artists by artist
// router.get("/artist/:id", async (req, res) => {
//   try {
//     console.log(`Artist | GET ARTIST BY ARTIST ${req.params.id}`);

//     const artistDoc = await global.artyouDb[model].findOne({
//       id: req.params.id,
//     });

//     if (artistDoc) {
//       const docs = await global.artyouDb.Artist.find({
//         artist: artistDoc,
//       })
//         .populate("image")
//         .populate({ path: "artist", populate: { path: "image" } })
//         .populate({ path: "ratings", populate: { path: "user" } })
//         .populate({ path: "recommendations", populate: { path: "user" } })
//         .populate({ path: "tags", populate: { path: "user" } })
//         .lean();

//       console.log(`FOUND ${docs.length} Artists`);
//       res.json(docs);
//     } else {
//       console.log(`ARTIST NOT FOUND | ARTIST ID: ${req.params.id}`);
//       res.json([]);
//     }
//   } catch (err) {
//     console.error(`GET | Artist | ID: ${req.body.id} ERROR: ${err}`);
//     res.status(400).send(`GET | Artist | ID: ${req.body.id} | ERROR: ${err}`);
//   }
// });

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
