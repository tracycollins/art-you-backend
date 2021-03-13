/* eslint-disable no-undef */

// ORDER IS IMPORTANT!
const MODELS = ["Artist", "Artwork", "Tag", "User", "Rating", "Recommendation"];

const ENABLE_FAKE = true;
const ENABLE_LOAD_ARTISTS = true;
const FORCE_IMAGE_ANALYSIS = false;
const DEFAULT_MODEL_NUMBERS = {
  Tag: 0,
  Artist: 20,
  Artwork: 0,
  Rating: 0,
  Recommendation: 0,
  User: 0,
};

const DEFAULT_IMAGE_FILE_USED_FILE_PATH =
  "/Volumes/RAID1/projects/art-you-backend/imageFileUsed.json";

let googleVisionQuotaExhausted = false;

const DEFAULT_GOOGLE_STORAGE_BUCKET = "art-you";

const MAX_GOOGLE_FAKE_IMAGE_ANALYSIS_TAGS = 10;
const defaultMaxRandomImages = 3;
const compactDateTimeFormat = "YYYYMMDD_HHmmss";

const moment = require("moment");
const fs = require("fs-extra");
const jsonfile = require("jsonfile");
const _ = require("lodash");
const path = require("path");
const walker = require("walker");
const faker = require("faker");
const mkdirp = require("mkdirp");
const randomInt = require("random-int");
const colorNamer = require("color-namer");
const { Storage } = require("@google-cloud/storage");
const storage = new Storage();
const googlStorageBucket = DEFAULT_GOOGLE_STORAGE_BUCKET;

const chalk = require("chalk");
// const chalkWarn = chalk.yellow;
const chalkAlert = chalk.red;
const chalkError = chalk.bold.red;
const chalkLog = chalk.gray;

const S3Client = require("../lib/awsS3Client.js");
const awsS3Client = new S3Client();

global.artyouDb = require("@threeceelabs/mongoose-artyou");
global.dbConnection = false;

const ImageTools = require("../lib/imageTools.js");
const imageTools = new ImageTools("SEED_IMT");
imageTools.on("ready", async (appName) => {
  console.log(`IMT | READY | APP NAME: ${appName}`);
});
const DEFAULT_ARTISTS_FOLDER = "/Users/tc/Dropbox/Apps/art-you/artwork/artists";
const DEFAULT_FAKE_ARTISTS_FOLDER =
  "/Users/tc/Dropbox/Apps/art-you-fake/artwork/artists";
// const artistsRootFolder = DEFAULT_ARTISTS_FOLDER;

const modelsArray = [
  "Artwork",
  "Artist",
  "User",
  "Tag",
  "Rating",
  "Recommendation",
];
const configuration = {};
configuration.maxArtworksToSeed = Infinity;

const stats = {};
stats.artists = {};
stats.artists.processed = 0;

stats.artworks = {};
stats.artworks.seeded = 0;
stats.walk = {};
stats.walk.complete = false;

const defaultArtistInfoFileName = "artist_info.json";
const defaultArtistImageFileName = "artist_image.jpg";
const defaultArtistImageSmallFileName = "artist_image-small.jpg";

const defaultSeedRootDir =
  process.env.ARTYOU_SEED_ROOT_DIR || "/Users/tc/Dropbox/Apps/art-you";
const defaultSeedDataDir = path.join("/", defaultSeedRootDir, "data");
const defaultImageSeedDir = path.join("/", defaultSeedDataDir, "images");

const defaultFakeSeedRootDir =
  process.env.ARTYOU_FAKE_SEED_ROOT_DIR ||
  "/Users/tc/Dropbox/Apps/art-you-fake";

// REAL ARTISTS AND ARTWORK
// const defaultArtworkSeedDir = path.join("/", defaultSeedRootDir, "artwork")
// const defaultArtistsSeedDir = path.join("/", defaultArtworkSeedDir, "artists")
// const defaultUsersSeedDir = path.join("/", defaultSeedRootDir, "users")

// FAKE ARTISTS AND ARTWORK
const defaultFakeArtworkSeedDir = path.join(
  "/",
  defaultFakeSeedRootDir,
  "artwork"
);
const defaultFakeArtistsSeedDir = path.join(
  "/",
  defaultFakeArtworkSeedDir,
  "artists"
);
// const defaultFakeUsersSeedDir = path.join("/", defaultFakeSeedRootDir, "users")

// CLOUD DEFAULTS
const defaultArtistsRootUrl =
  process.env.ARTYOU_ARTISTS_ROOT_URL ||
  "https://art-you-artists.s3.amazonaws.com";
// const defaultUsersRootUrl = process.env.ARTYOU_USERS_ROOT_URL || "https://art-you-users.s3.amazonaws.com"
const defaultArtworksRootUrl =
  process.env.ARTYOU_ARTWORKS_ROOT_URL ||
  "https://art-you-artworks.s3.amazonaws.com";

