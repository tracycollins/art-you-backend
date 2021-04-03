/* eslint-disable no-underscore-dangle */
/* eslint-disable dot-notation */
const model = "Artist";
const express = require("express");
const ObjectID = require("mongodb").ObjectID;
const router = express.Router({
  strict: true,
});

// get artists by id, pop with rating and rec by user id

// router.get("/cursor/:cursor", async (req, res) => {
//   try {
//     console.log(`URL: ${req.url} | PARAMS:`, req.params);
//     const cursor = req.params.cursor || 0;
//     const limit = 20;
//     console.log(`ARTISTS | GET CURSOR: ${cursor} | LIMIT: ${limit}`);

//     const docs = await global.artyouDb.Artist.find({ id: { $gt: cursor } })
//       .sort()
//       .limit(limit)
//       .populate("image")
//       .populate({ path: "artist", populate: { path: "image" } })
//       .populate({ path: "ratings", populate: { path: "user" } })
//       .populate({ path: "recommendations", populate: { path: "user" } })
//       .populate({ path: "tags", populate: { path: "user" } })
//       .lean();

//     console.log(`ARTISTS | GET | ${docs.length} ARTISTS | LIMIT: ${limit}`);

//     res.json(docs);
//   } catch (err) {
//     const message = `GET | ARTISTS | ID: ${req.body.id} | USER ID: ${req.params.userid} | CURSOR: ${req.params.cursor} | ERROR: ${err}`;
//     console.error(message);
//     res.status(400).send(message);
//   }
// });

// if subdoc === 'unrated' => sort and value can be null and can be ignored
router.get("/cursor/:cursorid/(:subdoc)?(.:sort.:value)?", async (req, res) => {
  try {
    const cursorid = req.params.cursorid;
    const subDoc = req.params.subdoc || "none"; // rating, recommendation, unrated
    const sort = req.params.sort || "none"; // name of field :'rate', 'score'
    let match = {};
    const value = req.params.value || false; // field value: rate, score
    const limit = process.env.PAGE_SIZE || 20;

    const cursor = {};
    cursor._id = cursorid;

    if (sort && sort !== "none") {
      cursor[sort] = parseInt(value);
    }

    console.log(
      `GET ${model} | URL: ${req.url} | CURSOR | SORT (subDoc): ${subDoc}` +
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

    console.log({ paginationOptions });

    const paginationResults = global.artyouDb.generatePaginationQuery(
      paginationOptions
    );

    const sortByOptions = {};
    sortByOptions.user_id = null;
    console.log(
      `USER ID ${sortByOptions.user_id} | IS ObjectID: ${ObjectID.isValid(
        sortByOptions.user_id
      )}`
    );
    // sortByOptions.user_id = user_id;
    sortByOptions.match = paginationResults.paginatedQuery;

    sortByOptions.limit = limit;
    sortByOptions.subDoc = subDoc || "none";
    sortByOptions.sort = sort && sort !== "none" ? { [sort]: -1 } : "none";

    // docs can be ratings or recommendations
    const docs = await global.artyouDb.sortBySubDocUserPaginate(sortByOptions);

    const nextKey = paginationResults.nextKeyFn(docs);

    if (nextKey) {
      console.log({ nextKey });
      console.log(
        // eslint-disable-next-line no-underscore-dangle
        `FOUND ${model}` +
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
        `FOUND ${model} | SUBDOC: ${subDoc} | NEXT KEY: ${nextKey} | TOP ${docs.length} DOCs`
      );
    }

    res.json({ artists: docs, nextKey: nextKey });
  } catch (err) {
    console.error(
      `GET | ${model} | OAUTHID: ${req.params.userid} ERROR: ${err}`
    );
    res
      .status(400)
      .send(`GET | ${model} | OAUTHID: ${req.params.userid} | ERROR: ${err}`);
  }
});

router.get("/:id", async (req, res) => {
  const query = {};

  console.log(`GET ${model} | ID: ${req.params.id}`);
  query.id = parseInt(req.params.id);

  console.log({ query });

  const doc = await global.artyouDb.Artist.findOne(query)
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
