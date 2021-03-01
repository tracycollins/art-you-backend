const MODULE_ID_PREFIX = "NNT";

const DEFAULT_NETWORK_TECHNOLOGY = "tensorflow";
const DEFAULT_NUM_INPUTS = 400;
const DEFAULT_NETWORK_FIT_EPOCHS = 1000;
const DEFAULT_NUM_OUTPUTS = 1;
const DEFAULT_HIDDEN_LAYERS = 20;
const DEFAULT_ACTIVATION_INPUT = "relu";
const DEFAULT_ACTIVATION_OUTPUT = "softmax";

const configuration = {};
configuration.verbose = false;
configuration.networkTechnology = DEFAULT_NETWORK_TECHNOLOGY;
configuration.fit = {};
configuration.fit.epochs = DEFAULT_NETWORK_FIT_EPOCHS;
configuration.numInputs = DEFAULT_NUM_INPUTS;
configuration.numOutputs = DEFAULT_NUM_OUTPUTS;
configuration.hiddenLayerSize = DEFAULT_HIDDEN_LAYERS;
configuration.activationInput = DEFAULT_ACTIVATION_INPUT;
configuration.activationOutput = DEFAULT_ACTIVATION_OUTPUT;

const defaultDateTimeFormat = "YYYYMMDD_HHmmss";

const util = require("util");
const EventEmitter = require("events");
const HashMap = require("hashmap").HashMap;
const defaults = require("object.defaults");
const empty = require("is-empty");
const moment = require("moment");
const _ = require("lodash");
const treeify = require("treeify");

// const S3 = require("@aws-sdk/client-s3");

global.artyouDb = require("@threeceelabs/mongoose-artyou");
global.dbConnection = false;

// const mguAppName = MODULE_ID_PREFIX + "_MGU";
// const MongooseUtilities = require("@threeceelabs/mongoose-utilities");
// const mgUtils = new MongooseUtilities(mguAppName);

// mgUtils.on("ready", async () => {
//   console.log(`${MODULE_ID_PREFIX} | +++ MONGOOSE UTILS READY: ${mguAppName}`);
// });

const networksHashMap = new HashMap();
const inputsHashMap = new HashMap();

const chalk = require("chalk");
const chalkAlert = chalk.red;
const chalkError = chalk.bold.red;
const chalkLog = chalk.gray;

const tensorflow = require("@tensorflow/tfjs-node"); // eslint-disable-line global-require

const NeuralNetworkTools = function (app_name) {
  const self = this;
  this.appname = app_name || "DEFAULT_APP_NAME";
  console.log("NNT | APP NAME: " + this.appname);

  EventEmitter.call(this);

  setTimeout(async () => {
    try {
      global.dbConnection = await global.artyouDb.connect();

      // const s3Client = new S3.S3Client({ region: "us-east-1"});
      // const listBuckets = new S3.ListBucketsCommand({});
      // const results = await s3Client.send(listBuckets);
      // console.log(`NNT | AWS | BUCKETS`)
      // console.log(results.Buckets)

      self.emit("connect", self.appname);
    } catch (err) {
      // console.error(`*** AWS S3 LIST BUCKETS ERROR: ${err}`)
    }
    self.emit("ready", self.appname);
  }, 100);
};

util.inherits(NeuralNetworkTools, EventEmitter);

// const s3Client = new S3.S3Client({ region: "us-east-1"});
// const s3ListBuckets = new S3.ListBucketsCommand({});

// NeuralNetworkTools.prototype.s3ListBuckets = async function(){
//   const results = await s3Client.send(s3ListBuckets);
//   return results;
// };

// NeuralNetworkTools.prototype.s3PutObject = async function(params){
//   const s3PutObject = new S3.PutObjectCommand(params)
//   const results = await s3Client.send(s3PutObject);
//   return results;
// };

// const s3PutObject = NeuralNetworkTools.prototype.s3PutObject

