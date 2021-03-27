/* eslint-disable no-underscore-dangle */
const express = require("express");
const router = express.Router();

const model = "User";

router.get("/:id", async (req, res) => {
  try {
    const query = {};

    console.log(`GET ${model} | ID: ${req.params.id}`);
    query.id = req.params.id;

    const user = await global.artyouDb[model]
      .findOne(query)
      .populate("image")
      .populate("tags")
      .lean();

    if (user) {
      console.log(
        `APP | ===========================================================================`
      );
      console.log(`APP | ==> FOUND USER | ID: ${user.id} | _ID: ${user._id}`);
      console.log(
        `APP | ===========================================================================`
      );
      res.json(user);
    } else {
      console.log(`!!! NOT FOUND FOUND ${model} | ${req.params.id}`);
      res.sendStatus(404);
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
      .populate("tags")
      .lean();
    console.log(`FOUND ${docs.length} ${model}s`);
    res.json(docs);
  } catch (err) {
    console.error(`GET | ${model} | ID: ${req.body.id} ERROR: ${err}`);
    res.status(400).send(`GET | ${model} | ID: ${req.body.id} | ERROR: ${err}`);
  }
});

module.exports = router;
