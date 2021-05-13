const MODULE_ID_PREFIX = "IMT";
const DEFAULT_GOOGLE_STORAGE_BUCKET = "art47";

const DEFAULT_IMAGE_TECHNOLOGY = "google";
// const DEFAULT_IMAGE_FORMAT = "webp";
const DEFAULT_IMAGE_WIDTH = 300;
const DEFAULT_IMAGE_HEIGHT = 300;
// const DEFAULT_IMAGE_QUALITY = 100;
const DEFAULT_IMAGE_CROP = "cover";
// time
const ONE_SECOND = 1000;
const ONE_MINUTE = 60 * ONE_SECOND;
const compactDateTimeFormat = "YYYYMMDD_HHmmss";

const DEFAULT_QUOTA_TIMEOUT_DURATION = 2 * ONE_MINUTE;
const DEFAULT_IMAGE_PARSE_REQUEST_TIMEOUT = ONE_MINUTE;
const DEFAULT_IMAGE_QUOTA_TIMEOUT_DURATION = 1.1 * ONE_MINUTE;

const configuration = {};
configuration.verbose = false;
configuration.imageTechnology = DEFAULT_IMAGE_TECHNOLOGY;
configuration.parseImageRequestTimeout = DEFAULT_IMAGE_PARSE_REQUEST_TIMEOUT;
configuration.imageQuotaTimeoutDuration = DEFAULT_IMAGE_QUOTA_TIMEOUT_DURATION;
configuration.currentImageQuotaTimoutDuration =
  DEFAULT_IMAGE_QUOTA_TIMEOUT_DURATION;

const sharp = require("sharp");

const path = require("path");
// const debug = require("debug")("imt");
const util = require("util");
const EventEmitter = require("events");
const treeify = require("treeify");
const moment = require("moment");

const { ImageAnnotatorClient } = require("@google-cloud/vision").v1;
const visionClient = new ImageAnnotatorClient();

const { Storage } = require("@google-cloud/storage");
const storage = new Storage();
const bucketName = DEFAULT_GOOGLE_STORAGE_BUCKET;

global.art47db = require("@threeceelabs/mongoose-art47");
global.dbConnection = false;

const chalk = require("chalk");
const chalkAlert = chalk.red;
// const chalkError = chalk.bold.red;
const chalkLog = chalk.gray;
const chalkInfo = chalk.black;

const currentQuotaTimeoutDuration = {};
currentQuotaTimeoutDuration.faceDetection = DEFAULT_QUOTA_TIMEOUT_DURATION;
currentQuotaTimeoutDuration.labelDetection = DEFAULT_QUOTA_TIMEOUT_DURATION;
currentQuotaTimeoutDuration.textDetection = DEFAULT_QUOTA_TIMEOUT_DURATION;

const quotaTimeout = {};
quotaTimeout.faceDetection = false;
quotaTimeout.labelDetection = false;
quotaTimeout.textDetection = false;

const quotaTimeoutFlag = {};
quotaTimeoutFlag.faceDetection = false;
quotaTimeoutFlag.labelDetection = false;
quotaTimeoutFlag.textDetection = false;

const statsObj = {};
statsObj.imageAnalyzer = {};
statsObj.imageAnalyzer.parsed = 0;
statsObj.imageAnalyzer.errors = 0;
statsObj.imageAnalyzer.imageQuotaType = "";
statsObj.imageAnalyzer.imageQuotaResetAt = false;
statsObj.parseImageReady = true;
statsObj.parseImageReadyResetMoment = moment();

class CustomError extends Error {
  constructor(message) {
    super(message);
    // Ensure the name of this error is the same as the class name
    this.name = this.constructor.name;
    // This clips the constructor invocation from the stack trace.
    // It's not absolutely essential, but it does make the stack trace a little nicer.
    //  @see Node.js reference (bottom)
    Error.captureStackTrace(this, this.constructor);
  }
}

class QuotaError extends CustomError {
  constructor(type) {
    super(`QUOTA ${type}`);
    this.code = 8;
    this.type = type;
  }
}

