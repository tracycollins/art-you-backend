const DEFAULT_PREFIX = "ART";
let PF = DEFAULT_PREFIX;

const ONE_SECOND = 1000;
const ONE_MINUTE = 60 * ONE_SECOND;

const configuration = {};
configuration.verbose = false;

const defaultDateTimeFormat = "YYYYMMDD_HHmmss";

const { fork } = require("child_process");
const ObjectID = require("mongodb").ObjectID;

const util = require("util");
const debug = require("debug")("nnt");
const EventEmitter = require("events");
const HashMap = require("hashmap").HashMap;
const defaults = require("object.defaults");
const empty = require("is-empty");
const moment = require("moment");
const _ = require("lodash");
const treeify = require("treeify");

global.art47db = require("@threeceelabs/mongoose-art47");
global.dbConnection = false;

const chalk = require("chalk");
const chalkAlert = chalk.red;
const chalkError = chalk.bold.red;
const chalkLog = chalk.gray;

const ArtworkTools = function (app_name) {
  const self = this;
  this.appname = app_name || "DEFAULT_APP_NAME";
  PF = `${this.appname}`;

  console.log(`${PF} | APP NAME: ${this.appname} | PID: ${process.pid}`);

  EventEmitter.call(this);

  setTimeout(async () => {
    try {
      global.dbConnection = await global.art47db.connect();
      console.log(`${PF} | APP ${self.appname} | CONNECTED`);

      self.emit("connect", self.appname);
      self.emit("ready", self.appname);
    } catch (err) {
      console.error(`${PF} | APP ${self.appname} | MONGO ERROR:`, err);
      self.emit("error", err);
    }
  }, 10);
};

util.inherits(ArtworkTools, EventEmitter);

ArtworkTools.prototype.verbose = function (v) {
  if (v === undefined) {
    return configuration.verbose;
  }
  configuration.verbose = v;
  console.log(chalkAlert(PF + " | --> SET VERBOSE: " + configuration.verbose));
  return;
};

ArtworkTools.prototype.getTimeStamp = function (inputTime) {
  let currentTimeStamp;

  if (inputTime == undefined) {
    currentTimeStamp = moment().format(defaultDateTimeFormat);
    return currentTimeStamp;
  } else if (moment.isMoment(inputTime)) {
    currentTimeStamp = moment(inputTime).format(defaultDateTimeFormat);
    return currentTimeStamp;
  } else if (moment.isDate(new Date(inputTime))) {
    currentTimeStamp = moment(new Date(inputTime)).format(
      defaultDateTimeFormat
    );
    return currentTimeStamp;
  } else {
    currentTimeStamp = moment(parseInt(inputTime)).format(
      defaultDateTimeFormat
    );
    return currentTimeStamp;
  }
};

const getTimeStamp = ArtworkTools.prototype.getTimeStamp;

ArtworkTools.prototype.msToTime = function (d, msf) {
  let sign = 1;

  let duration = d;
  const msFlag = msf !== undefined ? msf : false;

  if (duration < 0) {
    sign = -1;
    duration = -duration;
  }

  const ms = parseInt(duration % 1000);
  let seconds = parseInt((duration / 1000) % 60);
  let minutes = parseInt((duration / (1000 * 60)) % 60);
  let hours = parseInt((duration / (1000 * 60 * 60)) % 24);
  let days = parseInt(duration / (1000 * 60 * 60 * 24));

  days = days < 10 ? "0" + days : days;
  hours = hours < 10 ? "0" + hours : hours;
  minutes = minutes < 10 ? "0" + minutes : minutes;
  seconds = seconds < 10 ? "0" + seconds : seconds;

  if (sign > 0) {
    if (msFlag) {
      return days + ":" + hours + ":" + minutes + ":" + seconds + "." + ms;
    }
    return days + ":" + hours + ":" + minutes + ":" + seconds;
  }

  return "- " + days + ":" + hours + ":" + minutes + ":" + seconds;
};

const msToTime = ArtworkTools.prototype.msToTime;

ArtworkTools.prototype.getElapsedMS = function (inputMoment, msFlag) {
  const elapsedMS = moment().valueOf() - inputMoment.valueOf();
  return msToTime(elapsedMS, msFlag);
};

const getElapsedMS = ArtworkTools.prototype.getElapsedMS;

ArtworkTools.prototype.jsonPrint = function (obj) {
  if (obj && obj != undefined) {
    return treeify.asTree(obj, true, true);
  } else {
    return "UNDEFINED";
  }
};

ArtworkTools.prototype.jsonPrint = function (obj) {
  if (obj && obj != undefined) {
    return treeify.asTree(obj, true, true);
  } else {
    return "UNDEFINED";
  }
};

