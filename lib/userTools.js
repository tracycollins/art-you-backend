const DEFAULT_PREFIX = "USR";
let PF = DEFAULT_PREFIX;

const ONE_SECOND = 1000;
const ONE_MINUTE = 60 * ONE_SECOND;
// const ONE_HOUR = 60 * ONE_MINUTE;

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

global.artyouDb = require("@threeceelabs/mongoose-artyou");
global.dbConnection = false;

const chalk = require("chalk");
const chalkAlert = chalk.red;
const chalkError = chalk.bold.red;
const chalkLog = chalk.gray;

const UserTools = function (app_name) {
  const self = this;
  this.appname = app_name || "DEFAULT_APP_NAME";
  PF = `${this.appname}`;

  console.log(`${PF} | APP NAME: ${this.appname} | PID: ${process.pid}`);

  EventEmitter.call(this);

  setTimeout(async () => {
    try {
      global.dbConnection = await global.artyouDb.connect();
      console.log(`${PF} | APP ${self.appname} | CONNECTED`);

      self.emit("connect", self.appname);
      self.emit("ready", self.appname);
    } catch (err) {
      console.error(`${PF} | APP ${self.appname} | MONGO ERROR:`, err);
      self.emit("error", err);
    }
  }, 10);
};

util.inherits(UserTools, EventEmitter);

UserTools.prototype.verbose = function (v) {
  if (v === undefined) {
    return configuration.verbose;
  }
  configuration.verbose = v;
  console.log(chalkAlert(PF + " | --> SET VERBOSE: " + configuration.verbose));
  return;
};

