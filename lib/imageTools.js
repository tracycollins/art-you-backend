const MODULE_ID_PREFIX = "IMT";
const DEFAULT_GOOGLE_STORAGE_BUCKET = "art-you";

const DEFAULT_IMAGE_TECHNOLOGY = "google";
const ONE_SECOND = 1000;
const ONE_MINUTE = 60 * ONE_SECOND;
const compactDateTimeFormat = "YYYYMMDD_HHmmss";

const DEFAULT_QUOTA_TIMEOUT_DURATION = 2 * ONE_MINUTE;

const configuration = {};
configuration.verbose = false;
configuration.imageTechnology = DEFAULT_IMAGE_TECHNOLOGY;

const path = require("path");
const debug = require("debug")("imt");
const util = require("util");
const EventEmitter = require("events");

const moment = require("moment");

const { ImageAnnotatorClient } = require("@google-cloud/vision").v1;
const visionClient = new ImageAnnotatorClient();

const { Storage } = require("@google-cloud/storage");
const storage = new Storage();
const bucketName = DEFAULT_GOOGLE_STORAGE_BUCKET;

global.artyouDb = require("@threeceelabs/mongoose-artyou");
global.dbConnection = false;

const chalk = require("chalk");
const chalkAlert = chalk.red;
const chalkError = chalk.bold.red;
const chalkLog = chalk.gray;

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