const dbStats = async () => {
  const stats = {};

  for (const Model of modelsArray) {
    stats[Model] = {};
    stats[Model].total = await global.artyouDb[Model].countDocuments();
  }
  return stats;
};
const getTimeStamp = (inputTime) => {
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

const imageFileUsedFilePath = DEFAULT_IMAGE_FILE_USED_FILE_PATH;
let imageFileUsedHashMap = {};

const getRandomFilePath = async (params) => {
  const files = fs.readdirSync(params.folder);
  let randomFile = _.sample(files);

  while (imageFileUsedHashMap[randomFile] !== undefined) {
    randomFile = _.sample(files);
  }

  imageFileUsedHashMap[randomFile] =
    params.meta !== undefined ? params.meta : getTimeStamp();
  jsonfile.writeFileSync(imageFileUsedFilePath, imageFileUsedHashMap);

  const randomFilePath = path.join("/", params.folder, randomFile);
  return randomFilePath;
};

const getRandomImageFilePath = async (p) => {
  const params = p || {};
  const folder = params.folder || defaultImageSeedDir;
  const randomFilePath = await getRandomFilePath({
    folder: folder,
    unique: params.unique,
    meta: params.meta,
  });
  return randomFilePath;
};

const getRandomDoc = async (params) => {
  const docs = await global.artyouDb[params.model].find({}).select("id").lean();
  const randomDoc = await global.artyouDb[params.model].findOne({
    id: _.sample(docs).id,
  });
  return randomDoc;
};

// const fakeImage = async (params) => {
//   const seedRootDir = params.seedRootDir || defaultFakeSeedRootDir;
//   let filePath = "";
//   let keyName = "";
//   let imageUrl = "";
//   let bucketName = "";

//   switch (params.imageType) {
//     case "artist":
//       bucketName = "art-you-artists";
//       filePath =
//         params.filePath ||
//         path.join("/", seedRootDir, params.artist, defaultArtistImageFileName);
//       keyName = `${params.artist}/${defaultArtistImageFileName}`;
//       imageUrl = `${defaultArtistsRootUrl}/${params.artist}/${defaultArtistImageFileName}`;
//       imageTitle = path.parse(defaultArtistImageFileName).name;
//       break;
//     case "user":
//       bucketName = "art-you-users";
//       filePath =
//         params.filePath ||
//         path.join(
//           "/",
//           seedRootDir,
//           params.user,
//           "images",
//           params.imageFileName
//         );
//       keyName = `${params.user}/images/${params.imageFileName}`;
//       imageUrl = `${defaultArtworksRootUrl}/${params.user}/images/${params.imageFileName}`;
//       imageTitle = path.parse(params.imageFileName).name;
//       break;
//     case "artwork":
//       bucketName = "art-you-artworks";
//       filePath =
//         params.filePath ||
//         path.join(
//           "/",
//           seedRootDir,
//           params.artist,
//           "images",
//           params.imageFileName
//         );
//       keyName = `${params.artist}/images/${params.imageFileName}`;
//       imageUrl = `${defaultArtworksRootUrl}/${params.artist}/images/${params.imageFileName}`;
//       imageTitle = path.parse(params.imageFileName).name;
//       break;
//     default:
//       console.log(
//         `DB | SEED | fakeImage | *** UNKNOWN imageType: ${params.imageType}`
//       );
//       throw new Error(
//         `DB | SEED | fakeImage | *** UNKNOWN imageType: ${params.imageType}`
//       );
//   }

//   const s3putImageOptions = {
//     bucketName: params.bucketName || bucketName,
//     keyName: params.keyName || keyName,
//     file: filePath,
//   };

//   await s3putImage(s3putImageOptions);

//   const dbImageObj = {
//     title: params.title || imageTitle,
//     description: params.description || faker.lorem.sentences(),
//     url: params.imageUrl || imageUrl,
//     fileName: params.imageFileName || path.parse(params.filePath).name,
//   };

//   const image = new global.artyouDb.Image(dbImageObj);

//   const newImage = await image.save();
//   return newImage;
// };

const initFakeArtist = async (params) => {
  const artistObj = params.artistObj;
  const artist = artistObj.userName.toLowerCase();

  console.log(
    chalk.blue(
      `DB | SEED | initFakeArtist | ARTIST: ${artist} ARTISTID: ${artistObj.artistId} | INDEX: ${params.index}`
    )
  );

  const artistFolderPath = path.join(
    "/",
    defaultFakeArtistsSeedDir,
    artistObj.artistId
  );
  const artistInfoJsonFilePath = path.join(
    "/",
    artistFolderPath,
    defaultArtistInfoFileName
  );
  const artistImageFilePath = path.join(
    "/",
    artistFolderPath,
    defaultArtistImageFileName
  );

  mkdirp.sync(path.join("/", artistFolderPath, "images"));
  mkdirp.sync(path.join("/", artistFolderPath, "image_analysis/google"));

  jsonfile.writeFileSync(artistInfoJsonFilePath, artistObj);
  const randomImageFilePath = await getRandomImageFilePath({ unique: true });

  await fs.copy(randomImageFilePath, artistImageFilePath);

  return;
};

const updateDbModel = async (params) => {
  const modelObj = params.modelObj;
  console.error(
    `DB | SEED | updateDbModel | ${params.index} | ${modelObj.type}`
  );
  try {
    let dbDoc = await global.artyouDb[modelObj.type].findOne({
      id: modelObj.id,
    });

    const results = {};

    if (dbDoc) {
      results.hit = true;
    } else {
      dbDoc = new global.artyouDb[modelObj.type](modelObj);
      dbDoc = await dbDoc.save();

      results.new = true;
    }

    return dbDoc;
  } catch (err) {
    console.error(
      `DB | SEED | *** INDEX: ${params.index} | ${modelObj.type} | ERROR: ${err}`
    );
    throw err;
  }
};

const fakeDoc = async (params) => {
  const model = params.model;
  const id = params.id;
  let modelObj;
  let dbDoc;

  try {
    console.log(
      `DB | SEED | fakeDoc | model: ${model} | INDEX: ${params.index}`
    );

    // const randomImageFilePath = await getRandomImageFilePath({ unique: true });

    switch (model) {
      case "Artist":
        modelObj = {
          type: model,
          userName: faker.internet.userName().toLowerCase(),
          url: faker.internet.url(),
          firstName: faker.name.firstName(),
          middleName: faker.name.middleName().toUpperCase(),
          lastName: faker.name.lastName(),
          bio: faker.lorem.sentences(),
          location: faker.address.city(),
          birthDate: faker.date.past(),
          deathDate: faker.date.recent(),
        };

        modelObj.name = `${modelObj.firstName} ${modelObj.middleName} ${modelObj.lastName}`;
        modelObj.displayName = modelObj.name;

        modelObj.artistId = generateArtistId(modelObj);

        await initFakeArtist({ artistObj: modelObj, index: params.index });

        dbDoc = await updateDbModel({
          modelObj: modelObj,
          index: params.index,
        });

        await loadArtworks({
          enableRandomImages: true,
          artistDoc: dbDoc,
          imageFolder: `${defaultFakeArtistsSeedDir}/${dbDoc.artistId}/images`,
          analysisFolder: `${defaultFakeArtistsSeedDir}/${dbDoc.artistId}/image_analysis/google`,
        });

        break;

      case "User":
        modelObj = {
          type: model,
          id: "user_" + Date.now(),
          userName: faker.internet.userName().toLowerCase(),
          url: faker.internet.url(),
          firstName: faker.name.firstName(),
          middleName: faker.name.middleName(),
          lastName: faker.name.lastName(),
          bio: faker.lorem.sentences(),
          location: faker.address.city(),
          birthDate: faker.date.past(),
        };

        // modelObj.image = await fakeImage({
        //   imageType: "user",
        //   user: faker.internet.userName().toLowerCase(),
        //   filePath: randomImageFilePath,
        // });

        dbDoc = await updateDbModel({
          modelObj: modelObj,
          index: params.index,
        });

        break;

      case "Artwork":
        modelObj = {
          type: model,
          id: "artwork_" + Date.now(),
          title: faker.random.words(),
          description: faker.lorem.paragraph(),
          medium: faker.music.genre(),
        };

        modelObj.artist = await getRandomDoc({ model: "Artist" });

        // await fs.copy(randomImageFilePath, artistImageFilePath);

        // modelObj.image = await fakeImage({
        //   imageType: "artwork",
        //   artist: modelObj.artist.userName,
        //   imageFileName: path.basename(randomImageFilePath),
        // });

        dbDoc = await updateDbModel({
          modelObj: modelObj,
          index: params.index,
        });

        break;

      case "Rating":
        modelObj = {
          rate: Math.random(),
        };

        modelObj.user = await getRandomDoc({ model: "User" });
        modelObj.artwork = await getRandomDoc({ model: "Artwork" });

        await modelObj.save();

        break;

      case "Recommendation":
        modelObj = {
          id: "recommendation_" + Date.now(),
          score: Math.random(),
        };

        modelObj.user = await getRandomDoc({ model: "User" });
        modelObj.artwork = await getRandomDoc({ model: "Artwork" });
        break;

      case "Tag":
        modelObj = {
          type: model,
          id: id || faker.random.word().toLowerCase(),
        };

        dbDoc = await updateDbModel({
          modelObj: modelObj,
          index: params.index,
        });

        break;

      default:
        console.error(
          `DB | SEED | *** fakeDoc | INDEX: ${params.index} | ${model} | ERROR: UNKNOWN MODEL TYPE: ${model}`
        );
        throw new Error(`UNKNOWN MODEL TYPE: ${model}`);
    }

    return dbDoc;
  } catch (err) {
    console.error(
      `DB | SEED | *** INDEX: ${params.index} | ${model} | ERROR: ${err}`
    );
    throw err;
  }
};

const createDocs = async (params) => {
  try {
    console.log(
      chalk.blue(
        `DB | SEED | createDocs | START | MODEL: ${params.model} | NUM: ${params.number}`
      )
    );

    const newDocArray = [];

    for (let index = 0; index < params.number; index++) {
      params.index = index;
      const newDoc = await fakeDoc(params);
      newDocArray.push(newDoc);
    }

    return newDocArray;
  } catch (err) {
    console.error("DB | SEED | *** seedDb | ERROR: " + err);
    throw err;
  }
};

const artistRegex = /artwork\/artists\/(.+?)\//;
const artistNameReplaceRegex = /\W/g;

const generateArtistId = (artistObj) => {
  if (
    artistObj.instagram_username !== undefined &&
    artistObj.instagram_username.startsWith("@")
  ) {
    return artistObj.instagram_username.toLowerCase();
  }

  if (
    artistObj.twitter_username !== undefined &&
    artistObj.twitter_username.startsWith("@")
  ) {
    return artistObj.twitter_username.toLowerCase();
  }

  if (artistObj.name !== undefined) {
    return artistObj.name
      .trim()
      .toLowerCase()
      .replace(artistNameReplaceRegex, "");
  }
};

const generateArtworkId = (params) => {
  const title = params.title.replace(artistNameReplaceRegex, "");
  const artworkId = `artist_id_${params.artistDoc.id}_title_${title}`
    .trim()
    .toLowerCase();
  return artworkId;
};

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
    console.log(chalkError(`DB | SEED | *** s3putImage ERROR: ${err}`));
    throw err;
  }
};

