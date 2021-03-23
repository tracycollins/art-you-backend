/* eslint-disable no-underscore-dangle */
/* eslint-disable dot-notation */
const model = "Artwork";
const express = require("express");
const router = express.Router({
  strict: true,
});

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

router.get(
  "/user/:userid/cursor/:cursorid/(:subdoc.:sort.:value)?",
  async (req, res) => {
    try {
      const userid = req.params.userid || 0;
      const cursorid = req.params.cursorid;
      const subDoc = req.params.subdoc || false; // rating, recommendation
      const sort = req.params.sort || false; // name of field :'rate', 'score'
      const match = sort ? { "user.oauthID": userid } : {};
      const value = req.params.value || false; // field value: rate, score
      const limit = process.env.PAGE_SIZE || 20;

      const cursor = {};
      cursor._id = cursorid;
      if (sort) {
        cursor[sort] = parseInt(value);
      }

      console.log(`GET `);
      console.log(
        `GET ${model} | URL: ${req.url} | CURSOR | SORT ${subDoc}` +
          ` | FILTER BY USER OAUTHID: ${userid}` +
          ` | CURSOR: _id: ${cursor._id} sort: ${sort} value: ${value}`
      );

      const paginationOptions = {};
      paginationOptions.query = match;
      if (sort) {
        paginationOptions[sort] = [sort, -1];
      }

      if (cursor !== undefined && cursor._id !== "0") {
        paginationOptions.nextKey = {};
        paginationOptions.nextKey._id = cursor._id;
        if (sort) {
          paginationOptions[sort] = parseInt(cursor[sort].value);
        }
      }

      const paginationResults = global.artyouDb.generatePaginationQuery(
        paginationOptions
      );

      console.log(
        `paginationResults.paginatedQuery: `,
        paginationResults.paginatedQuery
      );

      const docs = await global.artyouDb.sortBySubDocUserPaginate({
        match: paginationResults.paginatedQuery,
        limit: limit,
        subDoc: subDoc || null,
        sort: sort || null,
      });

      const next = paginationResults.nextKeyFn(docs);

      if (next) {
        console.log(
          // eslint-disable-next-line no-underscore-dangle
          `FOUND ${model} BY USER OAUTHID: ${userid}` +
            ` | NEXT: ${next._id}` +
            ` | RATE: ${next.rate} ` +
            ` | SCORE: ${next.score}` +
            ` | TOP ${docs.length} DOCs`
        );
      } else {
        console.log(
          // eslint-disable-next-line no-underscore-dangle
          `FOUND ${model} BY USER OAUTHID: ${userid} | NEXT: ${next} | TOP ${docs.length} DOCs`
        );
      }

      let artworks = [];

      if (subDoc) {
        artworks = docs.map((doc) => {
          const art = Object.assign({}, doc.artwork);
          art.ratingUser =
            subDoc === "rating"
              ? doc
              : art.ratings.find((rating) => rating.user.id === userid);
          art.recommendationUser =
            subDoc === "recommendation"
              ? doc
              : art.recommendations.find((rec) => rec.user.id === userid);
          return art;
        });
      } else {
        artworks = docs.map((artwork) => {
          artwork.ratingUser = artwork.ratings.find(
            (rating) => rating.user.id === userid
          );
          artwork.recommendationUser = artwork.recommendations.find(
            (rec) => rec.user.id === userid
          );
          return artwork;
        });
      }

      res.json({ artworks: artworks, cursor: next });
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

// router.get("/user/:userid/cursor/:cursorid", async (req, res) => {
//   try {
//     console.log(`URL: ${req.url} | PARAMS:`, req.params);
//     const userid = req.params.userid || 0;
//     const match = { "user.oauthID": userid };
//     const cursorid = req.params.cursorid || 0;
//     const limit = process.env.CURSOR_GET_LIMIT || 20;
//     console.log(
//       `ARTWORKS | GET USER CURSOR | USER: ${req.params.userid} CURSOR: ${cursorid} | LIMIT: ${limit}`
//     );

//     const cursor = {
//       _id: cursorid,
//     };

//     const paginationOptions = {
//       query: match,
//     };

//     if (cursor !== undefined && cursor._id !== "0") {
//       paginationOptions.nextKey = {
//         _id: cursor._id,
//       };
//     }

//     const paginationResults = global.artyouDb.generatePaginationQuery(
//       paginationOptions
//     );

//     const docs = await global.artyouDb.Artwork.find({ _id: { $gt: cursorid } })
//       .sort()
//       .limit(limit)
//       .populate("image")
//       .populate({ path: "artist", populate: { path: "image" } })
//       .populate({ path: "ratings", populate: { path: "user" } })
//       .populate({ path: "recommendations", populate: { path: "user" } })
//       .populate({ path: "tags", populate: { path: "user" } })
//       .lean();

//     const artworks = docs.map((artwork) => {
//       artwork.ratingUser = artwork.ratings.find(
//         (rating) => rating.user.id === userid
//       );
//       artwork.recommendationUser = artwork.recommendations.find(
//         (rec) => rec.user.id === userid
//       );
//       return artwork;
//     });

//     console.log(`ARTWORKS | GET | ${artworks.length} | LIMIT: ${limit}`);
//     res.json({ artworks: artworks, cursor: next });

//     // res.json(artworks);
//   } catch (err) {
//     const message = `GET | ARTWORKS | ID: ${req.body.id} | USER ID: ${req.params.userid} | CURSOR: ${req.params.cursorid} | ERROR: ${err}`;
//     console.error(message);
//     res.status(400).send(message);
//   }
// });

router.get("/unrated/user/:id", async (req, res) => {
  try {
    const limit = process.env.UNRATED_LIMIT || 20;

    console.log(
      `GET ${model} | UNRATED | FILTER BY USER OAUTHID: ${req.params.id} | LIMIT: ${limit}`
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
          from: "artists",
          localField: "artist",
          foreignField: "_id",
          as: "artist",
        },
      },
      {
        $unwind: {
          path: "$artist",
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
        $limit: limit,
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
    const limit = process.env.UNRATED_LIMIT || 20;

    console.log(
      `GET ${model} | TOP 10 RECS | FILTER BY USER OAUTHID: ${req.params.id} | LIMIT: ${limit}`
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
