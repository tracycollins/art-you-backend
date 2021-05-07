const DEFAULT_PREFIX = "NNT";
let PF = DEFAULT_PREFIX;
const DEFAULT_NETWORK_TECHNOLOGY = "tensorflow";
const DEFAULT_NUM_INPUTS = 400;
const DEFAULT_IMAGE_WIDTH = 64;
const DEFAULT_IMAGE_HEIGHT = 64;
const DEFAULT_NETWORK_FIT_EPOCHS = 1000;
const DEFAULT_NUM_OUTPUTS = 1;
const DEFAULT_HIDDEN_LAYERS_RANGE = { min: 10, max: 50 };
const DEFAULT_HIDDEN_LAYERS = 40;
const DEFAULT_ACTIVATION_INPUT = "relu";
const DEFAULT_ACTIVATION_OUTPUT = "linear";

const ONE_SECOND = 1000;
const ONE_MINUTE = 60 * ONE_SECOND;
// const ONE_HOUR = 60 * ONE_MINUTE;

const MAX_NN_AGE =
  process.env.MAX_NN_AGE !== undefined
    ? parseInt(process.env.MAX_NN_AGE)
    : 30 * ONE_MINUTE;

const configuration = {};
configuration.verbose = false;
configuration.networkTechnology = DEFAULT_NETWORK_TECHNOLOGY;
// convolution image default params
configuration.image = {};
configuration.image.width = DEFAULT_IMAGE_WIDTH;
configuration.image.height = DEFAULT_IMAGE_HEIGHT;
configuration.image.channels = 3;
configuration.fit = {};
configuration.fit.epochs = DEFAULT_NETWORK_FIT_EPOCHS;
configuration.numInputs = DEFAULT_NUM_INPUTS;
configuration.numOutputs = DEFAULT_NUM_OUTPUTS;
configuration.hiddenLayerSize =
  Math.floor(
    Math.random() *
      (DEFAULT_HIDDEN_LAYERS_RANGE.max - DEFAULT_HIDDEN_LAYERS_RANGE.min + 1)
  ) + DEFAULT_HIDDEN_LAYERS_RANGE.min;
configuration.activationInput = DEFAULT_ACTIVATION_INPUT;
configuration.activationOutput = DEFAULT_ACTIVATION_OUTPUT;

const defaultDateTimeFormat = "YYYYMMDD_HHmmss";

const fs = require("fs");
const fetch = require("node-fetch");
const FileType = require("file-type");

const { fork } = require("child_process");
const util = require("util");
const debug = require("debug")("nnt");
const EventEmitter = require("events");
const HashMap = require("hashmap").HashMap;
const defaults = require("object.defaults");
const empty = require("is-empty");
const moment = require("moment");
const _ = require("lodash");
const treeify = require("treeify");
const sharp = require("sharp");

global.art47db = require("@threeceelabs/mongoose-art47");
global.dbConnection = false;

const networksHashMap = new HashMap();
const inputsHashMap = new HashMap();

const chalk = require("chalk");
const chalkAlert = chalk.red;
const chalkError = chalk.bold.red;
const chalkLog = chalk.gray;

const tensorflow = require("@tensorflow/tfjs-node"); // eslint-disable-line global-require

const clamp = (value, min, max) => Math.min(Math.max(value, min), max);