const fileQueue = [];
let fileQueueInterval;
let fileQueueReady = true;

const initfileQueueInterval = async (params) => {
  clearInterval(fileQueueInterval);

  fileQueueInterval = setInterval(async () => {
    if (fileQueueReady && stats.walk.complete && fileQueue.length === 0) {
      console.log(
        chalkAlert(
          `DB | SEED | XXX MAX ARTWORKS SEEDED: ${stats.artworks.seeded}/${configuration.maxArtworksToSeed} | QUITTING ...`
        )
      );
      clearInterval(fileQueueInterval);
      fileQueue.length = 0;
    } else if (fileQueueReady && fileQueue.length > 0) {
      fileQueueReady = false;
      const file = fileQueue.shift();
      await processArtistArtworkFile({ file: file });
      fileQueueReady = true;
    }
  }, params.interval);

  return;
};

const processArtistArtworkFile = async (params) => {
  try {
    const file = params.file;
    const artistMatchArray = artistRegex.exec(file);
    const artist =
      artistMatchArray && artistMatchArray[1] ? artistMatchArray[1] : false;
    // console.log(`DB | SEED | processArtistArtworkFile: ${artist} ${file}`);
    if (artist && path.parse(file).base === `${artist}.json`) {
      await fs.move(
        file,
        `${path.parse(file).dir}/${defaultArtistInfoFileName}`
      );
    }

    if (artist && path.parse(file).base === defaultArtistInfoFileName) {
      console.log(
        chalk.blue(
          `DB | SEED | -------------------------------------------------------`
        )
      );
      console.log(chalk.blue(`DB | SEED | PROCESSING ARTIST: ${artist}`));
      console.log(
        chalk.blue(
          `DB | SEED | -------------------------------------------------------`
        )
      );
      const currentArtistFolder = path.parse(file).dir;
      const currentArtistArtworkImagesFolder = path.join(
        "/",
        currentArtistFolder,
        "images"
      );
      const currentArtistArtworkImageAnalysisFolder = path.join(
        "/",
        currentArtistFolder,
        "image_analysis/google"
      );
      const artistInfoObj = await jsonfile.readFile(file);

      console.log(`DB | SEED | ARTIST INFO JSON: ${file}`);

      const artistId = generateArtistId(artistInfoObj);

      const artistObj = {
        // id: artistId,
        artistId: artistId,
        oauthID: artistInfoObj.oauthID,
        displayName: artistInfoObj.name,
        userName: artistInfoObj.name,
        instagramUsername: artistInfoObj.instagram_username,
        twitterUsername: artistInfoObj.twitter_username,
        facebookUrl: artistInfoObj.facebook_url,
        artistUrl: artistInfoObj.artist_url,
        wikipediaUrl: artistInfoObj.wikipedia_url,
        bio: artistInfoObj.bio,
        location: faker.address.city(),
        birthDate: artistInfoObj.birthdate,
        deathDate: artistInfoObj.deathdate,
      };

      let artistDoc = await global.artyouDb.Artist.findOne({
        artistId: artistId,
      }).populate("image");

      if (!artistDoc) {
        artistDoc = new global.artyouDb.Artist(artistObj);
      }

      const artistImagePath = path.join(
        "/",
        currentArtistFolder,
        defaultArtistImageFileName
      );

      const artistImageSmallPath = path.join(
        "/",
        currentArtistFolder,
        defaultArtistImageSmallFileName
      );

      await s3putImage({
        bucketName: "art-you-artists",
        keyName: `${artist}/${defaultArtistImageFileName}`,
        path: artistImagePath,
      });

      const transformImageResults = await imageTools.transformImage({
        imageFilePath: artistImagePath,
        imageOutputFilePath: artistImageSmallPath,
      });

      console.log(
        `DB | SEED | processArtistArtworkFile | transformImage` +
          ` | ${transformImageResults.size} B / ${transformImageResults.width}w X ${transformImageResults.height}h` +
          ` | ${artistImageSmallPath}`
      );

      await s3putImage({
        bucketName: "art-you-artists",
        keyName: `${artist}/${defaultArtistImageSmallFileName}`,
        path: artistImageSmallPath,
      });

      await fs.remove(artistImageSmallPath);

      const artistImageUrl = `${defaultArtistsRootUrl}/${artist}/${defaultArtistImageFileName}`;

      const image = new global.artyouDb.Image({
        title: artistInfoObj.name,
        url: artistImageUrl,
        fileName: `${artist}/${defaultArtistImageFileName}`,
      });

      artistDoc.image = await image.save();
      await artistDoc.save();

      await loadArtworks({
        artistDoc: artistDoc,
        imageFolder: currentArtistArtworkImagesFolder,
        analysisFolder: currentArtistArtworkImageAnalysisFolder,
      });

      stats.artists.processed += 1;
      console.log(
        `DB | SEED | +++ ARTIST | PROCESSED: ${stats.artists.processed} | ${artistDoc.displayName} | IMAGE: ${artistImageUrl}`
      );

      return;
    }
  } catch (err) {
    console.log(`DB processArtistArtworkFile | *** ERROR: ${err}`);
    throw err;
  }
};

