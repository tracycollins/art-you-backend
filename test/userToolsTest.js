/* eslint-disable no-undef */
const _ = require("lodash");
const moment = require("moment");

const UserTools = require("../lib/userTools.js");

let usr;

usr = new UserTools("TUSR");

usr.on("ready", async (appName) => {
  try {
    console.log(`USR | READY | APP NAME: ${appName}`);

    const response = await usr.getUnratedArtworks({
      model: "Artwork",
      user_id: "60483532b8c09b0015454be7",
      populate: "ratings",
      // limit: 10,
      lean: true,
    });

    console.log(`${response.results.length} RESULTS`);
    process.exit();
  } catch (err) {
    console.error(err);
  }
});