ImageTools.prototype.analyzeImage = async (p) => {
  try {
    const defaultOptions = {};
    const params = p || {};
    const imageUrl = params.imageUrl;
    const imageFile = params.imageFile;
    const artist = params.artist;
    const imageFileBase = path.parse(imageFile).name;
    const googleCloudStorageImageUri = `gs://art-you/artwork/artists/${artist}/images/${imageFile}`;
    const googleCloudStorageResultsUri = `gs://art-you/artwork/artists/${artist}/image_analysis/google/${imageFileBase}/`;
    const options = Object.assign({}, defaultOptions, params.options);
    const imageTechnology =
      params.imageTechnology || configuration.imageTechnology;
    console.log(
      chalkLog(
        `${MODULE_ID_PREFIX} | ANALYZE IMAGE | TECH: ${imageTechnology} | SOURCE: ${googleCloudStorageImageUri} | RESULT: ${googleCloudStorageResultsUri}`
      )
    );

    const features = params.features || [
      { type: "IMAGE_PROPERTIES" },
      { type: "LABEL_DETECTION" },
      { type: "FACE_DETECTION" },
    ];
    const detectType = params.detectType || "labelDetection";
    const skipQuota = {};

    if (params.imageUrl === "undefined") {
      console.error(chalkError("TIP | *** PARSER IMAGE URI UNDEFINED"));
      throw new Error("PARSER IMAGE URI UNDEFINED");
    }

    if (quotaTimeoutFlag[detectType]) {
      skipQuota[detectType] = true;

      console.log(
        chalk.yellow(
          "TIP | *** PARSE IMAGE QUOTA" +
            " | TYPE: " +
            detectType +
            " | SKIP QUOTA: " +
            Object.keys(skipQuota) +
            " | NOW: " +
            moment().format(compactDateTimeFormat) +
            " | " +
            moment(parseInt(quotaTimeoutFlag[detectType])).format(
              compactDateTimeFormat
            ) +
            " | REM: " +
            msToTime(
              parseInt(quotaTimeoutFlag[detectType] - moment().valueOf())
            )
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
    const [filesResponse] = await operation.promise();

    currentQuotaTimeoutDuration[detectType] = DEFAULT_QUOTA_TIMEOUT_DURATION;
    const results = {
      imageFile: imageFile,
      imageUrl: imageUrl,
      options: options,
      imageTechnology: imageTechnology,
      analysis: filesResponse,
    };
    return results;
  } catch (err) {
    console.log(`IMT | *** asyncBatchAnnotateImages ERROR: ${err}`);
    throw err;
  }
};

// ImageTools.prototype.analyzeImage = (p) =>
//   new Promise(function (resolve, reject) {
//     const defaultOptions = {};
//     const params = p || {};
//     const imageUrl = params.imageUrl;
//     const imageFile = params.imageFile;
//     const artist = params.artist;
//     const imageFileBase = path.parse(imageFile).name;
//     const googleCloudStorageImageUri = `gs://art-you/artwork/artists/${artist}/images/${imageFile}`;
//     const googleCloudStorageResultsUri = `gs://art-you/artwork/artists/${artist}/image_analysis/google/${imageFileBase}/`;
//     const options = Object.assign({}, defaultOptions, params.options);
//     const imageTechnology =
//       params.imageTechnology || configuration.imageTechnology;
//     console.log(
//       chalkLog(
//         `${MODULE_ID_PREFIX} | ANALYZE IMAGE | TECH: ${imageTechnology} | SOURCE: ${googleCloudStorageImageUri} | RESULT: ${googleCloudStorageResultsUri}`
//       )
//     );

//     const features = params.features || [
//       { type: "IMAGE_PROPERTIES" },
//       { type: "LABEL_DETECTION" },
//       { type: "FACE_DETECTION" },
//     ];
//     const detectType = params.detectType || "labelDetection";
//     const skipQuota = {};

//     if (params.imageUrl === "undefined") {
//       console.error(chalkError("TIP | *** PARSER IMAGE URI UNDEFINED"));
//       throw new Error("PARSER IMAGE URI UNDEFINED");
//     }

//     if (quotaTimeoutFlag[detectType]) {
//       skipQuota[detectType] = true;

//       console.log(
//         chalk.yellow(
//           "TIP | *** PARSE IMAGE QUOTA" +
//             " | TYPE: " +
//             detectType +
//             " | SKIP QUOTA: " +
//             Object.keys(skipQuota) +
//             " | NOW: " +
//             moment().format(compactDateTimeFormat) +
//             " | " +
//             moment(parseInt(quotaTimeoutFlag[detectType])).format(
//               compactDateTimeFormat
//             ) +
//             " | REM: " +
//             msToTime(
//               parseInt(quotaTimeoutFlag[detectType] - moment().valueOf())
//             )
//         )
//       );
//       throw new QuotaError(detectType);
//     }

//     const imageRequest = {
//       image: {
//         source: {
//           imageUri: googleCloudStorageImageUri,
//         },
//       },
//       features: features,
//     };

//     const outputConfig = {
//       gcsDestination: {
//         uri: googleCloudStorageResultsUri,
//       },
//       batchSize: 1, // The max number of responses to output in each JSON file
//     };

//     const request = {
//       requests: [
//         imageRequest, // add additional request objects here
//       ],
//       outputConfig,
//     };

//     visionClient
//       .asyncBatchAnnotateImages(request)
//       .then((responses) => {
//         const [operation, initialApiResponse] = responses;
//         debug({ initialApiResponse });

//         operation.on("complete", (result, metadata, finalApiResponse) => {
//           currentQuotaTimeoutDuration[
//             detectType
//           ] = DEFAULT_QUOTA_TIMEOUT_DURATION;
//           const results = {
//             imageFile: imageFile,
//             imageUrl: imageUrl,
//             options: options,
//             imageTechnology: imageTechnology,
//             finalApiResponse: finalApiResponse,
//             metadata: metadata,
//             analysis: result,
//           };
//           resolve(results);
//         });

//         operation.on("progress", (metadata, apiResponse) => {
//           debug({ metadata });
//           debug({ apiResponse });
//         });

//         operation.on("error", (err, apiResponse) => {
//           console.log({ apiResponse });
//           console.log({ err });
//           return reject(err);
//         });
//       })
//       .catch(function (err) {
//         console.log(`IMT | *** asyncBatchAnnotateImages ERROR: ${err}`);
//         return reject(err);
//       });
//   });

module.exports = ImageTools;