const walk = function (params) {
  return new Promise(function (resolve, reject) {
    console.log(chalk.blue(`DB | SEED | START WALK | ${params.folder}`));
    const results = {};
    stats.walk.complete = false;

    walker(params.folder)
      .on("file", async function (file) {
        if (path.parse(file).name.endsWith("small")) {
          console.log(
            `DB | SEED | FQ: ${fileQueue.length} | --- SKIP FILE: ${file}`
          );
        } else {
          // console.log(`DB | SEED | FQ: ${fileQueue.length} | FILE: ${file}`);
          if (
            configuration.maxArtworksToSeed > 0 &&
            stats.artworks.seeded < configuration.maxArtworksToSeed
          ) {
            fileQueue.push(file);
            if (fileQueue.length % 100 === 0)
              console.log(
                `DB | SEED | FQ: ${fileQueue.length} | ${stats.artworks.seeded}`
              );
          }
        }
      })
      .on("error", function (err, entry) {
        console.error(
          `DB | SEED | *** ERROR *** | ENTRY: ${entry} | ERROR: ${err}`
        );
        return reject(err);
      })
      .on("end", function () {
        console.log(`DB | SEED | FOLDER WALK COMPLETE | ${params.folder}`);
        stats.walk.complete = true;
        resolve(results);
      });
  });
};