const ImageTools = function (app_name) {
  const self = this;
  this.appname = app_name || "DEFAULT_APP_NAME";
  console.log(`${MODULE_ID_PREFIX} | APP NAME: ${this.appname}`);

  EventEmitter.call(this);

  setTimeout(async () => {
    try {
      const [metadata] = await storage.bucket(bucketName).getMetadata();
      console.log(`${MODULE_ID_PREFIX} | =====================`);
      console.log(`${MODULE_ID_PREFIX} | BUCKET: ${bucketName}`);
      for (const [key, value] of Object.entries(metadata)) {
        console.log(
          `${MODULE_ID_PREFIX} | BUCKET: ${bucketName} | ${key}: ${value}`
        );
      }
      console.log(`${MODULE_ID_PREFIX} | =====================`);
    } catch (err) {
      console.log(`${MODULE_ID_PREFIX} | ERROR: ${err}`);
      throw err;
    }
    self.emit("ready", self.appname);
  }, 100);
};

util.inherits(ImageTools, EventEmitter);

ImageTools.prototype.getTimeStamp = function (inputTime) {
  let currentTimeStamp;

  if (inputTime == undefined) {
    currentTimeStamp = moment().format(compactDateTimeFormat);
    return currentTimeStamp;
  } else if (moment.isMoment(inputTime)) {
    currentTimeStamp = moment(inputTime).format(compactDateTimeFormat);
    return currentTimeStamp;
  } else if (moment.isDate(new Date(inputTime))) {
    currentTimeStamp = moment(new Date(inputTime)).format(
      compactDateTimeFormat
    );
    return currentTimeStamp;
  } else {
    currentTimeStamp = moment(parseInt(inputTime)).format(
      compactDateTimeFormat
    );
    return currentTimeStamp;
  }
};

const getTimeStamp = ImageTools.prototype.getTimeStamp;