const NeuralNetworkTools = function (app_name) {
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

util.inherits(NeuralNetworkTools, EventEmitter);

NeuralNetworkTools.prototype.verbose = function (v) {
  if (v === undefined) {
    return configuration.verbose;
  }
  configuration.verbose = v;
  console.log(chalkAlert(PF + " | --> SET VERBOSE: " + configuration.verbose));
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
const jsonPrint = NeuralNetworkTools.prototype.jsonPrint;
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
          `${PF} | !!! convertTensorFlow: TENSORFLOW JSON PARSE FAILED ... networkJson READY?`
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
    console.log(chalkError(`${PF} | *** convertTensorFlow ERROR: ${err}`));
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

    console.log(chalkLog(`${PF} | ... CREATING TENSORFLOW NETWORK`));

    const networkObj = {};

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

    networkObj.id =
      params.id ||
      `nn_tf_${process.pid}_in${networkObj.numInputs}_h${
        networkObj.hiddenLayerSize
      }_${getTimeStamp()}`;

    networkObj.image =
      params.inputsDoc && params.inputsDoc.image
        ? params.inputsDoc.image
        : configuration.image;

    const networkDoc = new global.art47db.NeuralNetwork(networkObj);

    const imageInput = tensorflow.input({
      shape: [
        networkDoc.image.width,
        networkDoc.image.height,
        networkDoc.image.channels,
      ],
    });

    const cnnLayer1 = tensorflow.layers
      .conv2d({
        kernelSize: 5,
        filters: 8,
        strides: 1,
        activation: "relu",
        kernelInitializer: "varianceScaling",
      })
      .apply(imageInput);

    const maxPoolingLayer1 = tensorflow.layers
      .maxPooling2d({ poolSize: [2, 2], strides: [2, 2] })
      .apply(cnnLayer1);

    const cnnLayer2 = tensorflow.layers
      .conv2d({
        kernelSize: 5,
        filters: 16,
        strides: 1,
        activation: "relu",
        kernelInitializer: "varianceScaling",
      })
      .apply(maxPoolingLayer1);

    const maxPoolingLayer2 = tensorflow.layers
      .maxPooling2d({ poolSize: [2, 2], strides: [2, 2] })
      .apply(cnnLayer2);

    const cnnFlatLayer = tensorflow.layers.flatten().apply(maxPoolingLayer2);

    const attributesInput = tensorflow.input({
      shape: [networkDoc.numInputs],
    });

    // console.log({ attributesInput });

    const concatLayer = tensorflow.layers
      .concatenate()
      .apply([attributesInput, cnnFlatLayer]);

    // console.log({ concatLayer });

    const hiddenLayer = tensorflow.layers
      .dense({
        units: networkDoc.hiddenLayerSize,
        activation: networkDoc.activationInput,
      })
      .apply(concatLayer);

    const outputLayer = tensorflow.layers
      .dense({
        units: 1,
        activation: networkDoc.activationOutput,
      })
      .apply(hiddenLayer);

    networkDoc.network = tensorflow.model({
      inputs: [attributesInput, imageInput],
      outputs: outputLayer,
    });

    networkDoc.network.summary();

    return networkDoc;
  } catch (err) {
    console.log(chalkError(PF + " | *** createNetwork ERROR: " + err));
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
      debug(
        `${PF} | SEED | TAG [${Object.keys(tagHistogram).length}] | ${
          tagHistogram[tag.id]
        } | ${tag.id}`
      );
    }
  }
  return;
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

  const cursor = global.art47db.Artwork.find(query)
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