const loadArtists = async (p) => {
  try {
    const params = p || {};

    console.log(`DB | SEED | loadArtists | START | FOLDER: ${params.folder}`);

    const results = await walk({ folder: params.folder });

    return results;
  } catch (err) {
    console.error("DB | SEED | *** seedDb | ERROR: " + err);
    throw err;
  }
};

const fakeGoogleImageAnalysis = async (p) => {
  // {
  //   "responses": [
  //     {
  //       "labelAnnotations": [
  //         {
  //           "mid": "/m/068jd",
  //           "description": "Photograph",
  //           "score": 0.95274854,
  //           "topicality": 0.95274854
  //         }
  //       ]
  //     }
  //   ]
  // }

  try {
    const params = p || {};
    const maxTags = params.maxTags || MAX_GOOGLE_FAKE_IMAGE_ANALYSIS_TAGS;
    const numTags = params.numTags || randomInt(maxTags);

    const analysis = {};
    analysis.responses = [];

    const response = {};
    response.labelAnnotations = [];

    for (let index = 0; index < numTags; index++) {
      const tag = {};
      tag.mid = "/m/0" + randomInt(100) + faker.vehicle.vrm().toLowerCase();
      tag.description = faker.random.word();
      tag.score = Math.random();
      tag.topicality = tag.score;

      response.labelAnnotations.push(tag);

      await fakeDoc({
        model: "Tag",
        id: tag.description.toLowerCase(),
        index: index,
      });
    }

    analysis.responses.push(response);

    return analysis;
  } catch (err) {
    console.error("DB | SEED | *** fakeGoogleImageAnalysis | ERROR: " + err);
    throw err;
  }
};

const fakeImageAnalysis = async (p) => {
  try {
    const params = p || {};
    const type = params.type || "google";

    switch (type) {
      case "google":
        return await fakeGoogleImageAnalysis();
      default:
        return await fakeGoogleImageAnalysis();
    }
  } catch (err) {
    console.error("DB | SEED | *** fakeImageAnalysis | ERROR: " + err);
    throw err;
  }
};