UserTools.prototype.getTimeStamp = function (inputTime) {
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

const getTimeStamp = UserTools.prototype.getTimeStamp;

UserTools.prototype.msToTime = function (d, msf) {
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

const msToTime = UserTools.prototype.msToTime;

UserTools.prototype.getElapsedMS = function (inputMoment, msFlag) {
  const elapsedMS = moment().valueOf() - inputMoment.valueOf();
  return msToTime(elapsedMS, msFlag);
};

const getElapsedMS = UserTools.prototype.getElapsedMS;

UserTools.prototype.jsonPrint = function (obj) {
  if (obj && obj != undefined) {
    return treeify.asTree(obj, true, true);
  } else {
    return "UNDEFINED";
  }
};

const cursorDataHandler = async (params) => {
  const artwork = params.artwork;

  // console.log(
  //   chalkLog(
  //     `${PF} | ARTWORK: ${artwork.title} | TAGS: ${artwork.tags.length}`
  //   )
  // );
  tabulateTags(artwork.tags);
  return;
};

async function artworkCursorStream(p) {
  const params = p || {};
  const oauthID = params.oauthID || false;

  const maxArtworkCount = params.maxArtworkCount || null;

  const query = {};

  const cursor = global.artyouDb.Artwork.find(query)
    .limit(maxArtworkCount)
    .populate("tags")
    .lean()
    .cursor();

  let numArtworksProcessed = 0;
  await cursor.eachAsync(async function (artwork) {
    if (!artwork) {
      cursor.close();
      return;
    }

    await cursorDataHandler({ artwork: artwork });
    numArtworksProcessed++;

    if (numArtworksProcessed % 100 === 0) {
      console.log(
        chalkLog(
          `${PF} | OAUTH ID: ${oauthID}` +
            ` | ${numArtworksProcessed} PROCESSED` +
            ` | ${artwork.tags.length} TAGS (${
              Object.keys(tagHistogram).length
            } TOTAL)` +
            ` | ARTWORK: ${artwork.title}`
        )
      );
    }
  });

  return;
}

async function modelCursorStream(p) {
  const params = p || {};
  console.log({ params });
  const model = params.model || "Artwork";
  const user_id = params.user_id || false;
  const populate = params.populate || "";
  const query = params.query || {};
  const limit = params.limit || false;
  const lean = params.lean || false;
  const results = [];
  let next;

  const defaultProcessFunction = async (doc, i, user_id, results, next) => {
    results.push(doc._id);
    console.log(
      `DOC _ID: ${doc._id} | USR_ID: ${user_id} | INDEX: ${i} | ${results.length} RESULTS`
    );
  };

  const processFunction = params.processFunction || defaultProcessFunction;

  console.log({ limit });
  const cursor = global.artyouDb[model]
    .find(query)
    .limit(limit)
    .populate(populate)
    .lean(lean)
    .cursor();

  await cursor.eachAsync((doc, i) =>
    processFunction(doc, i, user_id, results, next)
  );

  console.log(
    chalk.green(
      `${PF} | ========================================================`
    )
  );
  console.log(
    chalk.green(
      `${PF} | CURSOR END | MODEL: ${model} | ${results.length} RESULTS | NEXT: ${next}`
    )
  );
  console.log(
    chalk.green(
      `${PF} | ========================================================`
    )
  );
  return { unrated: results };
}

UserTools.prototype.getUnratedArtworks = async function (p) {
  // returns sorted array of ObjectIDs of unrated artworks
  // optionally filtered by user and/or artist
  try {
    const params = p || {};
    console.log({ params });
    let query = params.query || {};
    let user_id = params.user_id || false;
    const populate = params.populate || "ratings";
    const limit = params.limit || false;
    const lean = params.lean || false;

    if (params.oauthID) {
      const user = await global.artyouDb.User.findOne({
        oauthID: params.oauthID,
      }).lean();
      if (user) {
        user_id = user._id;
      }
    }
    const processFunction = async (artwork, i, user_id, results, next) => {
      next = artwork._id;
      if (!user_id) {
        results.push(artwork._id);
        console.log(
          `... NO USER | ARTWORK _ID: ${artwork._id} | INDEX: ${i} | RATINGS: ${artwork.ratings.length} | ${results.length} UNRATED`
        );
      } else {
        const ratingUserHit = artwork.ratings.find((rating) => {
          return (
            ObjectID(rating.user).toHexString() ===
            ObjectID(user_id).toHexString()
          );
          // return ObjectID(rating.user).toHexString() === user_id;
          // return rating.user === user_id;
        });

        if (ratingUserHit) {
          // console.log({ ratingUserHit });
          // console.log(
          //   `+++ USER HIT:  ${user_id} | ARTWORK _ID: ${artwork._id} | INDEX: ${i} | RATINGS: ${artwork.ratings.length} | ${results.length} RESULTS`
          // );
        } else {
          results.push(artwork._id);
          // console.log(
          //   `--- USER MISS: ${user_id} | ARTWORK _ID: ${artwork._id} | INDEX: ${i} | RATINGS: ${artwork.ratings.length} | ${results.length} RESULTS`
          // );
          // console.log(artwork.ratings);
        }
      }

      if (i % 100 === 0) {
        console.log(
          `... USER: ${user_id} | ARTWORK _ID: ${artwork._id} | INDEX: ${i} | RATINGS: ${artwork.ratings.length} | ${results.length} UNRATED`
        );
      }
    };

    let response;
    let next = true;

    while (next) {
      response = await modelCursorStream({
        query,
        user_id,
        populate,
        limit,
        processFunction,
        lean,
      });
      next = response.next;
      console.log({ next });
      query = { _id: { $gt: response.next } };
    }

    return response;
  } catch (err) {
    console.log(chalkError(`${PF} | *** getUnratedArtworks ERROR: ${err}`));
    throw err;
  }
};

UserTools.prototype.calculateRatingAverage = async function (p) {
  try {
    if (p.ratings === undefined || p.ratings.length === 0) {
      return 0;
    }
    const params = p || {};

    const ratingSum = params.ratings.reduce(function (accumulator, rating) {
      return accumulator + rating.rate;
    }, 0);

    // console.log(
    //   chalkLog(
    //     `${PF} | +++ RATING AVERAGE` +
    //       ` | ${params.ratings.length} RATINGS` +
    //       ` | AVERAGE: ${(ratingSum / params.ratings.length).toFixed(1)}`
    //   )
    // );

    return ratingSum / params.ratings.length;
  } catch (err) {
    console.log(
      chalkError(`${PF} | *** CALCULATE RATING AVERAGE ERROR: ${err}`)
    );
    throw err;
  }
};

const calculateRatingAverage = UserTools.prototype.calculateRatingAverage;

UserTools.prototype.updateRecommendations = async function (p) {
  try {
    const params = p || {};
    const forceFit = params.forceFit || false;

    const results = {};
    results.params = params;
    results.networkId = params.networkId || false;

    const epochs = params.epochs || configuration.fit.epochs;
    const verbose = params.verbose || false;
    const oauthID = params.oauthID || "twitter|848591649575927810";
    const normalizeFactor = params.normalizeFactor || 0.2; // 0-5 stars

    console.log(
      chalk.blue(`${PF} | #########################################`)
    );
    console.log(chalk.blue(`${PF} | UPDATE RECOMMENDATIONS`));
    console.log(chalk.blue(`${PF} | USER OAUTH ID: ${oauthID}`));
    console.log(chalk.blue(`${PF} | NN ID:         ${results.networkId}`));
    console.log(chalk.blue(`${PF} | EPOCHS:        ${epochs}`));
    console.log(
      chalk.blue(`${PF} | #########################################`)
    );

    const userDoc = await global.artyouDb.User.findOne({
      oauthID: oauthID,
    }).populate({ path: "network", select: { id: 1, createdAt: 1, meta: 1 } });

    let nnDoc;
    if (results.networkId) {
      console.log(`${PF} | LOADING DB NN | ID: ${results.networkId}`);
      nnDoc = await global.artyouDb.NeuralNetwork.findOne({
        id: results.networkId,
      }).populate("networkInput");
    } else if (userDoc.network) {
      // const sinceNetworkCreated = moment.duration(
      //   moment().diff(moment(userDoc.network.createdAt))
      // );
      console.log(
        `${PF} | LOADING DB NN | ID: ${userDoc.network.id}` +
          ` | CREATED: ${moment(userDoc.network.createdAt).format(
            defaultDateTimeFormat
          )}` +
          ` | AGE: ${getElapsedMS(moment(userDoc.network.createdAt))}`
      );
      //
      if (
        !forceFit &&
        moment().valueOf() - moment(userDoc.network.createdAt) < MAX_NN_AGE
      ) {
        console.log(
          chalk.blue(
            `${PF} | USING USER NN | USER OAUTH ID: ${oauthID} | AGE LESS THAN MAX: ${msToTime(
              MAX_NN_AGE
            )}`
          )
        );
        nnDoc = await global.artyouDb.NeuralNetwork.findOne({
          id: userDoc.network.id,
        }).populate("networkInput");
      } else {
        console.log(
          chalkAlert(
            `${PF}` +
              ` | NN TOO OLD or FORCE FIT: ${forceFit}` +
              ` | CREATING NEW NN` +
              ` | USER OAUTH ID: ${oauthID}` +
              ` | ${msToTime(MAX_NN_AGE)}`
          )
        );
        results.networkId = await createUserNetwork({
          oauthID: oauthID,
          epochs: epochs,
        });
        nnDoc = await global.artyouDb.NeuralNetwork.findOne({
          id: results.networkId,
        }).populate("networkInput");
      }
    } else {
      console.log(
        chalkAlert(`${PF} | CREATING NN | USER OAUTH ID: ${oauthID}`)
      );
      results.networkId = await createUserNetwork({
        oauthID: oauthID,
        epochs: epochs,
      });
      nnDoc = await global.artyouDb.NeuralNetwork.findOne({
        id: results.networkId,
      }).populate("networkInput");
    }

    userDoc.network = nnDoc;
    await userDoc.save();

    console.log(
      `${PF} | LOADED DB NN | ID: ${nnDoc.id}` +
        ` | INPUTS ID: ${nnDoc.networkInput.id}` +
        ` | NUM INPUTS: ${nnDoc.numInputs}` +
        ` | HL: ${nnDoc.hiddenLayerSize}`
    );

    await loadNetwork({ networkObj: nnDoc });
    await convertNetwork({ networkObj: nnDoc });

    const query = {};
    results.numberArtworksUpdated = 0;

    const cursor = global.artyouDb.Artwork.find(query)
      .populate("artist")
      .populate("tags")
      .populate("ratings")
      .populate("recommendations")
      .cursor();

    cursor.on("end", () => {
      console.log(chalk.blue(`${PF} | CURSOR | END`));
    });

    cursor.on("close", () => {
      console.log(chalkAlert(`${PF} | CURSOR | CLOSED`));
    });

    cursor.on("error", (err) => {
      console.log(chalkError(`${PF} | CURSOR | ERROR: ${err}`));
    });

    await cursor.eachAsync(async function (artworkDoc) {
      const dataObj = await createDataObj({
        artworkDoc: artworkDoc,
        inputsDoc: nnDoc.networkInput,
        normalizeFactor: normalizeFactor,
      });

      const predictResults = await activateNetwork({
        id: nnDoc.id,
        dataObj: dataObj,
        verbose: verbose,
      });

      let recDoc = await global.artyouDb.Recommendation.findOne({
        user: userDoc,
        artwork: artworkDoc,
      })
        .populate("network")
        .populate("user")
        .populate("artwork");

      if (recDoc) {
        recDoc.network = nnDoc;
        recDoc.score = clamp(predictResults.output, 0, 1);
      } else {
        recDoc = new global.artyouDb.Recommendation({
          user: userDoc,
          artwork: artworkDoc,
          network: nnDoc,
          score: predictResults.output,
        });
      }

      const dbRecDoc = await recDoc.save();
      dbRecDoc.populate("user").populate("artwork");

      // eslint-disable-next-line no-underscore-dangle
      artworkDoc.recommendations.addToSet(dbRecDoc._id);
      artworkDoc.ratingAverage = await calculateRatingAverage({
        ratings: artworkDoc.ratings,
      });

      await artworkDoc.save();

      results.numberArtworksUpdated += 1;

      if (results.numberArtworksUpdated % 100 === 0) {
        console.log(
          chalkLog(
            `${PF} | +++ REC` +
              ` [ ${results.numberArtworksUpdated} UPDATED ]` +
              ` | USR: ${dbRecDoc.user.name} | ${dbRecDoc.user.oauthID}` +
              ` | ID: ${dbRecDoc.id}` +
              ` | SCORE: ${dbRecDoc.score.toFixed(3)}` +
              ` | AVE: ${artworkDoc.ratingAverage.toFixed(1)}` +
              ` | ARTWORK: ${dbRecDoc.artwork.title}`
          )
        );
      }
    });
    cursor.close();

    console.log(chalk.green(`${PF} | ######################################`));
    console.log(chalk.green(`${PF} | RECOMMENDATIONS UPDATE COMPLETE`));
    console.log(chalk.green(`${PF} | USER: ${userDoc.name}`));
    console.log(chalk.green(`${PF} | OAUTH ID: ${oauthID}`));
    console.log(chalk.green(`${PF} | NN ID: ${results.networkId}`));
    console.log(
      chalk.green(`${PF} | ARTWORKS UPDATED: ${results.numberArtworksUpdated}`)
    );
    console.log(chalk.green(`${PF} | ######################################`));

    return results;
  } catch (err) {
    console.log(
      chalk.red.bold(`${PF} | #####################################`)
    );
    console.log(chalk.red.bold(err));
    console.log(
      chalk.red.bold(`${PF} | #####################################`)
    );

    throw err;
  }
};

UserTools.prototype.createUserNetwork = async function (p) {
  try {
    const params = p || {};
    const epochs = params.epochs || configuration.fit.epochs;
    const verbose = params.verbose || false;
    const oauthID = params.oauthID || "twitter|848591649575927810";
    const inputsId = params.inputsId || false;

    console.log(chalk.blue(`${PF} | #####################################`));
    console.log(chalk.blue(`${PF} | CREATE USER NEURAL NETWORK`));
    console.log(chalk.blue(`${PF} | OAUTH ID:  ${oauthID}`));
    console.log(chalk.blue(`${PF} | INPUTS ID: ${inputsId}`));
    console.log(chalk.blue(`${PF} | #####################################`));

    let inputsDoc;

    if (!inputsId) {
      console.log(`${PF} | createUserNetwork | CREATING INPUTS DOC`);
      inputsDoc = await createInputSet({ oauthID: oauthID });

      // console.log(`${PF} | SAVE DB INPUTS DOC | ${inputsDoc.id}`);

      await inputsDoc.save();
      console.log(
        `${PF} | createUserNetwork | CREATED INPUTS DOC | ${inputsDoc.id} | NUM INPUTS: ${inputsDoc.numInputs}`
      );
    } else {
      console.log(
        `${PF} | createUserNetwork | OAUTH ID: ${oauthID} | LOADING INPUTS DOC`
      );
      inputsDoc = await global.artyouDb.NetworkInput.findOne({
        id: inputsId,
      });

      console.log(
        `${PF} | createUserNetwork | OAUTH ID: ${oauthID} | LOADED INPUTS DOC | ${inputsDoc.id} | NUM INPUTS: ${inputsDoc.numInputs}`
      );
    }

    console.log(
      `${PF} | createUserNetwork | OAUTH ID: ${oauthID} | CREATING NN DOC`
    );

    const networkDoc = await createNetwork({
      inputsDoc: inputsDoc,
    });

    console.log(
      `${PF} | createUserNetwork | OAUTH ID: ${oauthID} | CREATED NN DOC | ${networkDoc.id}`
    );
    console.log(
      `${PF} | createUserNetwork | OAUTH ID: ${oauthID} | ... COMPILING TEST TENSORFLOW NETWORK`
    );

    networkDoc.network.compile({
      optimizer: "sgd",
      loss: "meanSquaredError",
      metrics: ["accuracy"],
    });

    const totalSet = await createTrainingSet({
      inputsId: inputsDoc.id,
      oauthID: oauthID,
    });

    const trainingSetSize = Math.floor(totalSet.length * 0.85);
    const trainingSet = _.slice(totalSet, 0, trainingSetSize);
    const testSet = _.slice(totalSet, trainingSetSize);
    let resultsFit = {};

    if (totalSet.length > 0) {
      console.log(
        `${PF} | createUserNetwork | OAUTH ID: ${oauthID} | TRAINING SET: ${trainingSet.length} | TEST SET: ${testSet.length}`
      );

      const schedStartTime = moment().valueOf();

      const fitOptions = {};
      fitOptions.epochs = epochs;
      fitOptions.callbacks = {};
      fitOptions.callbacks.onEpochEnd = (epoch, logs) => {
        const elapsedInt = moment().valueOf() - schedStartTime;
        const epochRate = epoch > 0 ? elapsedInt / epoch : 0;
        const timeToCompleteMS = epochRate * (fitOptions.epochs - epoch);

        const error = logs.loss ? logs.loss.toFixed(6) : 999999999;

        if (epoch % 100 === 0) {
          console.log(
            `${PF} | createUserNetwork | OAUTH ID: ${oauthID} | FIT | EPOCH ${epoch}/${fitOptions.epochs}` +
              ` | RATE: ${epochRate.toFixed(1)} epochs/s` +
              ` | ETC: ${msToTime(Math.floor(timeToCompleteMS))}` +
              ` | ERROR: ${error}`
          );
        }
      };

      resultsFit = await fit({
        id: networkDoc.id,
        options: fitOptions,
        network: networkDoc.network,
        trainingSet: trainingSet,
      });

      console.log(
        chalk.green(
          `============================================================================================`
        )
      );
      console.log(
        chalk.green(
          `${PF} | createUserNetwork | OAUTH ID: ${oauthID} | FIT COMPLETE | NN ID: ${networkDoc.id} | EPOCHS ${resultsFit.stats.params.epochs}`
        )
      );
      console.log(
        chalk.green(
          `============================================================================================`
        )
      );
    }

    console.log(
      `${PF} | createUserNetwork | OAUTH ID: ${oauthID} | CREATE JSON | ${networkDoc.id}`
    );

    networkDoc.networkJson = await createJson({
      networkObj: networkDoc,
    });

    networkDoc.network = null;

    console.log(
      `${PF} | createUserNetwork | OAUTH ID: ${oauthID} | SAVE DB NN DOC | ${networkDoc.id}`
    );

    delete networkDoc.network;

    networkDoc.meta.user = {};
    networkDoc.meta.user.oauthID = oauthID;

    networkDoc.networkInput = inputsDoc;
    await networkDoc.save();

    console.log(
      `${PF} | createUserNetwork | OAUTH ID: ${oauthID}` +
        ` | LOAD DB NN DOC` +
        ` | ${networkDoc.id}` +
        ` | oauthID: ${networkDoc.meta.user.oauthID}`
    );

    const loadedNnDoc = await global.artyouDb.NeuralNetwork.findOne({
      id: networkDoc.id,
    }).lean();

    console.log(
      `${PF} | createUserNetwork | OAUTH ID: ${oauthID}` +
        ` | LOADED DB NN DOC` +
        ` | ID: ${loadedNnDoc.id}` +
        ` | INPUTS: ${loadedNnDoc.numInputs}` +
        ` | HL: ${loadedNnDoc.hiddenLayerSize}`
    );

    await loadNetwork({ networkObj: loadedNnDoc });

    const reloadedNnObj = await convertNetwork({ networkObj: loadedNnDoc });

    console.log(
      `${PF} | createUserNetwork | OAUTH ID: ${oauthID}` +
        ` | RELOADED DB NN DOC | ID: ${reloadedNnObj.id}` +
        ` | oauthID: ${reloadedNnObj.meta.user.oauthID}` +
        ` | INPUTS: ${reloadedNnObj.numInputs}` +
        ` | HL: ${reloadedNnObj.hiddenLayerSize}`
    );

    if (totalSet.length > 0) {
      for (const dataObj of testSet) {
        if (dataObj.datum.hits.length > 0)
          debug(
            `${PF} | createUserNetwork | OAUTH ID: ${oauthID}` +
              ` | INPUT HITS: ${dataObj.datum.hits.length}`
          );

        dataObj.inputHits = dataObj.datum.hits.length;
        dataObj.inputMisses = dataObj.datum.misses.length;
        dataObj.inputHitRatePercent =
          (100 * dataObj.inputHits) / dataObj.datum.input.length;

        const predictResults = await activateNetwork({
          id: reloadedNnObj.id,
          dataObj: dataObj,
          verbose: verbose,
        });

        if (verbose) console.log({ predictResults });
      }
    }

    console.log(
      chalk.green(
        `${PF} | createUserNetwork | OAUTH ID: ${oauthID} | #####################################`
      )
    );
    console.log(
      chalk.green(
        `${PF} | createUserNetwork | OAUTH ID: ${oauthID} | ###  NEURAL NETWORK TEST: PASSED  ###`
      )
    );
    console.log(
      chalk.green(
        `${PF} | createUserNetwork | OAUTH ID: ${oauthID} | #####################################`
      )
    );

    return reloadedNnObj.id;
  } catch (err) {
    currentFitTensorflowNetwork = null;

    console.log(
      chalk.red.bold(
        `${PF} | createUserNetwork | OAUTH ID: ${p.oauthID} | #####################################`
      )
    );
    console.log(
      chalk.red.bold(
        `${PF} | createUserNetwork | OAUTH ID: ${p.oauthID} | ###  NEURAL NETWORK TEST: FAILED  ###`
      )
    );
    console.log(
      chalk.red.bold(
        `${PF} | createUserNetwork | OAUTH ID: ${p.oauthID} | #####################################`
      )
    );

    console.log(chalk.red.bold(err));

    throw err;
  }
};

UserTools.prototype.updateRecommendationsChild = async function (p) {
  try {
    const params = p || {};
    const childProcess = fork("./lib/childNeuralNetwork.js");
    childProcess.send({
      op: "UPDATE_RECS",
      oauthID: params.user.oauthID,
      epochs: params.epochs,
    });
    childProcess.on("message", (message) => {
      console.log(`${PF} | +++ CHILD UPDATE RECS COMPLETE`, message);
    });
    return;
  } catch (err) {
    console.log(
      chalkError(`${PF} | *** CHILDTENSORFLOW UPDATE RECS ERROR: ${err}`)
    );
    throw err;
  }
};

module.exports = UserTools;
