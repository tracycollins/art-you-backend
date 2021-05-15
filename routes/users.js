/* eslint-disable no-underscore-dangle */
const fs = require("fs-extra");
const express = require("express");
const escape = require("escape-html");
const router = express.Router();
const multer = require("multer");
const upload = multer({ dest: "/tmp/art47/uploads/profile/" });
const S3Client = require("../lib/awsS3Client.js");
const awsS3Client = new S3Client();

const model = "User";

const PF = "USR";
const imageFile = `user_profile_image.jpg`;
const bucketName = "art47-users";

const s3putImage = async (p) => {
  try {
    const params = p || {};

    const fileContent = fs.readFileSync(params.path);

    const objectParams = {
      Bucket: params.bucketName,
      Key: params.keyName,
      Body: fileContent,
    };

    const results = await awsS3Client.putObject(objectParams);

    return results;
  } catch (err) {
    console.log(`DB | SEED | *** s3putImage ERROR: ${err}`);
    throw err;
  }
};

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
      case "nickName":
        normalizedUser.nickname = user[prop];
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

    const user = await global.art47db.User.findOne(query)
      .populate("image")
      .populate("tags")
      .lean();

    if (user) {
      user.rated = await global.art47db.Rating.count({ user: user });

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
    console.error(`GET | ${model} | ID: ${escape(req.body.id)} ERROR: ${err}`);
    res
      .status(400)
      .send(`GET | ${model} | ID: ${escape(req.body.id)} | ERROR: ${err}`);
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

    const userDoc = await global.art47db.User.findOne(query).populate("image");

    if (!userDoc) {
      throw new Error(`USER NOT FOUND | _ID: ${escape(req.body._id)}`);
    }

    userDoc.rated = await global.art47db.Rating.countDocuments({
      user: userDoc,
    });

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
      "facebookUsername",
      "unrated",
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
    console.error(
      `POST | UPDATE | User | ID: ${escape(req.body.id)} ERROR: ${err}`
    );
    res
      .status(400)
      .send(`GET | User | ID: ${escape(req.body.id)} | ERROR: ${err}`);
  }
});

router.post(
  "/upload",
  upload.single("profileImage"),
  async function (req, res, next) {
    const { oauthID } = req.body;

    const userDoc = await global.art47db.User.findOne({ oauthID }).populate(
      "image"
    );

    console.log({ userDoc });

    console.log(
      `${PF} | POST` +
        ` | UPLOAD FILE | User: ${userDoc.oauthID}` +
        `\n${PF} | USER IMAGE: ${userDoc.image ? userDoc.image.url : null}` +
        `\n${PF} | FILE ORG NAME: ${req.file.originalname}` +
        `\n${PF} | FILE NAME: ${req.file.filename}` +
        `\n${PF} | FILE PATH: ${req.file.path}` +
        `\n${PF} | FILE DEST: ${req.file.destination}` +
        `\n${PF} | FILE MIME TYPE: ${req.file.mimetype}` +
        `\n${PF} | FILE ENC: ${req.file.encoding}` +
        `\n${PF} | FILE SIZE: ${req.file.size}`
    );

    const keyName = `${userDoc.oauthID}/images/${imageFile}`;
    const imagePath = req.file.path;

    await s3putImage({
      bucketName: bucketName,
      keyName: keyName,
      path: imagePath,
    });

    const imageUrl = `https://${bucketName}.s3.amazonaws.com/${keyName}`;
    const imageTitle = userDoc.userName || "user profile image";

    const image = new global.art47db.Image({
      title: imageTitle,
      url: imageUrl,
      fileName: imageFile,
    });

    userDoc.image = await image.save();
    await userDoc.save();

    // NEED TO SET UP TRANSFER OF IMAGE TO S3 or GOOGLE, and modify user.image
    res.json({ user: userDoc });
  }
);

router.get("/", async (req, res) => {
  try {
    console.log(`${model} | GET`);
    const docs = await global.art47db.User.find({})
      .populate("image")
      .populate("tags")
      .lean();
    console.log(`FOUND ${docs.length} ${model}s`);
    res.json(docs);
  } catch (err) {
    console.error(`GET | ${model} | ID: ${escape(req.body.id)} ERROR: ${err}`);
    res
      .status(400)
      .send(`GET | ${model} | ID: ${escape(req.body.id)} | ERROR: ${err}`);
  }
});

module.exports = router;