const updateArtworkTagsFromImageAnalysis = async (p) => {
  try {
    const params = p || {};
    const artistDoc = params.artistDoc;
    const artworkDoc = params.artworkDoc;
    const imageAnalysisPath = params.artworkImageAnalysisPath;
    const type = params.type || "google";

    mkdirp.sync(path.parse(imageAnalysisPath).dir);

    const optionsStorage = {
      // The path to which the file should be downloaded, e.g. "./file.txt"
      destination: imageAnalysisPath,
    };

    //art-you/artwork/artists/@21shield/image_analysis/google/nutella_jarson_00001/output-1-to-1.json
    // Downloads the file

    const resultsSourceFile = `artwork/artists/${artistDoc.artistId}/image_analysis/google/${artworkDoc.title}/output-1-to-1.json`;
    await storage
      .bucket(googlStorageBucket)
      .file(resultsSourceFile)
      .download(optionsStorage);

    const imageAnalysisObj = await jsonfile.readFile(imageAnalysisPath);

    const tagNameSet = new Set();

    switch (type) {
      default:
        for (const response of imageAnalysisObj.responses) {
          // console.log({ response });
          if (
            response.labelAnnotations &&
            response.labelAnnotations.length > 0
          ) {
            for (const labelAnnotation of response.labelAnnotations) {
              console.log(`TAG: ${labelAnnotation.description.toLowerCase()}`);
              tagNameSet.add(labelAnnotation.description.toLowerCase());
            }
          }
          if (response.imagePropertiesAnnotation) {
            for (const imagePropertyAnnotationKey of Object.keys(
              response.imagePropertiesAnnotation
            )) {
              if (imagePropertyAnnotationKey === "dominantColors") {
                for (const color of response.imagePropertiesAnnotation
                  .dominantColors.colors) {
                  const colorName = colorNamer(
                    `"rgb(${color.color.red || 0},${color.color.green || 0},${
                      color.color.blue || 0
                    })"`,
                    { pick: ["pantone"] }
                  );
                  // console.log(colorName.pantone);
                  const dominantColorTag = colorName.pantone[0].name.toLowerCase();
                  tagNameSet.add(dominantColorTag);
                  console.log(
                    `COLOR | SCORE: ${color.score.toFixed(3)}` +
                      ` | PIXEL FRACTION: ${color.pixelFraction.toFixed(3)}` +
                      ` | RGB: [${color.color.red}|${color.color.green}|${color.color.blue}] | ${dominantColorTag}`
                  );
                }
              }
            }
          }
        }
    }

    const artworkTags =
      artworkDoc.tags && artworkDoc.tags.length > 0
        ? artworkDoc.tags.filter((tag) => tag)
        : [];

    const artworkTagIdArray = artworkTags.map((tag) => tag.id);

    for (const tagName of tagNameSet) {
      if (artworkTagIdArray.includes(tagName)) {
        // eslint-disable-next-line no-continue
        continue;
      }
      console.log(`DB | SEED | +++ ADD TAG: ${tagName}`);
      let tagDoc = await global.artyouDb.Tag.findOne({
        id: tagName.toLowerCase(),
      });

      if (!tagDoc) {
        tagDoc = new global.artyouDb.Tag({ id: tagName.toLowerCase() });
        tagDoc = await tagDoc.save();
      }
      artworkTags.push(tagDoc);
    }

    artworkDoc.tags = artworkTags;
    console.log(
      `DB | SEED | UPDATED ARTWORK TAGS FROM ANALYSIS | ARTWORK ID: ${artworkDoc.artworkId} | ${artworkDoc.tags.length} TOTAL TAGS`
    );

    return artworkDoc;
  } catch (err) {
    console.error(
      "DB | SEED | *** updateArtworkTagsFromImageAnalysis | ERROR: " + err
    );
  }
};