const processImagefile = async (p) => {
  const params = p || {};
  const bucketName = params.bucketName;
  const artistDoc = params.artistDoc;
  const imageFolder = params.imageFolder;
  const imageFilePath = params.imageFilePath;
  const imageAnalysisFolder = params.imageAnalysisFolder;
  const imageAnalysisFile = params.imageAnalysisFile;

  const imageFile = path.parse(imageFilePath).base;
  const imageFileSmall = imageFile.replace(
    path.parse(imageFile).ext,
    "-small" + path.parse(imageFile).ext
  );

  const imageAnalysisFile = path.parse(imageFile).name + ".json";

  const artworkImagePath = imageFilePath;
  const artworkImageSmallPath = path.join("/", imageFolder, imageFileSmall);

  const artworkImageAnalysisPath = path.join(
    "/",
    imageAnalysisFolder,
    imageAnalysisFile
  );

  const keyName = `${artistDoc.artistId}/images/${imageFile}`;

  await s3putImage({
    bucketName: bucketName,
    keyName: keyName,
    path: artworkImagePath,
  });

  const transformImageResults = await imageTools.transformImage({
    imageFilePath: artworkImagePath,
    imageOutputFilePath: artworkImageSmallPath,
  });

  console.log(
    `${PF} | processImagefile | transformImage` +
      ` | ${transformImageResults.size} B / ${transformImageResults.width}w X ${transformImageResults.height}h` +
      ` | ${artworkImageSmallPath}`
  );
  const keyNameSmall = `${artistDoc.artistId}/images/${imageFileSmall}`;

  await s3putImage({
    bucketName: bucketName,
    keyName: keyNameSmall,
    path: artworkImageSmallPath,
  });

  await fs.remove(artworkImageSmallPath);

  const artworkImageUrl = `https://${bucketName}.s3.amazonaws.com/${keyName}`;
  const imageTitle = path.parse(imageFile).name;

  const image = new global.art47db.Image({
    title: imageTitle,
    url: artworkImageUrl,
    fileName: imageFile,
  });

  const artworkId = generateArtworkId({
    artistDoc: artistDoc,
    title: imageTitle,
  });

  const artworkObj = {
    artworkId: artworkId,
    title: imageTitle,
    url: artworkImageUrl,
  };

  let artworkDoc = await global.art47db.Artwork.findOne({
    artworkId: artworkId,
  })
    .populate("recommendations")
    .populate("ratings")
    .populate("tags")
    .populate("artist")
    .populate("image");

  if (!artworkDoc) {
    artworkDoc = new global.art47db.Artwork(artworkObj);
    await artworkDoc.save(); // gets the auto generated id
  }

  const enableAnalysis =
    !googleVisionQuotaExhausted &&
    (!artworkDoc.get("imageAnalysis") || FORCE_IMAGE_ANALYSIS);
  if (enableAnalysis) {
    console.log(
      `${PF} | processImagefile | ANALYZE | ARTIST: ${artistDoc.artistId} | FILE: ${imageFile}`
    );

    try {
      const imageAnalysisResults = await imageTools.analyzeImage({
        artist: artistDoc.artistId,
        imageFile: imageFile,
      });

      artworkDoc.imageAnalysis =
        imageAnalysisResults.analysis.outputConfig.gcsDestination.uri;

      image.imageAnalysis =
        imageAnalysisResults.analysis.outputConfig.gcsDestination.uri;

      console.log(
        chalkLog(
          `${PF} | processImagefile | ANALYZED | ${imageFile} | ANALYSIS: ${artworkDoc.imageAnalysis}`
        )
      );
      artworkDoc = await updateArtworkTagsFromImageAnalysis({
        artistDoc: artistDoc,
        artworkDoc: artworkDoc,
        artworkImageAnalysisPath: artworkImageAnalysisPath,
      });
    } catch (err) {
      console.log(`${PF} | processImagefile | ANALYZE ERROR: ${err}`);
      console.log(err);
      if (err.code && err.code === 8) {
        console.log(
          `${PF} | processImagefile | ANALYZE ERROR | QUOTA EXHAUSTED`
        );
        googleVisionQuotaExhausted = true;
      }
      throw err;
    }
  } else {
    console.log(
      `${PF} | processImagefile | ANALYSIS EXSITS | ARTISTID: ${artistDoc.artistId} | FILE: ${artworkImageAnalysisPath}`
    );
  }

  artworkDoc.artist = artistDoc;
  artworkDoc.image = await image.save();
  await artworkDoc.save();

  artistDoc.artworks.addToSet(artworkDoc._id);
  await artistDoc.save();

  console.log(
    `${PF} | processImagefile` +
      ` | ARTIST: ${artistDoc.displayName}` +
      ` | ARTIST ARTWORKS: ${artistDoc.artworks.length}` +
      ` | TITLE: ${imageTitle}` +
      ` | IMAGE: ${artworkImagePath}`
  );
  return;
};

ArtworkTools.prototype.addArtwork = async function (params) {
  try {
    const artistId = params.artistId;
    const artworkObj = params.artworkObj;

    let artistDoc = await global.art47db.Artist.findOne({
      artistId: artistId,
    });

    if (!artistDoc) {
      throw new Error(`ARTIST NOT FOUND: ${artistId}`);
    }

    const googleCloudStorageDestination = `artwork/artists/${artistDoc.artistId}/images/${artworkObj.imageFile}`;

    await storage.bucket(googlStorageBucket).upload(artworkObj.imageFilePath, {
      destination: googleCloudStorageDestination,
    });

    await processImagefile({
      bucketName: bucketName,
      artistDoc: params.artistDoc,
      imageFolder: imageFolder,
      imageFilePath: imageFilePath,
      analysisFolder: params.analysisFolder,
      enableRandomImages: enableRandomImages,
    });

    await artistDoc.save();

    await loadArtworks({
      artistDoc: artistDoc,
      imageFolder: currentArtistArtworkImagesFolder,
      analysisFolder: currentArtistArtworkImageAnalysisFolder,
    });

    stats.artists.processed += 1;
    console.log(
      chalk.blue(
        `${PF} | +++ ARTIST [${stats.artists.processed}]` +
          ` _ID: ${artistDoc._id}` +
          ` | ID: ${artistDoc.id}` +
          ` | ${artistDoc.displayName}` +
          ` | ${artistDoc.artworks.length} ARTWORKS` +
          ` | IMG: ${artistImageUrl}`
      )
    );

    return;
  } catch (err) {
    console.log(`DB processArtistArtworkFile | *** ERROR: ${err}`);
    throw err;
  }
};

module.exports = ArtworkTools;
