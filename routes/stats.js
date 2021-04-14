/* eslint-disable no-underscore-dangle */
// const REDIS_URL = process.env.REDIS_URL || "redis://127.0.0.1:6379";

const express = require("express");
const router = express.Router();

const statsObj = {};
const statusModels = ["Artist", "Artwork", "Rating", "User", "Recommendation"];

for (const model of statusModels) {
  const keyName = `${model.toLowerCase()}s`;
  statsObj[keyName] = {};
  statsObj[keyName].total = 0;
}

router.get("/", async (req, res) => {
  try {
    console.log(`STATS | GET`);

    if (global.artyouDb !== undefined) {
      for (const model of statusModels) {
        const keyName = `${model.toLowerCase()}s`;
        statsObj[keyName].total = await global.artyouDb[
          model
        ].estimatedDocumentCount();
      }
    }

    res.json({ stats: statsObj });
  } catch (err) {
    console.error(`GET | STATS | ID: ${req.body.id} ERROR: ${err}`);
    res.status(400).send(`GET | STATS | ID: ${req.body.id} | ERROR: ${err}`);
  }
});

module.exports = router;