const processImagefile = async (p) => {
  const params = p || {};
  const bucketName = params.bucketName;
  const artistDoc = params.artistDoc;
  // const enableRandomImages = params.enableRandomImages || false;
  const imageFilePath = params.imageFilePath;
  const imageFolder = params.imageFolder;
  const analysisFolder = params.analysisFolder;

  const imageFile = path.parse(imageFilePath).base;
  const imageFileSmall = imageFile.replace(
    path.parse(imageFile).ext,
    "-small" + path.parse(imageFile).ext
  );

  if (
    !path.parse(imageFile).name.endsWith("small") &&
    (path.extname(imageFile) === ".jpg" ||
      path.extname(imageFile) === ".jpeg" ||
      path.extname(imageFile) === ".png")
  ) {
    const imageAnalysisFile = path.parse(imageFile).name + ".json";

    const artworkImagePath = imageFilePath;
    const artworkImageSmallPath = path.join("/", imageFolder, imageFileSmall);

    const artworkImageAnalysisPath = path.join(
      "/",
      analysisFolder,
      imageAnalysisFile
    );

    // if (enableRandomImages) {
    //   const fakeImageAnalysisObj = await fakeImageAnalysis({
    //     type: "google",
    //   });

    //   jsonfile.writeFileSync(artworkImageAnalysisPath, fakeImageAnalysisObj);
    // }

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
      `DB | SEED | processImagefile | transformImage` +
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

    const image = new global.artyouDb.Image({
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

    let artworkDoc = await global.artyouDb.Artwork.findOne({
      artworkId: artworkId,
    })
      .populate("recommendations")
      .populate("ratings")
      .populate("tags")
      .populate("artist")
      .populate("image");

    if (!artworkDoc) {
      artworkDoc = new global.artyouDb.Artwork(artworkObj);
      await artworkDoc.save(); // gets the auto generated id
    }

    // console.log(`artworkDoc.imageAnalysis: ${artworkDoc.get("imageAnalysis")}`);

    const enableAnalysis =
      !googleVisionQuotaExhausted &&
      (!artworkDoc.get("imageAnalysis") || FORCE_IMAGE_ANALYSIS);
    //
    if (enableAnalysis) {
      console.log(
        `DB | SEED | processImagefile | ANALYZE | ARTIST: ${artistDoc.artistId} | FILE: ${imageFile}`
      );

      // console.log({ enableAnalysis });
      // console.log({ googleVisionQuotaExhausted });
      // console.log({ FORCE_IMAGE_ANALYSIS });
      // console.log({ artworkDoc });

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
            `DB | SEED | processImagefile | ANALYZED | ${imageFile} | ANALYSIS: ${artworkDoc.imageAnalysis}`
          )
        );
        artworkDoc = await updateArtworkTagsFromImageAnalysis({
          artistDoc: artistDoc,
          artworkDoc: artworkDoc,
          artworkImageAnalysisPath: artworkImageAnalysisPath,
        });
      } catch (err) {
        console.log(`DB | SEED | processImagefile | ANALYZE ERROR: ${err}`);
        console.log(err);
        if (err.code && err.code === 8) {
          console.log(
            `DB | SEED | processImagefile | ANALYZE ERROR | QUOTA EXHAUSTED`
          );
          googleVisionQuotaExhausted = true;
        }
        throw err;
      }
    } else {
      console.log(
        `DB | SEED | processImagefile | ANALYSIS EXSITS | ARTISTID: ${artistDoc.artistId} | FILE: ${artworkImageAnalysisPath}`
      );
    }

    artworkDoc.artist = artistDoc;
    artworkDoc.image = await image.save();

    await artworkDoc.save();

    stats.artworks.seeded += 1;

    console.log(
      `DB | SEED | processImagefile | ARTIST: ${artistDoc.displayName} | TITLE: ${imageTitle} | IMAGE: ${artworkImagePath}`
    );
    return;
  } else {
    console.log(`DB | SEED | processImagefile | SKIP: ${imageFile}`);
    return;
  }
};

const loadArtworks = async (p) => {
  try {
    const params = p || {};
    const artistDoc = params.artistDoc;
    const enableRandomImages = params.enableRandomImages || false;
    const maxRandomImages = params.maxRandomImages || defaultMaxRandomImages;
    const imageFolder = params.imageFolder || defaultImageSeedDir;

    const bucketName = params.bucketName || "art-you-artworks";

    console.log(
      `DB | SEED | loadArtworks | RANDOM IMAGES: ${enableRandomImages} / ${maxRandomImages} MAX | ARTIST: ${artistDoc.displayName}`
    );

    console.log(
      `DB | SEED | loadArtworks | IMAGES FOLDER: ${params.imageFolder}`
    );
    console.log(
      `DB | SEED | loadArtworks | ANALYSIS FOLDER: ${params.analysisFolder}`
    );

    let imageFilePaths = [];

    if (enableRandomImages) {
      const maxImages = Math.ceil(maxRandomImages * Math.random()) + 1;
      for (let i = maxImages; i > 0; i--) {
        const randomImageFilePath = await getRandomImageFilePath({
          unique: true,
        });
        const imageFile = path.parse(randomImageFilePath).base;

        const imageFilePath = path.join("/", params.imageFolder, imageFile);
        // console.log(
        //   `DB | SEED | loadArtworks | COPY ${randomImageFilePath} --> ${imageFilePath}`
        // );
        await fs.copy(randomImageFilePath, imageFilePath);
        try {
          const googleCloudStorageDestination = `artwork/artists/${artistDoc.artistId}/images/${imageFile}`;
          // console.log(
          //   `DB | SEED | loadArtworks | STORE ${imageFilePath} --> GS: ${googleCloudStorageDestination}`
          // );
          await storage.bucket(googlStorageBucket).upload(imageFilePath, {
            destination: googleCloudStorageDestination,
          });
        } catch (e) {
          console.log(`DB | SEED | loadArtworks | *** STORE ERROR: ${e}`);
          throw e;
        }
        imageFilePaths.push(imageFilePath);
      }

      console.log(
        `DB | SEED | loadArtworks | LOADING ${imageFilePaths.length} *RANDOM* IMAGES | ARTIST: ${params.artistDoc.displayName} | IMAGES FOLDER: ${params.imageFolder}`
      );
    } else {
      const imageFiles = fs.readdirSync(params.imageFolder);

      for (const imageFile of imageFiles) {
        const imageFilePath = path.join("/", params.imageFolder, imageFile);
        const googleCloudStorageDestination = `artwork/artists/${artistDoc.artistId}/images/${imageFile}`;

        await storage.bucket(googlStorageBucket).upload(imageFilePath, {
          destination: googleCloudStorageDestination,
        });

        imageFilePaths.push(imageFilePath);
        // imageFilePaths = imageFiles.map((imageFile) =>
        //   path.join("/", params.imageFolder, imageFile)
        // );
        console.log(
          `DB | SEED | loadArtworks | LOADING ${imageFilePaths.length} IMAGES | ARTIST: ${params.artistDoc.displayName} | IMAGES FOLDER: ${params.imageFolder}`
        );
      }
    }

    for (const imageFilePath of imageFilePaths) {
      await processImagefile({
        bucketName: bucketName,
        artistDoc: params.artistDoc,
        imageFolder: imageFolder,
        imageFilePath: imageFilePath,
        analysisFolder: params.analysisFolder,
        enableRandomImages: enableRandomImages,
      });
    }

    return;
  } catch (err) {
    console.error("DB | SEED | *** seedDb | ERROR: " + err);
    throw err;
  }
};