NeuralNetworkTools.prototype.verbose = function (v) {
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

NeuralNetworkTools.prototype.getTimeStamp = function (inputTime) {
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

const getTimeStamp = NeuralNetworkTools.prototype.getTimeStamp;

NeuralNetworkTools.prototype.msToTime = function (d, msf) {
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

const msToTime = NeuralNetworkTools.prototype.msToTime;

NeuralNetworkTools.prototype.getElapsedMS = function (inputMoment, msFlag) {
  const elapsedMS = moment().valueOf() - inputMoment.valueOf();
  return msToTime(elapsedMS, msFlag);
};

const getElapsedMS = NeuralNetworkTools.prototype.getElapsedMS;

NeuralNetworkTools.prototype.jsonPrint = function (obj) {
  if (obj && obj != undefined) {
    return treeify.asTree(obj, true, true);
  } else {
    return "UNDEFINED";
  }
};

NeuralNetworkTools.prototype.loadInputs = async function (params) {
  inputsHashMap.set(params.inputsObj.id, params.inputsObj);
  return;
};

NeuralNetworkTools.prototype.convertTensorFlow = async function (params) {
  try {
    let nnJson = {};
    try {
      nnJson = JSON.parse(params.networkJson);
    } catch (e) {
      console.log(
        chalkAlert(
          `${MODULE_ID_PREFIX} | !!! convertTensorFlow: TENSORFLOW JSON PARSE FAILED ... networkJson READY?`
        )
      );
      nnJson = params.networkJson;
    }

    const weightData = new Uint8Array(Buffer.from(nnJson.weightData, "base64"))
      .buffer;
    const network = await tensorflow.loadLayersModel(
      tensorflow.io.fromMemory({
        modelTopology: nnJson.modelTopology,
        weightSpecs: nnJson.weightSpecs,
        weightData: weightData,
      })
    );

    return network;
  } catch (err) {
    console.log(
      chalkError(`${MODULE_ID_PREFIX} | *** convertTensorFlow ERROR: ${err}`)
    );
    throw err;
  }
};

const convertTensorFlow = NeuralNetworkTools.prototype.convertTensorFlow;

NeuralNetworkTools.prototype.loadNetwork = async function (params) {
  networksHashMap.set(params.networkObj.id, params.networkObj);
  return;
};

const loadNetwork = NeuralNetworkTools.prototype.loadNetwork;

NeuralNetworkTools.prototype.deleteAllNetworks = async function () {};

NeuralNetworkTools.prototype.deleteNetwork = async function () {};

NeuralNetworkTools.prototype.getNetworkStats = function () {};

NeuralNetworkTools.prototype.createNetwork = async function (p) {
  try {
    const params = p || {};

    console.log(
      chalkLog(`${MODULE_ID_PREFIX} | ... CREATING TENSORFLOW NETWORK`)
    );

    const networkObj = {};

    networkObj.id = params.id || `nn_defaults_${moment().valueOf()}`;
    networkObj.networkTechnology =
      params.networkTechnology || configuration.networkTechnology;
    networkObj.inputsDoc = params.inputsDoc;
    networkObj.numInputs = params.inputsDoc
      ? params.inputsDoc.numInputs
      : configuration.numInputs;
    networkObj.numOutputs = params.numOutputs || configuration.numOutputs;
    networkObj.hiddenLayerSize =
      params.hiddenLayerSize || configuration.hiddenLayerSize;
    networkObj.activationInput =
      params.activationInput || configuration.activationInput;
    networkObj.activationOutput =
      params.activationOutput || configuration.activationOutput;

    const networkDoc = new global.artyouDb.NeuralNetwork(networkObj);

    networkDoc.network = tensorflow.sequential();

    networkDoc.network.add(
      tensorflow.layers.dense({
        inputShape: [networkDoc.numInputs],
        units: networkDoc.hiddenLayerSize,
        activation: networkDoc.activationInput,
      })
    );

    networkDoc.network.add(
      tensorflow.layers.dense({
        units: networkDoc.numOutputs,
        activation: networkDoc.activationOutput,
      })
    );

    return networkDoc;
  } catch (err) {
    console.log(
      chalkError(MODULE_ID_PREFIX + " | *** createNetwork ERROR: " + err)
    );
    throw err;
  }
};

const tagHistogram = {};

const tabulateTags = (tags) => {
  for (const tag of tags) {
    tagHistogram[tag.id] = tagHistogram[tag.id]
      ? (tagHistogram[tag.id] += 1)
      : 1;

    if (tagHistogram[tag.id] > 1) {
      console.log(
        `${MODULE_ID_PREFIX} | SEED | TAG [${
          Object.keys(tagHistogram).length
        }] | ${tagHistogram[tag.id]} | ${tag.id}`
      );
    }
  }
  return;
};

const cursorDataHandler = async (params) => {
  const artwork = params.artwork;

  // console.log(
  //   chalkLog(
  //     `${MODULE_ID_PREFIX} | ARTWORK: ${artwork.title} | TAGS: ${artwork.tags.length}`
  //   )
  // );
  tabulateTags(artwork.tags);
  return;
};

async function artworkCursorStream(p) {
  const params = p || {};

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

    console.log(
      chalkLog(
        `${MODULE_ID_PREFIX} | ${artwork.tags.length} TAGS (${
          Object.keys(tagHistogram).length
        } TOTAL) | [${numArtworksProcessed}] ARTWORK: ${artwork.title}`
      )
    );
  });

  return;
}

NeuralNetworkTools.prototype.createInputSet = async function (p) {
  // for each artwork in db
  // - get tags
  // - tabulate tags
  // end
  //
  // return sorted tags by freq
  //

  try {
    console.log(chalk.blue(`${MODULE_ID_PREFIX} | CREATING INPUT SET ...`));

    const params = p || {};

    await artworkCursorStream();

    console.log(
      chalk.green(
        `${MODULE_ID_PREFIX} | ${Object.keys(tagHistogram).length} TAGS `
      )
    );

    const inputsDoc = new global.artyouDb.NetworkInput();

    inputsDoc.inputs = [...Object.keys(tagHistogram)];
    inputsDoc.inputs.sort();
    inputsDoc.numInputs = inputsDoc.inputs.length;

    inputsDoc.id =
      params.id ||
      `inputs_${moment().format(defaultDateTimeFormat)}_${inputsDoc.numInputs}`;

    // console.log({ inputsDoc });

    console.log(
      chalk.green(
        `${MODULE_ID_PREFIX} | +++ INPUTS | ID: ${inputsDoc.id} | ${inputsDoc.numInputs} INPUTS`
      )
    );

    return inputsDoc;
  } catch (err) {
    console.log(
      chalkError(`${MODULE_ID_PREFIX} | *** createInputs ERROR: ${err}`)
    );
    throw err;
  }
};
const createInputSet = NeuralNetworkTools.prototype.createInputSet;

NeuralNetworkTools.prototype.createInputs = async function (p) {
  // exports.NetworkInputsSchema = new Schema({
  //   id: { type: String, unique: true},
  //   meta: { type: mongoose.Schema.Types.Mixed, default: {}},
  //   inputs: { type: mongoose.Schema.Types.Mixed, default: []},
  //   networks: [],
  //   stats: { type: mongoose.Schema.Types.Mixed, default: {}},
  //   createdAt: { type: Date, default: Date.now() }
  // });

  try {
    console.log(chalkLog(`${MODULE_ID_PREFIX} | ... CREATING INPUTS`));

    const params = p || {};
    const inputsObj = {};

    // console.log({configuration})
    // console.log({params})

    inputsObj.id = params.id || `inputs_default_${moment().valueOf()}`;
    inputsObj.numInputs =
      params.numInputs !== undefined
        ? params.numInputs
        : configuration.numInputs;
    inputsObj.meta = params.meta || {};
    inputsObj.inputs = params.inputs || [];
    inputsObj.networks = params.networks || [];
    inputsObj.stats = params.stats || {};

    // console.log({inputsObj})

    const inputsDoc = new global.artyouDb.NetworkInput(inputsObj);

    return inputsDoc;
  } catch (err) {
    console.log(
      chalkError(`${MODULE_ID_PREFIX} | *** createInputs ERROR: ${err}`)
    );
    throw err;
  }
};

// const createInputs = NeuralNetworkTools.prototype.createInputs;

NeuralNetworkTools.prototype.createJson = async function (params) {
  try {
    if (params.networkObj.networkTechnology === "tensorflow") {
      console.log(
        chalkLog(
          `${MODULE_ID_PREFIX} | ... CREATE TENSORFLOW JSON | NN ID: ${params.networkObj.id}`
        )
      );

      const networkSaveResult = await params.networkObj.network.save(
        tensorflow.io.withSaveHandler(async (modelArtifacts) => modelArtifacts)
      );
      networkSaveResult.weightData = Buffer.from(
        networkSaveResult.weightData
      ).toString("base64");

      return JSON.stringify(networkSaveResult);
    }

    throw new Error(
      `${MODULE_ID_PREFIX} | *** UNKNOWN NETWORK TECH: ${params.networkObj.networkTechnology}`
    );
  } catch (err) {
    console.log(
      chalkError(MODULE_ID_PREFIX + " | *** createNetwork ERROR: " + err)
    );
    throw err;
  }
};

const createJson = NeuralNetworkTools.prototype.createJson;

NeuralNetworkTools.prototype.convertNetwork = async function (params) {
  try {
    const nnObj = params.networkObj;

    if (empty(nnObj.networkJson)) {
      console.log(
        chalkError(
          `${MODULE_ID_PREFIX} | convertNetwork | *** NO JSON | TECH: ${nnObj.networkTechnology} | NN ID: ${nnObj.id}`
        )
      );
      throw new Error("NO JSON NN");
    }

    console.log(
      chalkLog(
        `${MODULE_ID_PREFIX} | convertNetwork | TECH: ${nnObj.networkTechnology} | NNID: ${nnObj.id}`
      )
    );

    if (nnObj.networkTechnology === "tensorflow") {
      nnObj.network = await convertTensorFlow({
        networkJson: nnObj.networkJson,
      });
    }
    return nnObj;
  } catch (err) {
    console.log(
      chalkError(`${MODULE_ID_PREFIX} | *** convertNetwork ERROR: ${err}`)
    );
    throw err;
  }
};

const convertNetwork = NeuralNetworkTools.prototype.convertNetwork;
const createNetwork = NeuralNetworkTools.prototype.createNetwork;

let currentFitTensorflowNetwork = null;

async function modelCursorStream(p) {
  const params = p || {};
  const inputsDoc = params.inputsDoc;
  const normalizeFactor = params.normalizeFactor;
  const createDataObj = params.createDataObj;
  const model = params.model;
  const query = params.query || {};
  const maxCount = params.maxCount || null;

  const cursor = global.artyouDb[model]
    .find(query)
    .limit(maxCount)
    .populate({
      path: "artwork",
      populate: { path: "tags", select: "id" },
    })
    .populate("user")
    .lean()
    .cursor();

  let numProcessed = 0;
  const results = [];

  await cursor.eachAsync(async function (doc) {
    if (!doc) {
      cursor.close();
      console.log(`CURSOR CLOSED`);
    }

    // const { artworkDoc, inputsDoc, ratingDoc, normalizeFactor } = params;

    const result = await createDataObj({
      artworkDoc: doc.artwork,
      ratingDoc: doc,
      inputsDoc: inputsDoc,
      normalizeFactor: normalizeFactor,
    });
    results.push(result);
    numProcessed++;

    // console.log(
    //   chalkLog(
    //     `${MODULE_ID_PREFIX} | [${numProcessed}] DOC | ${model} | ID: ${doc.id} | RATE: ${doc.rate} | ARTWORK: ${doc.artwork.title}`
    //   )
    // );
  });

  console.log(
    chalk.green(
      `NNT | ========================================================`
    )
  );
  console.log(
    chalk.green(
      `NNT | CURSOR END | MODEL: ${model} | ${numProcessed} PROCESSED`
    )
  );
  console.log(
    chalk.green(
      `NNT | ========================================================`
    )
  );
  return results;

  // return;
}

NeuralNetworkTools.prototype.createDataObj = async (params) => {
  const { artworkDoc, inputsDoc, ratingDoc, normalizeFactor } = params;
  const inputTags = artworkDoc.tags.map((tag) => tag.id);

  const datum = {};
  datum.hits = [];
  datum.misses = [];
  datum.input = Array.from({ length: inputsDoc.numInputs }, () => 0);
  datum.input = inputsDoc.inputs.map((inputTag) => {
    if (inputTags.includes(inputTag)) {
      datum.hits.push(inputTag);
      return 1;
    }
    datum.misses.push(inputTag);
    return 0;
  });
  datum.output = ratingDoc ? ratingDoc.rate * normalizeFactor : 0;
  return { datum: datum };
};

const createDataObj = NeuralNetworkTools.prototype.createDataObj;

NeuralNetworkTools.prototype.createTrainingSet = async function (p) {
  try {
    const params = p || {};
    const normalizeFactor = params.normalizeFactor || 0.2; // 0-5 stars
    const inputsId = params.inputsId;
    const userOauthID = params.userOauthID || "twitter|848591649575927810";

    console.log(
      chalk.blue(
        `${MODULE_ID_PREFIX} | CREATE TRAINING SET | USER OAUTH ID: ${userOauthID} | INPUTS ID: ${inputsId}`
      )
    );

    const userDoc = await global.artyouDb.User.findOne({
      oauthID: userOauthID,
    });

    if (!userDoc) {
      console.log(
        chalkAlert(
          `${MODULE_ID_PREFIX} | createTrainingSet | !!! USER NOT FOUND IN DB | OAUTH ID ${userOauthID}`
        )
      );
    } else {
      console.log(
        chalk.blue(
          `${MODULE_ID_PREFIX} | USER | OAUTH ID ${userDoc.oauthID} | NAME: ${userDoc.name} `
        )
      );
    }

    const inputsDoc = await global.artyouDb.NetworkInput.findOne({
      id: inputsId,
    });

    console.log(
      chalk.blue(
        `${MODULE_ID_PREFIX} | INPUTS | ID ${inputsDoc.id} ${inputsDoc.numInputs} INPUTS `
      )
    );

    let query = {};

    if (userDoc) {
      query = { user: userDoc };
    }

    const trainingSet = await modelCursorStream({
      createDataObj: createDataObj,
      model: "Rating",
      normalizeFactor: normalizeFactor,
      query: query,
      inputsDoc: inputsDoc,
    });

    console.log(
      chalk.green(
        `NNT | ========================================================`
      )
    );
    console.log(
      chalk.green(
        `NNT | CREATE TRAINING SET COMPLETE | ${trainingSet.length} DATA`
      )
    );
    console.log(
      chalk.green(
        `NNT | ========================================================`
      )
    );
    return trainingSet;
  } catch (err) {
    console.log(
      chalkError(`${MODULE_ID_PREFIX} | *** createTrainingSet ERROR: ${err}`)
    );
    throw err;
  }
};
const createTrainingSet = NeuralNetworkTools.prototype.createTrainingSet;

NeuralNetworkTools.prototype.abortFit = async function () {
  try {
    if (currentFitTensorflowNetwork) {
      console.log(chalkAlert(`${MODULE_ID_PREFIX} | XXX TENSORFLOW ABORT FIT`));
      currentFitTensorflowNetwork.stopTraining = true;
    }
    return;
  } catch (err) {
    console.log(
      chalkError(`${MODULE_ID_PREFIX} | *** TENSORFLOW ABORT FIT ERROR: ${err}`)
    );
    throw err;
  }
};

NeuralNetworkTools.prototype.fit = async function (params) {
  try {
    const defaultOnEpochEnd = (epoch, logs) => {
      console.log(
        chalkLog(
          `${MODULE_ID_PREFIX} | TENSOR FIT | EPOCH: ${epoch} | LOSS: ${logs.loss.toFixed(
            3
          )} | ACC: ${logs.acc.toFixed(6)}`
        )
      );
    };

    if (params.verbose) {
      console.log(chalkLog(`${MODULE_ID_PREFIX} | TENSORFLOW FIT PARAMS"`));
      console.log({ params });
    }

    const onEpochEnd = params.onEpochEnd || defaultOnEpochEnd;

    currentFitTensorflowNetwork = params.network;

    const defaultOptions = {};
    defaultOptions.epochs = 1000;
    defaultOptions.batchSize = 20;
    defaultOptions.verbose = 0;
    defaultOptions.callbacks = {};
    defaultOptions.callbacks.onEpochEnd = onEpochEnd;

    const options = params.options;
    defaults(options, defaultOptions);

    const trainingSetData = [];
    const trainingSetLabels = [];

    for (const dataObj of params.trainingSet) {
      trainingSetData.push(dataObj.datum.input);
      trainingSetLabels.push(dataObj.datum.output);
    }

    const results = await currentFitTensorflowNetwork.fit(
      tensorflow.tensor(trainingSetData),
      tensorflow.tensor(trainingSetLabels),
      options
    );

    return { network: currentFitTensorflowNetwork, stats: results };
  } catch (err) {
    currentFitTensorflowNetwork = null;
    console.log(
      chalkError(`${MODULE_ID_PREFIX} | *** TENSORFLOW FIT ERROR: ${err}`)
    );
    throw err;
  }
};

const fit = NeuralNetworkTools.prototype.fit;

NeuralNetworkTools.prototype.activateNetwork = async function (params) {
  // const verbose = configuration.verbose || params.verbose;
  const nnId = params.id;

  if (!networksHashMap.has(nnId)) {
    console.log(
      chalkError(`${MODULE_ID_PREFIX} | *** NN NOT IN HASHMAP: ${nnId}`)
    );
    throw new Error(`${MODULE_ID_PREFIX} | *** NN NOT IN HASHMAP: ${nnId}`);
  }

  const nnObj = networksHashMap.get(nnId);

  if (nnObj.network.predict === undefined) {
    console.log(
      chalkAlert(
        MODULE_ID_PREFIX +
          " | NN PREDICT UNDEFINED" +
          " | TECH: " +
          nnObj.networkTechnology +
          " | ID: " +
          nnObj.id +
          " | INPUTS: " +
          nnObj.inputs
      )
    );

    networksHashMap.delete(nnId);

    throw new Error("ACTIVATE_UNDEFINED: " + nnObj.id);
  }

  if (nnObj.meta === undefined) {
    nnObj.meta = {};
  }

  const prediction = nnObj.network
    .predict([
      tensorflow.tensor(params.dataObj.datum.input, [
        1,
        params.dataObj.datum.input.length,
      ]),
    ])
    .arraySync();

  const networkOutput = {};
  networkOutput.nnId = nnId;
  networkOutput.id = nnId;
  networkOutput.output = parseFloat(prediction[0]);
  networkOutput.inputHits = params.dataObj.datum.hits;
  networkOutput.inputMisses = params.dataObj.datum.misses;
  networkOutput.inputHitRatePercent = params.dataObj.inputHitRatePercent;
  networkOutput.inputHitRatePercent =
    (100 * networkOutput.inputHits) / params.dataObj.datum.input.length;
  if (params.verbose) {
    console.log(
      chalkLog(
        `TENSORFLOW | ${
          networkOutput.id
        } | EXPECTED: ${params.dataObj.datum.output.toFixed(
          3
        )} | PREDICTION: ${networkOutput.output.toFixed(3)}`
      )
    );
  }

  return networkOutput;
};

const activateNetwork = NeuralNetworkTools.prototype.activateNetwork;

// const findOneAndUpdateOptions = {
//   new: true,
//   upsert: true,
// };

NeuralNetworkTools.prototype.updateRecommendations = async function (p) {
  try {
    const params = p || {};
    const verbose = params.verbose || false;
    const networkId = params.networkId;
    const userOauthID = params.userOauthID || "twitter|848591649575927810";
    const normalizeFactor = params.normalizeFactor || 0.2; // 0-5 stars

    console.log(chalk.blue(`NNT | ################################`));
    console.log(chalk.blue(`NNT | ###  UPDATE RECOMMENDATIONS  ###`));
    console.log(chalk.blue(`NNT | USER OAUTH ID: ${userOauthID}`));
    console.log(chalk.blue(`NNT | NN ID: ${networkId}`));
    console.log(chalk.blue(`NNT | ################################`));

    const userDoc = await global.artyouDb.User.findOne({
      oauthID: userOauthID,
    });

    console.log(
      `NNT | LOAD DB NN DOC | ${networkId} | OAUTH ID: ${userOauthID}`
    );

    const nnDoc = await global.artyouDb.NeuralNetwork.findOne({
      id: networkId,
    }).populate("networkInput");

    console.log(
      `NNT | LOADED DB NN DOC | ID: ${nnDoc.id} | INPUTS ID: ${nnDoc.networkInput.id} | NUM INPUTS: ${nnDoc.numInputs} | HL: ${nnDoc.hiddenLayerSize}`
    );

    await loadNetwork({ networkObj: nnDoc });

    await convertNetwork({ networkObj: nnDoc });

    const query = {};
    let numberArtworksUpdated = 0;

    const cursor = global.artyouDb.Artwork.find(query)
      .populate("artist")
      .populate("tags")
      .populate("recommendations")
      .cursor();

    cursor.on("end", () => {
      console.log(chalk.blue(`NNT | CURSOR | END`));
    });

    cursor.on("close", () => {
      console.log(chalkAlert(`NNT | CURSOR | CLOSED`));
    });

    cursor.on("error", (err) => {
      console.log(chalkError(`NNT | CURSOR | ERROR: ${err}`));
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
        recDoc.score = predictResults.output;
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
      await artworkDoc.save();
      numberArtworksUpdated += 1;
      console.log(
        chalkLog(
          `${MODULE_ID_PREFIX} | REC ID: ${dbRecDoc.id}` +
            ` | SCORE: ${dbRecDoc.score.toFixed(3)}` +
            ` |  USER: ${dbRecDoc.user.name} | OAUTH: ${dbRecDoc.user.oauthID}` +
            ` | ${numberArtworksUpdated} ARTWORKS | ID: ${dbRecDoc.artwork.title}`
        )
      );
    });
    cursor.close();

    console.log(chalk.green(`NNT | ######################################`));
    console.log(chalk.green(`NNT | RECOMMENDATIONS UPDATE COMPLETE`));
    console.log(chalk.green(`NNT | USER: ${userDoc.name}`));
    console.log(chalk.green(`NNT | OAUTH ID: ${userOauthID}`));
    console.log(chalk.green(`NNT | NN ID: ${networkId}`));
    console.log(
      chalk.green(`NNT | ARTWORKS UPDATED: ${numberArtworksUpdated}`)
    );
    console.log(chalk.green(`NNT | ######################################`));

    return;
  } catch (err) {
    console.log(chalk.red.bold(`NNT | #####################################`));
    console.log(chalk.red.bold(err));
    console.log(chalk.red.bold(`NNT | #####################################`));

    throw err;
  }
};

const updateRecommendations =
  NeuralNetworkTools.prototype.updateRecommendations;

// NeuralNetworkTools.prototype.runNetworkTest = async function (p) {
//   try {
//     console.log(chalk.blue(`NNT | #####################################`));
//     console.log(chalk.blue(`NNT | ###  RUNNING NEURAL NETWORK TEST  ###`));
//     console.log(chalk.blue(`NNT | #####################################`));

//     const params = p || {};
//     const verbose = params.verbose || false;
//     const userOauthID = params.userOauthID || "twitter|848591649575927810";

//     console.log(
//       `NNT | CREATE DEFAULT INPUTS DOC | NUM INPUTS: ${configuration.numInputs}`
//     );
//     const testInputsDoc = await createInputSet();

//     console.log(`NNT | SAVE DB INPUTS DOC | ${testInputsDoc.id}`);
//     // console.log(testInputsDoc)

//     await testInputsDoc.save();
//     console.log(`NNT | LOAD DB INPUTS DOC | ${testInputsDoc.id}`);

//     const loadedInputsDoc = await global.artyouDb.NetworkInput.findOne({
//       id: testInputsDoc.id,
//     });

//     console.log(`NNT | CREATE NN DOC | INPUTS: ${loadedInputsDoc.id}`);

//     const testNetworkDoc = await createNetwork({
//       inputsDoc: loadedInputsDoc,
//     });

//     console.log(`NNT | ... COMPILING TEST TENSORFLOW NETWORK`);

//     testNetworkDoc.network.compile({
//       optimizer: "sgd",
//       loss: "meanSquaredError",
//       metrics: ["accuracy"],
//     });

//     const totalSet = await createTrainingSet({
//       inputsId: loadedInputsDoc.id,
//       userOauthID: userOauthID,
//     });

//     const trainingSetSize = Math.floor(totalSet.length * 0.85);
//     const trainingSet = _.slice(totalSet, 0, trainingSetSize);
//     const testSet = _.slice(totalSet, trainingSetSize);
//     let resultsFit = {};

//     if (totalSet.length > 0) {
//       console.log(
//         `NNT | TRAINING SET: ${trainingSet.length} | TEST SET: ${testSet.length}`
//       );

//       const schedStartTime = moment().valueOf();

//       const fitOptions = {};
//       fitOptions.epochs = configuration.fit.epochs;
//       fitOptions.callbacks = {};
//       fitOptions.callbacks.onEpochEnd = (epoch, logs) => {
//         const elapsedInt = moment().valueOf() - schedStartTime;
//         const epochRate = epoch > 0 ? elapsedInt / epoch : 0;
//         const timeToCompleteMS = epochRate * (fitOptions.epochs - epoch);

//         const error = logs.loss ? logs.loss.toFixed(6) : 999999999;

//         if (epoch % 100 === 0) {
//           console.log(
//             `NNT | FIT | EPOCH ${epoch}/${fitOptions.epochs}` +
//               ` | RATE: ${epochRate.toFixed(1)} epochs/s` +
//               ` | ETC: ${msToTime(Math.floor(timeToCompleteMS))}` +
//               ` | ERROR: ${error}`
//           );
//         }
//       };

//       resultsFit = await fit({
//         id: testNetworkDoc.id,
//         options: fitOptions,
//         network: testNetworkDoc.network,
//         trainingSet: trainingSet,
//       });

//       console.log(
//         chalk.green(
//           `============================================================================================`
//         )
//       );
//       console.log(
//         chalk.green(
//           `NNT | FIT COMPLETE | NN ID: ${testNetworkDoc.id} | EPOCHS ${resultsFit.stats.params.epochs}`
//         )
//       );
//       console.log(
//         chalk.green(
//           `============================================================================================`
//         )
//       );
//     }

//     console.log(`NNT | CREATE JSON | ${testNetworkDoc.id}`);

//     testNetworkDoc.networkJson = await createJson({
//       networkObj: testNetworkDoc,
//     });

//     testNetworkDoc.network = null;

//     console.log(`NNT | SAVE DB NN DOC | ${testNetworkDoc.id}`);

//     delete testNetworkDoc.network;

//     testNetworkDoc.meta.user = {};
//     testNetworkDoc.meta.user.oauthID = userOauthID;

//     testNetworkDoc.networkInput = loadedInputsDoc;
//     await testNetworkDoc.save();

//     console.log(
//       `NNT | LOAD DB NN DOC | ${testNetworkDoc.id} | userOauthID: ${testNetworkDoc.meta.user.oauthID}`
//     );

//     const loadedNnDoc = await global.artyouDb.NeuralNetwork.findOne({
//       id: testNetworkDoc.id,
//     }).lean();

//     console.log(
//       `NNT | LOADED DB NN DOC | ID: ${loadedNnDoc.id} | INPUTS: ${loadedNnDoc.numInputs} | HL: ${loadedNnDoc.hiddenLayerSize}`
//     );

//     await loadNetwork({ networkObj: loadedNnDoc });

//     const reloadedNnObj = await convertNetwork({ networkObj: loadedNnDoc });

//     console.log(
//       `NNT | RELOADED DB NN DOC | ID: ${reloadedNnObj.id} | userOauthID: ${reloadedNnObj.meta.user.oauthID} | INPUTS: ${reloadedNnObj.numInputs} | HL: ${reloadedNnObj.hiddenLayerSize}`
//     );

//     if (totalSet.length > 0) {
//       for (const dataObj of testSet) {
//         if (dataObj.datum.hits.length > 0)
//           console.log(`INPUT HITS`, dataObj.datum.hits);

//         dataObj.inputHits = dataObj.datum.hits.length;
//         dataObj.inputMisses = dataObj.datum.misses.length;
//         dataObj.inputHitRatePercent =
//           (100 * dataObj.inputHits) / dataObj.datum.input.length;

//         const predictResults = await activateNetwork({
//           id: reloadedNnObj.id,
//           dataObj: dataObj,
//           verbose: true,
//         });

//         if (verbose) console.log({ predictResults });
//       }
//     }

//     console.log(chalk.green(`NNT | #####################################`));
//     console.log(chalk.green(`NNT | ###  NEURAL NETWORK TEST: PASSED  ###`));
//     console.log(chalk.green(`NNT | #####################################`));

//     // await updateRecommendations({
//     //   userOauthID: userOauthID,
//     //   networkId: reloadedNnObj.id,
//     //   verbose: verbose,
//     // });

//     return {
//       id: reloadedNnObj.id,
//       results: resultsFit,
//     };
//   } catch (err) {
//     currentFitTensorflowNetwork = null;

//     console.log(chalk.red.bold(`NNT | #####################################`));
//     console.log(chalk.red.bold(`NNT | ###  NEURAL NETWORK TEST: FAILED  ###`));
//     console.log(chalk.red.bold(`NNT | #####################################`));

//     console.log(chalk.red.bold(err));

//     throw err;
//   }
// };

NeuralNetworkTools.prototype.createUserNetwork = async function (p) {
  try {
    const params = p || {};
    const verbose = params.verbose || false;
    const userOauthID = params.userOauthID || "twitter|848591649575927810";
    const inputsId = params.inputsId || false;

    console.log(chalk.blue(`NNT | #####################################`));
    console.log(chalk.blue(`NNT | CREATE USER NEURAL NETWORK`));
    console.log(chalk.blue(`NNT | OAUTH ID:  ${userOauthID}`));
    console.log(chalk.blue(`NNT | INPUTS ID: ${inputsId}`));
    console.log(chalk.blue(`NNT | #####################################`));

    let inputsDoc;

    if (!inputsId) {
      console.log(`NNT | createUserNetwork | CREATING INPUTS DOC`);
      inputsDoc = await createInputSet();

      // console.log(`NNT | SAVE DB INPUTS DOC | ${inputsDoc.id}`);

      await inputsDoc.save();
      console.log(
        `NNT | createUserNetwork | CREATED INPUTS DOC | ${inputsDoc.id} | NUM INPUTS: ${inputsDoc.numInputs}`
      );
    } else {
      console.log(`NNT | createUserNetwork | LOADING INPUTS DOC`);
      inputsDoc = await global.artyouDb.NetworkInput.findOne({
        id: inputsId,
      });

      console.log(
        `NNT | createUserNetwork | LOADED INPUTS DOC | ${inputsDoc.id} | NUM INPUTS: ${inputsDoc.numInputs}`
      );
    }

    console.log(`NNT | createUserNetwork | CREATING NN DOC`);

    const networkDoc = await createNetwork({
      inputsDoc: inputsDoc,
    });

    console.log(`NNT | createUserNetwork | CREATED NN DOC | ${networkDoc.id}`);
    console.log(
      `NNT | createUserNetwork | ... COMPILING TEST TENSORFLOW NETWORK`
    );

    networkDoc.network.compile({
      optimizer: "sgd",
      loss: "meanSquaredError",
      metrics: ["accuracy"],
    });

    const totalSet = await createTrainingSet({
      inputsId: inputsDoc.id,
      userOauthID: userOauthID,
    });

    const trainingSetSize = Math.floor(totalSet.length * 0.85);
    const trainingSet = _.slice(totalSet, 0, trainingSetSize);
    const testSet = _.slice(totalSet, trainingSetSize);
    let resultsFit = {};

    if (totalSet.length > 0) {
      console.log(
        `NNT | createUserNetwork | TRAINING SET: ${trainingSet.length} | TEST SET: ${testSet.length}`
      );

      const schedStartTime = moment().valueOf();

      const fitOptions = {};
      fitOptions.epochs = configuration.fit.epochs;
      fitOptions.callbacks = {};
      fitOptions.callbacks.onEpochEnd = (epoch, logs) => {
        const elapsedInt = moment().valueOf() - schedStartTime;
        const epochRate = epoch > 0 ? elapsedInt / epoch : 0;
        const timeToCompleteMS = epochRate * (fitOptions.epochs - epoch);

        const error = logs.loss ? logs.loss.toFixed(6) : 999999999;

        if (epoch % 100 === 0) {
          console.log(
            `NNT | createUserNetwork | FIT | EPOCH ${epoch}/${fitOptions.epochs}` +
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
          `NNT | createUserNetwork | FIT COMPLETE | NN ID: ${networkDoc.id} | EPOCHS ${resultsFit.stats.params.epochs}`
        )
      );
      console.log(
        chalk.green(
          `============================================================================================`
        )
      );
    }

    console.log(`NNT | createUserNetwork | CREATE JSON | ${networkDoc.id}`);

    networkDoc.networkJson = await createJson({
      networkObj: networkDoc,
    });

    networkDoc.network = null;

    console.log(`NNT | createUserNetwork | SAVE DB NN DOC | ${networkDoc.id}`);

    delete networkDoc.network;

    networkDoc.meta.user = {};
    networkDoc.meta.user.oauthID = userOauthID;

    networkDoc.networkInput = inputsDoc;
    await networkDoc.save();

    console.log(
      `NNT | createUserNetwork | LOAD DB NN DOC | ${networkDoc.id} | userOauthID: ${networkDoc.meta.user.oauthID}`
    );

    const loadedNnDoc = await global.artyouDb.NeuralNetwork.findOne({
      id: networkDoc.id,
    }).lean();

    console.log(
      `NNT | createUserNetwork | LOADED DB NN DOC | ID: ${loadedNnDoc.id} | INPUTS: ${loadedNnDoc.numInputs} | HL: ${loadedNnDoc.hiddenLayerSize}`
    );

    await loadNetwork({ networkObj: loadedNnDoc });

    const reloadedNnObj = await convertNetwork({ networkObj: loadedNnDoc });

    console.log(
      `NNT | createUserNetwork | RELOADED DB NN DOC | ID: ${reloadedNnObj.id} | userOauthID: ${reloadedNnObj.meta.user.oauthID} | INPUTS: ${reloadedNnObj.numInputs} | HL: ${reloadedNnObj.hiddenLayerSize}`
    );

    if (totalSet.length > 0) {
      for (const dataObj of testSet) {
        if (dataObj.datum.hits.length > 0)
          console.log(`INPUT HITS`, dataObj.datum.hits);

        dataObj.inputHits = dataObj.datum.hits.length;
        dataObj.inputMisses = dataObj.datum.misses.length;
        dataObj.inputHitRatePercent =
          (100 * dataObj.inputHits) / dataObj.datum.input.length;

        const predictResults = await activateNetwork({
          id: reloadedNnObj.id,
          dataObj: dataObj,
          verbose: true,
        });

        if (verbose) console.log({ predictResults });
      }
    }

    console.log(
      chalk.green(
        `NNT | createUserNetwork | #####################################`
      )
    );
    console.log(
      chalk.green(
        `NNT | createUserNetwork | ###  NEURAL NETWORK TEST: PASSED  ###`
      )
    );
    console.log(
      chalk.green(
        `NNT | createUserNetwork | #####################################`
      )
    );

    await updateRecommendations({
      userOauthID: userOauthID,
      networkId: reloadedNnObj.id,
      verbose: verbose,
    });

    return {
      id: reloadedNnObj.id,
      results: resultsFit,
    };
  } catch (err) {
    currentFitTensorflowNetwork = null;

    console.log(
      chalk.red.bold(
        `NNT | createUserNetwork | #####################################`
      )
    );
    console.log(
      chalk.red.bold(
        `NNT | createUserNetwork | ###  NEURAL NETWORK TEST: FAILED  ###`
      )
    );
    console.log(
      chalk.red.bold(
        `NNT | createUserNetwork | #####################################`
      )
    );

    console.log(chalk.red.bold(err));

    throw err;
  }
};

module.exports = NeuralNetworkTools;