NeuralNetworkTools.prototype.createInputSet = async function (p) {
  // for each artwork in db
  // - get tags
  // - tabulate tags
  // end
  //
  // return sorted tags by freq
  //
  const params = p || {};
  const oauthID = params.oauthID || "none";
  const image = params.image;

  try {
    console.log(
      chalk.blue(`${PF} | CREATING INPUT SET | OAUTH ID: ${oauthID}`)
    );

    if (image) {
      console.log(
        chalk.blue(`${PF} | CREATING INPUT SET\nIMAGE\n${jsonPrint(image)}`)
      );
    }

    await artworkCursorStream({ oauthID });

    console.log(
      chalk.green(
        `${PF} | OAUTH ID: ${oauthID}| ${
          Object.keys(tagHistogram).length
        } TAGS `
      )
    );

    const inputsDoc = new global.art47db.NetworkInput();

    inputsDoc.inputs = [...Object.keys(tagHistogram)];
    inputsDoc.inputs.sort();
    inputsDoc.numInputs = inputsDoc.inputs.length;
    inputsDoc.image = image || null;

    inputsDoc.id =
      params.id ||
      `inputs_${moment().format(defaultDateTimeFormat)}_${inputsDoc.numInputs}`;

    // console.log({ inputsDoc });

    console.log(
      chalk.green(
        `${PF} | OAUTH ID: ${oauthID}| +++ INPUTS | ID: ${inputsDoc.id} | ${inputsDoc.numInputs} INPUTS`
      )
    );

    return inputsDoc;
  } catch (err) {
    console.log(
      chalkError(`${PF} | OAUTH ID: ${oauthID}| *** createInputs ERROR: ${err}`)
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
    console.log(chalkLog(`${PF} | ... CREATING INPUTS`));

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

    const inputsDoc = new global.art47db.NetworkInput(inputsObj);

    return inputsDoc;
  } catch (err) {
    console.log(chalkError(`${PF} | *** createInputs ERROR: ${err}`));
    throw err;
  }
};

// const createInputs = NeuralNetworkTools.prototype.createInputs;

NeuralNetworkTools.prototype.createJson = async function (params) {
  try {
    if (params.networkObj.networkTechnology === "tensorflow") {
      console.log(
        chalkLog(
          `${PF} | ... CREATE TENSORFLOW JSON | NN ID: ${params.networkObj.id}`
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
      `${PF} | *** UNKNOWN NETWORK TECH: ${params.networkObj.networkTechnology}`
    );
  } catch (err) {
    console.log(chalkError(PF + " | *** createNetwork ERROR: " + err));
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
          `${PF} | convertNetwork | *** NO JSON | TECH: ${nnObj.networkTechnology} | NN ID: ${nnObj.id}`
        )
      );
      throw new Error("NO JSON NN");
    }

    console.log(
      chalkLog(
        `${PF} | convertNetwork | TECH: ${nnObj.networkTechnology} | NNID: ${nnObj.id}`
      )
    );

    if (nnObj.networkTechnology === "tensorflow") {
      nnObj.network = await convertTensorFlow({
        networkJson: nnObj.networkJson,
      });
    }
    return nnObj;
  } catch (err) {
    console.log(chalkError(`${PF} | *** convertNetwork ERROR: ${err}`));
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

  const cursor = global.art47db[model]
    .find(query)
    .limit(maxCount)
    .populate({
      path: "artwork",
      populate: { path: "image" },
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

    if (doc.artwork) {
      const result = await createDataObj({
        artworkDoc: doc.artwork,
        ratingDoc: doc,
        inputsDoc: inputsDoc,
        normalizeFactor: normalizeFactor,
      });
      results.push(result);
      numProcessed++;
    } else {
      console.log(
        chalkAlert(
          `${PF} | [${numProcessed}] ??? ARTWORK FOR RATING UNDEFINED? | DOC | ${model} | ID: ${doc.id} | RATE: ${doc.rate} | ARTWORK: ${doc.artwork}`
        )
      );
    }

    // console.log(
    //   chalkLog(
    //     `${PF} | [${numProcessed}] DOC | ${model} | ID: ${doc.id} | RATE: ${doc.rate} | ARTWORK: ${doc.artwork.title}`
    //   )
    // );
  });

  console.log(
    chalk.green(
      `${PF} | ========================================================`
    )
  );
  console.log(
    chalk.green(
      `${PF} | CURSOR END | MODEL: ${model} | ${numProcessed} PROCESSED`
    )
  );
  console.log(
    chalk.green(
      `${PF} | ========================================================`
    )
  );
  return results;

  // return;
}
NeuralNetworkTools.prototype.convertFlatTo3dArray = async (params) => {
  const { dataArray, dimensions } = params;
  const dataArrayIndex = 0;
  const data3dArray = [];
  for (let channel = 0; channel < dimensions.channels; channel++) {
    const curChannel = [];
    for (let row = 0; row < dimensions.height; row++) {
      const curRow = [];
      for (let col = 0; col < dimensions.width; col++) {
        curRow.push(dataArray[dataArrayIndex]);
        dataArrayIndex++;
      }
    }
  }
};

NeuralNetworkTools.prototype.createDataObj = async (params) => {
  const { artworkDoc, inputsDoc, ratingDoc, normalizeFactor } = params;
  const inputTags = artworkDoc.tags.map((tag) => tag.id);
  const image = inputsDoc.image
    ? inputsDoc.image
    : {
        width: configuration.image.width,
        height: configuration.image.height,
        channels: configuration.image.channels,
      };

  const datum = {};
  datum.hits = [];
  datum.misses = [];

  const imageDoc = await global.art47db.Image.findOne({
    _id: artworkDoc.image,
  });

  const fetchResponse = await fetch(imageDoc.url);
  // console.log({ fetchResponse });
  const imageArrayBuffer = await fetchResponse.arrayBuffer();
  // console.log({ imageArrayBuffer });
  const imageBuffer = Buffer.from(imageArrayBuffer);
  // console.log({ imageBuffer });
  // const imageFileType = await FileType.fromBuffer(imageBuffer);
  // let outputFileName;

  // outputFileName = `imageFile.${imageFileType.ext}`;
  // console.log(`outputFileName: ${outputFileName}`);
  // fs.createWriteStream(outputFileName).write(imageBuffer);

  const linearMultiplier = 1.0 / 256.0;
  const linearOffset = 0.0;
  const { data, info } = await sharp(imageBuffer)
    .removeAlpha()
    .resize(image.width, image.height, { fit: "cover" })
    .raw()
    .normalize()
    // .linear(linearMultiplier)
    .toBuffer({ resolveWithObject: true });

  // console.log({ data });
  // console.log({ info });
  const dataArray = new Uint8ClampedArray(data.buffer);
  // console.log({ dataArray });

  const flatArray = [];
  for (const datum of dataArray) {
    const datumNormal = datum * linearMultiplier + linearOffset;
    // console.log(`datum: ${datum} | normalized: ${datumNormal}`);
    flatArray.push(datumNormal);
  }

  // console.log({ flatArray });

  datum.imageInput = tensorflow
    .tensor1d(flatArray)
    .reshape([image.width, image.height, image.channels])
    .arraySync();

  // console.log(`datum.imageInput: ${datum.imageInput.length}`);
  // console.log(datum.imageInput);

  console.log(
    `ARTWORK` +
      ` | ${info.width} x ${info.height} x ${info.channels}` +
      ` | SIZE: ${info.size}` +
      ` | IMAGE URL: ${imageDoc.url}`
  );

  // datum.imageInput = Array.from({ length: image.height }, () => {
  //   return Array.from({ length: image.width }, () => [0, 0, 0]);
  // });

  datum.attributesInput = inputsDoc.inputs.map((inputTag) => {
    if (inputTags.includes(inputTag)) {
      datum.hits.push(inputTag);
      return 1;
    }
    datum.misses.push(inputTag);
    return 0;
  });

  // datum.input = [attributesInput, imageInput];

  datum.output = ratingDoc ? ratingDoc.rate * normalizeFactor : 0;
  return { datum: datum };
};

const createDataObj = NeuralNetworkTools.prototype.createDataObj;

NeuralNetworkTools.prototype.createTrainingSet = async function (p) {
  try {
    const params = p || {};
    const maxCount = params.maxCount || null;
    const normalizeFactor = params.normalizeFactor || 0.2; // 0-5 stars
    const inputsId = params.inputsId;
    const oauthID = params.oauthID || "twitter|848591649575927810";

    console.log(
      chalk.blue(
        `${PF} | CREATE TRAINING SET | OAUTH ID: ${oauthID} | MAX COUNT: ${maxCount} | INPUTS ID: ${inputsId}`
      )
    );

    const userDoc = await global.art47db.User.findOne({
      oauthID: oauthID,
    });

    if (!userDoc) {
      console.log(
        chalkAlert(
          `${PF} | createTrainingSet | !!! USER NOT FOUND IN DB | OAUTH ID ${oauthID}`
        )
      );
    } else {
      console.log(
        chalk.blue(
          `${PF} | USER | OAUTH ID ${userDoc.oauthID} | NAME: ${userDoc.name} `
        )
      );
    }

    const inputsDoc = await global.art47db.NetworkInput.findOne({
      id: inputsId,
    });

    console.log(
      chalk.blue(
        `${PF} | createTrainingSet | OAUTH ID: ${oauthID} | INPUTS | ID ${inputsDoc.id} | ${inputsDoc.numInputs} INPUTS `
      )
    );
    if (inputsDoc.image) {
      console.log(
        chalk.blue(
          `${PF} | createTrainingSet\nIMAGE INPUTS\n${jsonPrint(
            inputsDoc.image
          )} `
        )
      );
    }

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
      maxCount: maxCount,
    });

    console.log(
      chalk.green(
        `${PF} | ========================================================`
      )
    );
    console.log(
      chalk.green(
        `${PF} | OAUTH ID: ${oauthID} | CREATE TRAINING SET COMPLETE | ${trainingSet.length} DATA`
      )
    );
    console.log(
      chalk.green(
        `${PF} | ========================================================`
      )
    );
    return trainingSet;
  } catch (err) {
    console.log(chalkError(`${PF} | *** createTrainingSet ERROR: ${err}`));
    throw err;
  }
};
const createTrainingSet = NeuralNetworkTools.prototype.createTrainingSet;