const seedDb = async (p) => {
  try {
    const params = p || {};
    let results = {};
    results.fake = {};
    const enableLoadArtists = params.enableLoadArtists || ENABLE_LOAD_ARTISTS;
    const enableFake = params.enableFake || ENABLE_FAKE;
    const modelNumbers = Object.assign(
      {},
      DEFAULT_MODEL_NUMBERS,
      params.modelNumbers || {}
    );

    console.log(`DB | SEED | seedDb | START | FAKE: ${params.enableFake}`);

    if (enableFake) {
      for (const model of MODELS) {
        const newDocArray = await createDocs({
          model: model,
          number: modelNumbers[model],
        });
        // results = await loadArtists({
        //   array: newDocArray,
        // });
      }

      if (enableLoadArtists) {
        results.fake = await loadArtists({
          folder: DEFAULT_FAKE_ARTISTS_FOLDER,
        });
      }
    }

    if (enableLoadArtists) {
      results = await loadArtists({
        folder: DEFAULT_ARTISTS_FOLDER,
      });
    }

    results.stats = await dbStats();
    return results;
  } catch (err) {
    console.error("DB | SEED | *** seedDb | ERROR: " + err);
    throw err;
  }
};

const main = async () => {
  try {
    // const options = {
    //   useUnifiedTopology: true,
    //   useFindAndModify: false,
    //   useCreateIndex: true,
    //   useNewUrlParser: true,
    //   autoIndex: false,
    //   poolSize: 80, // Maintain up to poolSize socket connections
    //   serverSelectionTimeoutMS: 60000, // Keep trying to send operations for serverSelectionTimeoutMS
    //   socketTimeoutMS: 600000, // Close sockets after 45 seconds of inactivity
    //   connectTimeoutMS: 600000,
    //   heartbeatFrequencyMS: 10000, // test socket every heartbeatFrequencyMS
    //   keepAlive: true,
    //   keepAliveInitialDelay: 60000,
    //   family: 4, // Use IPv4, skip trying IPv6
    // };

    global.dbConnection = await global.artyouDb.connect();
    await global.artyouDb.createDefaultIndexes();

    const stats = await global.dbConnection.db.stats();
    console.log("DB | SEED | MONGO DB STATS\n", stats);

    if (fs.existsSync(imageFileUsedFilePath)) {
      console.log(
        `DB | SEED | LOAD IMAGE FILE USED FILE: ${imageFileUsedFilePath}`
      );
      imageFileUsedHashMap = await jsonfile.readFile(imageFileUsedFilePath);
      console.log(
        `DB | SEED | LOADED IMAGE FILE USED FILE | ${
          Object.keys(imageFileUsedHashMap).length
        } ENTRIES`
      );
    }

    initfileQueueInterval({ interval: 100 });

    results = await seedDb({
      enableLoadArtists: ENABLE_LOAD_ARTISTS,
      enableFake: ENABLE_FAKE,
    });

    return results;
  } catch (err) {
    console.error("DB | SEED | *** ERROR: " + err);
    throw err;
  }
};

main()
  .then((results) => {
    console.log(chalk.blue(`DB | SEED | END`));
    console.log(results);
    console.log(chalk.blue(`DB | SEED | WAIT FOR ASYNC OPS TO COMPLETE ...`));

    const waitFinishInterval = setInterval(() => {
      if (stats.walk.complete && fileQueue.length === 0) {
        clearInterval(waitFinishInterval);
        if (global.dbConnection !== undefined) {
          global.dbConnection.close();
        }
      }
      stats.walk.complete = true;
    }, 10000);
  })
  .catch((err) => {
    if (global.dbConnection !== undefined) {
      global.dbConnection.close();
    }
    console.error(err);
  });