ImageTools.prototype.msToTime = function (d, msf) {
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

const msToTime = ImageTools.prototype.msToTime;

ImageTools.prototype.getElapsedMS = function (inputMoment, msFlag) {
  const elapsedMS = moment().valueOf() - inputMoment.valueOf();
  return msToTime(elapsedMS, msFlag);
};

ImageTools.prototype.jsonPrint = function (obj) {
  if (obj && obj != undefined) {
    return treeify.asTree(obj, true, true);
  } else {
    return "UNDEFINED";
  }
};

ImageTools.prototype.verbose = function (v) {
  if (v === undefined) {
    return configuration.verbose;
  }
  configuration.verbose = v;
  console.log(
    chalkAlert(
      MODULE_ID_PREFIX + " | --> SET VERBOSE: " + configuration.verbose
    )
  );
  return;
};

ImageTools.prototype.setImageQuotaTimeoutDuration = function (duration) {
  configuration.imageQuotaTimeoutDuration = duration;
  configuration.currentImageQuotaTimoutDuration = duration;
  console.log(
    chalkLog(
      `${MODULE_ID_PREFIX} | ---> SET IMAGE QUOTA TIMEOUT DURATION: ${duration}`
    )
  );
};

ImageTools.prototype.getImageQuotaTimeoutDuration = function () {
  return configuration.imageQuotaTimeoutDuration;
};

let imageQuotaTimeOut;

function startImageQuotaTimeOutTimer(p) {
  const params = p || {};
  const duration = params.duration || configuration.imageQuotaTimeoutDuration;

  clearTimeout(imageQuotaTimeOut);

  console.log(
    chalkAlert(
      MODULE_ID_PREFIX +
        " | *** START IMAGE QUOTA TIMEOUT" +
        " | " +
        getTimeStamp(0) +
        " | TYPE: " +
        statsObj.imageAnalyzer.imageQuotaType +
        " | DUR: " +
        msToTime(duration) +
        " | RESET: " +
        moment().add(duration, "ms").format(compactDateTimeFormat)
    )
  );

  imageQuotaTimeOut = setTimeout(function () {
    statsObj.imageAnalyzer.imageQuotaResetAt = false;

    console.log(
      chalkInfo(
        MODULE_ID_PREFIX +
          " | --- END IMAGE QUOTA TIMEOUT" +
          " | " +
          getTimeStamp(0) +
          " | TYPE: " +
          statsObj.imageAnalyzer.imageQuotaType +
          " | DUR: " +
          msToTime(duration)
      )
    );
  }, duration);
}

ImageTools.prototype.transformImage = async (p) => {
  try {
    const params = p || {};
    const width = params.width || DEFAULT_IMAGE_WIDTH;
    const height = params.width || DEFAULT_IMAGE_HEIGHT;
    const crop = params.crop || DEFAULT_IMAGE_CROP;
    const imageFilePath = params.imageFilePath;
    const imageOutputFilePath = params.imageOutputFilePath;

    const results = await sharp(imageFilePath)
      .resize(width, height, { fit: crop })
      .toFile(imageOutputFilePath);
    //
    return results;
  } catch (err) {
    console.log(`IMT | *** transformImage ERROR: ${err}`);
    console.log({ p });
    throw err;
  }
};

ImageTools.prototype.analyzeImage = async (params) => {
  try {
    const defaultOptions = {};
    const imageFile = params.imageFile;
    const artist = params.artist;
    const imageFileBase = path.parse(imageFile).name;
    const googleCloudStorageImageUri = `gs://${bucketName}/artwork/artists/${artist}/images/${imageFile}`;
    const googleCloudStorageResultsUri = `gs://${bucketName}/artwork/artists/${artist}/image_analysis/google/${imageFileBase}/`;
    const options = Object.assign({}, defaultOptions, params.options);
    const features = params.features || [
      { type: "IMAGE_PROPERTIES" },
      { type: "LABEL_DETECTION" },
      { type: "FACE_DETECTION" },
    ];
    const detectType = params.detectType || "labelDetection";
    const skipQuota = {};
    //
    const imageTechnology =
      params.imageTechnology || configuration.imageTechnology;
    console.log(
      chalkLog(
        `${MODULE_ID_PREFIX} | ANALYZE IMAGE | TECH: ${imageTechnology} | SOURCE: ${googleCloudStorageImageUri}`
      )
    );
    console.log(
      chalkLog(
        `${MODULE_ID_PREFIX} | ANALYZE IMAGE | TECH: ${imageTechnology} | RESULT: ${googleCloudStorageResultsUri}`
      )
    );

    if (quotaTimeoutFlag[detectType]) {
      skipQuota[detectType] = true;

      console.log(
        chalk.yellow(
          `IMT | *** PARSE IMAGE QUOTA | TYPE: ${detectType}` +
            ` | SKIP QUOTA: ${Object.keys(skipQuota)}` +
            ` | NOW: ${moment().format(compactDateTimeFormat)}` +
            ` | ${moment(parseInt(quotaTimeoutFlag[detectType])).format(
              compactDateTimeFormat
            )}` +
            ` | REM: ${parseInt(
              quotaTimeoutFlag[detectType] - moment().valueOf()
            )}`
        )
      );
      throw new QuotaError(detectType);
    }

    const imageRequest = {
      image: {
        source: {
          imageUri: googleCloudStorageImageUri,
        },
      },
      features: features,
    };

    const outputConfig = {
      gcsDestination: {
        uri: googleCloudStorageResultsUri,
      },
      batchSize: 1, // The max number of responses to output in each JSON file
    };

    const request = {
      requests: [
        imageRequest, // add additional request objects here
      ],
      outputConfig,
    };

    const [operation] = await visionClient.asyncBatchAnnotateImages(request);

    operation.on("error", (err) => {
      console.log({ err });
    });
    const [filesResponse] = await operation.promise();

    currentQuotaTimeoutDuration[detectType] = DEFAULT_QUOTA_TIMEOUT_DURATION;
    const results = {
      imageFile: imageFile,
      // imageUrl: imageUrl,
      options: options,
      imageTechnology: imageTechnology,
      analysis: filesResponse,
    };
    return results;
  } catch (err) {
    console.log(`IMT | *** analyzeImage ERROR: ${err}`);

    if (err.code === 8) {
      quotaTimeoutFlag[params.detectType] = err;
      console.log(
        `IMT | *** asyncBatchAnnotateImages | QUOTA EXHAUSTED | ERROR: ${err}`
      );

      statsObj.imageAnalyzer.imageQuotaType = err.type;
      statsObj.imageAnalyzer.imageQuotaResetAt =
        moment().valueOf() + configuration.currentImageQuotaTimoutDuration;
      err.resetAt = statsObj.imageAnalyzer.imageQuotaResetAt;

      startImageQuotaTimeOutTimer({
        duration: configuration.currentImageQuotaTimoutDuration,
      });
      configuration.currentImageQuotaTimoutDuration *=
        configuration.backoffMultiplier;

      statsObj.imageQuotaError = {};
      statsObj.imageQuotaError = err;

      if (params.returnNullOnQuotaExhausted) {
        return;
      }
    }
    throw err;
  }
};

module.exports = ImageTools;
