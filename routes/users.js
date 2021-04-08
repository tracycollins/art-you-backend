/* eslint-disable no-underscore-dangle */
const express = require("express");
const router = express.Router();

const model = "User";

const PF = "USR";

const userNormalizeProps = (user) => {
  const normalizedUser = Object.assign({}, user);
  for (const prop of Object.keys(user)) {
    switch (prop) {
      case "sub":
        normalizedUser.id = user.sub;
        normalizedUser.oauthID = user.sub;
        break;
      case "family_name":
        normalizedUser.lastName = user.family_name;
        break;
      case "given_name":
        normalizedUser.firstName = user.given_name;
        break;
      case "nickname":
        normalizedUser.nickName = user.nickname;
        break;
      default:
    }
  }
  return normalizedUser;
};

router.get("/:id", async (req, res) => {
  try {
    const query = {};

    console.log(`GET ${model} | ID: ${req.params.id}`);
    query.id = req.params.id;

    const user = await global.artyouDb.User.findOne(query)
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

router.post("/update", async (req, res) => {
  try {
    let userUpdate = req.body;
    userUpdate = userNormalizeProps(userUpdate);

    console.log(
      `${PF} | POST` +
        ` | UPDATE User` +
        ` | ID: ${userUpdate.id}` +
        ` | _ID: ${userUpdate._id}` +
        ` | SUB: ${userUpdate.sub}`
    );

    console.log({ userUpdate });

    const query = {};

    if (req.body._id) {
      query._id = req.body._id;
    } else if (req.body.sub) {
      query.oauthID = req.body.sub;
    } else if (req.body.id) {
      query.id = req.body.id;
    } else {
      throw new Error(`USER _ID, ID AND SUB UNDEFINED`);
    }

    console.log({ query });

    const userDoc = await global.artyouDb.User.findOne(query).populate("image");

    if (!userDoc) {
      throw new Error(`USER NOT FOUND | _ID: ${req.body._id}`);
    }

    const userUpdateKeys = [
      "userName",
      "firstName",
      "lastName",
      "nickname",
      "nickName",
      "bio",
      "email",
      "image",
      "location",
      "userUrl",
      "instagramUsername",
      "twitterUsername",
      "facebookUrl",
    ];

    for (const key of userUpdateKeys) {
      if (
        userUpdate[key] &&
        userUpdate[key] !== undefined &&
        userUpdate[key] !== null &&
        userUpdate[key] !== ""
      )
        userDoc[key] = userUpdate[key];
    }

    await userDoc.save();

    console.log(
      `UPDATED | User` +
        ` | ID: ${userDoc.id}` +
        ` | _ID: ${userDoc._id}` +
        ` | SUB: ${userDoc.sub}`
    );

    const userUpdatedJson = userDoc.toObject();
    console.log({ userUpdatedJson });

    res.json(userUpdatedJson);
  } catch (err) {
    console.error(`POST | UPDATE | User | ID: ${req.body.id} ERROR: ${err}`);
    res.status(400).send(`GET | User | ID: ${req.body.id} | ERROR: ${err}`);
  }
});

router.get("/", async (req, res) => {
  try {
    console.log(`${model} | GET`);
    const docs = await global.artyouDb.User.find({})
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