NeuralNetworkTools.prototype.abortFit = async function () {
  try {
    if (currentFitTensorflowNetwork) {
      console.log(chalkAlert(`${PF} | XXX TENSORFLOW ABORT FIT`));
      currentFitTensorflowNetwork.stopTraining = true;
    }
    return;
  } catch (err) {
    console.log(chalkError(`${PF} | *** TENSORFLOW ABORT FIT ERROR: ${err}`));
    throw err;
  }
};

NeuralNetworkTools.prototype.fit = async function (params) {
  try {
    const defaultOnEpochEnd = (epoch, logs) => {
      console.log(
        chalkLog(
          `${PF} | TENSOR FIT | EPOCH: ${epoch} | LOSS: ${logs.loss.toFixed(
            3
          )} | ACC: ${logs.acc.toFixed(6)}`
        )
      );
    };

    if (params.verbose) {
      console.log(chalkLog(`${PF} | TENSORFLOW FIT PARAMS"`));
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

    const trainingSetDataImage = [];
    const trainingSetDataAttributes = [];
    const trainingSetLabels = [];
    // const imageShape = [params.trainingSet.length, 12288];

    for (const dataObj of params.trainingSet) {
      trainingSetDataAttributes.push(dataObj.datum.attributesInput);
      trainingSetDataImage.push(dataObj.datum.imageInput);
      trainingSetLabels.push(dataObj.datum.output);
    }

    const results = await currentFitTensorflowNetwork.fit(
      [
        tensorflow.tensor(trainingSetDataAttributes),
        tensorflow.tensor(trainingSetDataImage),
      ],
      tensorflow.tensor(trainingSetLabels),
      options
    );

    return { network: currentFitTensorflowNetwork, stats: results };
  } catch (err) {
    currentFitTensorflowNetwork = null;
    console.log(chalkError(`${PF} | *** TENSORFLOW FIT ERROR: ${err}`));
    throw err;
  }
};

const fit = NeuralNetworkTools.prototype.fit;

NeuralNetworkTools.prototype.activateNetwork = async function (params) {
  const verbose = params.verbose || configuration.verbose;
  let network = params.network || null;

  // console.log({ params });
  // console.log(params.dataObj.datum.imageInput);

  const nnId = params.id;

  if (!network && !networksHashMap.has(nnId)) {
    console.log(
      chalkError(`${PF} | *** NO NETEWORK AND NN NOT IN HASHMAP: ${nnId}`)
    );
    throw new Error(`${PF} | *** NO NETEWORK AND NN NOT IN HASHMAP: ${nnId}`);
  }

  let nnObj;

  if (!network) {
    nnObj = networksHashMap.get(nnId);
    if (nnObj.network.predict === undefined) {
      console.log(
        chalkAlert(
          PF +
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

    network = nnObj.network;
  }

  // for (const dataObj of params.trainingSet) {
  //   trainingSetDataAttributes.push(dataObj.datum.attributesInput);
  //   trainingSetDataImage.push(dataObj.datum.imageInput);
  //   trainingSetLabels.push(dataObj.datum.output);
  // }

  // const results = await currentFitTensorflowNetwork.fit(
  //   [
  //     tensorflow.tensor(trainingSetDataAttributes),
  //     tensorflow.tensor(trainingSetDataImage),
  //   ],
  //   tensorflow.tensor(trainingSetLabels),
  //   options
  // );

  try {
    const prediction = await network
      // .predict([
      //   tensorflow.tensor(params.dataObj.datum.input, [
      //     1,
      //     params.dataObj.datum.input.length,
      //   ]),
      // ])
      // .predict([
      //   tensorflow.tensor(params.dataObj.datum.attributesInput, [
      //     1,
      //     params.dataObj.datum.attributesInput.length,
      //   ]),
      //   tensorflow.tensor([params.dataObj.datum.imageInput], [1, 64, 64, 3]),
      // ])

      .predict([
        tensorflow.tensor([params.dataObj.datum.attributesInput]),
        tensorflow.tensor([params.dataObj.datum.imageInput]),
      ])
      .array();

    // console.log({ prediction });
    // console.log(prediction[0]);

    const nnOut = parseFloat(prediction[0]);
    const error = nnOut - params.dataObj.datum.output;
    console.log(
      chalkLog(
        `${PF} | TEST` +
          ` | ${nnId}` +
          ` | DATUM: ${params.dataObj.datum.output.toFixed(5)}` +
          ` | NN OUT: ${nnOut.toFixed(5)}` +
          ` | ERROR: ${error.toFixed(5)}`
      )
    );

    const networkOutput = {};
    networkOutput.nnId = nnId;
    networkOutput.id = nnId;
    networkOutput.output = parseFloat(prediction[0]);
    networkOutput.inputHits = params.dataObj.inputHits;
    networkOutput.inputMisses = params.dataObj.inputMisses;
    networkOutput.inputHitRatePercent = params.dataObj.inputHitRatePercent;
    // networkOutput.inputHitRatePercent =
    //   (100 * networkOutput.inputHits) / params.dataObj.datum.imageInput.length;
    // if (verbose) {
    //   console.log(
    //     chalkLog(
    //       `TENSORFLOW | ${
    //         networkOutput.id
    //       } | EXPECTED: ${params.dataObj.datum.output.toFixed(
    //         3
    //       )} | PREDICTION: ${networkOutput.output.toFixed(3)}`
    //     )
    //   );
    // }

    return networkOutput;
  } catch (err) {
    console.trace(err);
    throw err;
  }
};

const activateNetwork = NeuralNetworkTools.prototype.activateNetwork;

NeuralNetworkTools.prototype.calculateRatingAverage = async function (p) {
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

const calculateRatingAverage =
  NeuralNetworkTools.prototype.calculateRatingAverage;

NeuralNetworkTools.prototype.updateRecommendations = async function (p) {
  try {
    const params = p || {};
    const job = params.job || { attrs: { _id: "UNDEFINEDD" } };
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
    console.log(chalk.blue(`${PF} | JOB ID:        ${job._id}`));
    console.log(chalk.blue(`${PF} | USER OAUTH ID: ${oauthID}`));
    console.log(chalk.blue(`${PF} | NN ID:         ${results.networkId}`));
    console.log(chalk.blue(`${PF} | EPOCHS:        ${epochs}`));
    console.log(
      chalk.blue(`${PF} | #########################################`)
    );

    const userDoc = await global.art47db.User.findOne({
      oauthID: oauthID,
    }).populate({ path: "network", select: { id: 1, createdAt: 1, meta: 1 } });

    let nnDoc;
    if (results.networkId) {
      console.log(`${PF} | LOADING DB NN | ID: ${results.networkId}`);
      nnDoc = await global.art47db.NeuralNetwork.findOne({
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
        nnDoc = await global.art47db.NeuralNetwork.findOne({
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
        nnDoc = await global.art47db.NeuralNetwork.findOne({
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
      nnDoc = await global.art47db.NeuralNetwork.findOne({
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

    const cursor = global.art47db.Artwork.find(query)
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

      let recDoc = await global.art47db.Recommendation.findOne({
        user: userDoc,
        artwork: artworkDoc,
      })
        .populate("network")
        .populate("user")
        .populate("artwork");

      if (recDoc) {
        recDoc.network = nnDoc;
        recDoc.score = parseInt(100 * clamp(predictResults.output, 0, 1));
      } else {
        recDoc = new global.art47db.Recommendation({
          user: userDoc,
          artwork: artworkDoc,
          network: nnDoc,
          score: parseInt(100 * clamp(predictResults.output, 0, 1)),
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
              ` | SCORE: ${dbRecDoc.score}` +
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

NeuralNetworkTools.prototype.createUserNetwork = async function (p) {
  try {
    const params = p || {};
    const maxCount = params.maxCount || null;
    const epochs = params.epochs || configuration.fit.epochs;
    const verbose = params.verbose || false;
    const oauthID = params.oauthID || "twitter|848591649575927810";
    const inputsId = params.inputsId || false;

    console.log(chalk.blue(`${PF} | #####################################`));
    console.log(chalk.blue(`${PF} | CREATE USER NEURAL NETWORK`));
    console.log(chalk.blue(`${PF} | OAUTH ID:  ${oauthID}`));
    console.log(chalk.blue(`${PF} | INPUTS ID: ${inputsId}`));
    console.log(chalk.blue(`${PF} | MAX COUNT: ${maxCount}`));
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
      inputsDoc = await global.art47db.NetworkInput.findOne({
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
      maxCount: maxCount,
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
              ` | RATE: ${epochRate.toFixed(1)} secs/epoch` +
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

    if (testSet.length > 0) {
      for (const dataObj of testSet) {
        // console.log({ dataObj });
        if (dataObj.datum.hits.length > 0)
          debug(
            `${PF} | createUserNetwork | OAUTH ID: ${oauthID}` +
              ` | INPUT HITS: ${dataObj.datum.hits.length}`
          );

        dataObj.inputHits = dataObj.datum.hits.length;
        dataObj.inputMisses = dataObj.datum.misses.length;
        dataObj.inputHitRatePercent =
          (100 * dataObj.inputHits) / dataObj.datum.imageInput.length;

        const predictResults = await activateNetwork({
          id: networkDoc.id,
          network: networkDoc.network,
          dataObj: dataObj,
          verbose: verbose,
        });

        if (verbose) console.log({ predictResults });
      }
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

    const loadedNnDoc = await global.art47db.NeuralNetwork.findOne({
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
        `\n${PF} | RELOADED DB NN DOC | ID: ${reloadedNnObj.id}` +
        `\n${PF} | oauthID: ${reloadedNnObj.meta.user.oauthID}` +
        `\n${PF} | INPUTS: ${reloadedNnObj.numInputs}` +
        `\n${PF} | HL: ${reloadedNnObj.hiddenLayerSize}` +
        `\n${PF} | IMAGE ${reloadedNnObj.image.width} x ${reloadedNnObj.image.height} x ${reloadedNnObj.image.channels}`
    );

    // if (testSet.length > 0) {
    //   for (const dataObj of testSet) {
    //     // console.log({ dataObj });
    //     if (dataObj.datum.hits.length > 0)
    //       debug(
    //         `${PF} | createUserNetwork | OAUTH ID: ${oauthID}` +
    //           ` | INPUT HITS: ${dataObj.datum.hits.length}`
    //       );

    //     dataObj.inputHits = dataObj.datum.hits.length;
    //     dataObj.inputMisses = dataObj.datum.misses.length;
    //     dataObj.inputHitRatePercent =
    //       (100 * dataObj.inputHits) / dataObj.datum.imageInput.length;

    //     const predictResults = await activateNetwork({
    //       id: reloadedNnObj.id,
    //       dataObj: dataObj,
    //       verbose: verbose,
    //     });

    //     if (verbose) console.log({ predictResults });
    //   }
    // }

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

const createUserNetwork = NeuralNetworkTools.prototype.createUserNetwork;

NeuralNetworkTools.prototype.updateRecommendationsChild = async function (p) {
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

module.exports = NeuralNetworkTools;
