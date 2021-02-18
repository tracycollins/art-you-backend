const MODULE_ID_PREFIX = "NNT";

const DEFAULT_NETWORK_TECHNOLOGY = "tensorflow";
const DEFAULT_NUM_INPUTS = 400;
const DEFAULT_NUM_OUTPUTS = 1;
const DEFAULT_HIDDEN_LAYERS = 20;
const DEFAULT_ACTIVATION_INPUT = "relu";
const DEFAULT_ACTIVATION_OUTPUT = "softmax";

const configuration = {};
configuration.verbose = false;
configuration.networkTechnology = DEFAULT_NETWORK_TECHNOLOGY;
configuration.fit = {};
configuration.fit.epochs = 100;
configuration.numInputs = DEFAULT_NUM_INPUTS;
configuration.numOutputs = DEFAULT_NUM_OUTPUTS;
configuration.hiddenLayerSize = DEFAULT_HIDDEN_LAYERS;
configuration.activationInput = DEFAULT_ACTIVATION_INPUT;
configuration.activationOutput = DEFAULT_ACTIVATION_OUTPUT;

const util = require("util");
const EventEmitter = require("events");
const HashMap = require("hashmap").HashMap;
const defaults = require("object.defaults");
const empty = require("is-empty");
const moment = require("moment");
// const S3 = require("@aws-sdk/client-s3");

global.artyouDb = require("@threeceelabs/mongoose-artyou");
global.dbConnection = false;

const networksHashMap = new HashMap();
const inputsHashMap = new HashMap();

const chalk = require("chalk");
const chalkAlert = chalk.red;
const chalkError = chalk.bold.red;
const chalkLog = chalk.gray;

const tensorflow = require("@tensorflow/tfjs-node"); // eslint-disable-line global-require

const NeuralNetworkTools = function(app_name){
  const self = this;
  this.appname = app_name || "DEFAULT_APP_NAME";
  console.log("NNT | APP NAME: " + this.appname);

  EventEmitter.call(this);

  setTimeout(async () => {
    try{

      global.dbConnection = await global.artyouDb.connect();

      // const s3Client = new S3.S3Client({ region: "us-east-1"});
      // const listBuckets = new S3.ListBucketsCommand({});
      // const results = await s3Client.send(listBuckets);
      // console.log(`NNT | AWS | BUCKETS`)
      // console.log(results.Buckets)
    }
    catch(err){
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

NeuralNetworkTools.prototype.verbose = function(v){
  if (v === undefined) { return configuration.verbose; }
  configuration.verbose = v;
  console.log(chalkAlert(MODULE_ID_PREFIX + " | --> SET VERBOSE: " + configuration.verbose));
  return;
};

NeuralNetworkTools.prototype.loadInputs = async function(params){
  inputsHashMap.set(params.inputsObj.inputsId, params.inputsObj)
  return
};

NeuralNetworkTools.prototype.convertTensorFlow = async function(params){

  try{

    let nnJson = {}
    try{
      nnJson = JSON.parse(params.networkJson);
    }
    catch(e){
      console.log(chalkAlert(`${MODULE_ID_PREFIX} | !!! convertTensorFlow: TENSORFLOW JSON PARSE FAILED ... networkJson READY?`));
      nnJson = params.networkJson
    }

    const weightData = new Uint8Array(Buffer.from(nnJson.weightData, "base64")).buffer;
    const network = await tensorflow.loadLayersModel(tensorflow.io.fromMemory({
      modelTopology: nnJson.modelTopology,
      weightSpecs: nnJson.weightSpecs,
      weightData: weightData
    }));

    return network;
  }
  catch(err){
    console.log(chalkError(`${MODULE_ID_PREFIX} | *** convertTensorFlow ERROR: ${err}`));
    throw err
  }
};

const convertTensorFlow = NeuralNetworkTools.prototype.convertTensorFlow;

NeuralNetworkTools.prototype.loadNetwork = async function(params){
  networksHashMap.set(params.networkObj.networkId, params.networkObj)
  return
};

const loadNetwork = NeuralNetworkTools.prototype.loadNetwork;

NeuralNetworkTools.prototype.deleteAllNetworks = async function(){};

NeuralNetworkTools.prototype.deleteNetwork = async function(){};

NeuralNetworkTools.prototype.getNetworkStats = function (){};

NeuralNetworkTools.prototype.createNetwork = async function(p){

  try{
      
    const params = p || {};

    console.log(chalkLog(`${MODULE_ID_PREFIX} | ... CREATING TENSORFLOW NETWORK`));

    const networkObj = {}

    networkObj.networkId = params.networkId || `nn_defaults_${moment().valueOf()}`
    networkObj.networkTechnology = params.networkTechnology || configuration.networkTechnology;
    networkObj.inputsObj = params.inputsObj;
    networkObj.numInputs = params.inputsObj ? params.inputsObj.numInputs : configuration.numInputs;
    networkObj.numOutputs = params.numOutputs || configuration.numOutputs;
    networkObj.hiddenLayerSize = params.hiddenLayerSize || configuration.hiddenLayerSize;
    networkObj.activationInput = params.activationInput || configuration.activationInput;
    networkObj.activationOutput = params.activationOutput || configuration.activationOutput;

    const networkDoc = new global.artyouDb.NeuralNetwork(networkObj)
    
    networkDoc.network = tensorflow.sequential();

    networkDoc.network.add(tensorflow.layers.dense({
      inputShape: [networkDoc.numInputs], 
      units: networkDoc.hiddenLayerSize, 
      activation: networkDoc.activationInput
    }));

    networkDoc.network.add(tensorflow.layers.dense({
      units: networkDoc.numOutputs,
      activation: networkDoc.activationOutput
    }));

    return networkDoc;

  }
  catch(err){
    console.log(chalkError(MODULE_ID_PREFIX + " | *** createNetwork ERROR: " + err));
    throw err
  }

};

NeuralNetworkTools.prototype.createInputs = async function(p){

  // exports.NetworkInputsSchema = new Schema({
  //   inputsId: { type: String, unique: true},
  //   meta: { type: mongoose.Schema.Types.Mixed, default: {}},
  //   inputs: { type: mongoose.Schema.Types.Mixed, default: []},
  //   networks: [],
  //   stats: { type: mongoose.Schema.Types.Mixed, default: {}},
  //   createdAt: { type: Date, default: Date.now() }
  // });

  try{
    console.log(chalkLog(`${MODULE_ID_PREFIX} | ... CREATING INPUTS`));

    const params = p || {};
    const inputsObj = {}

    console.log({configuration})
    console.log({params})

    inputsObj.inputsId = params.inputsId || `inputs_default_${moment().valueOf()}`
    inputsObj.numInputs = params.numInputs !== undefined ? params.numInputs : configuration.numInputs;
    inputsObj.meta = params.meta || {}
    inputsObj.inputs = params.inputs || []
    inputsObj.networks = params.networks || []
    inputsObj.stats = params.stats || {}

    console.log({inputsObj})

    const inputsDoc = new global.artyouDb.NetworkInputs(inputsObj)
    return inputsDoc;
  }
  catch(err){
    console.log(chalkError(`${MODULE_ID_PREFIX} | *** createInputs ERROR: ${err}`));
    throw err
  }
};

const createInputs = NeuralNetworkTools.prototype.createInputs

NeuralNetworkTools.prototype.createJson = async function(params){

  try{
      
    if (params.networkObj.networkTechnology === "tensorflow") {

      console.log(chalkLog(`${MODULE_ID_PREFIX} | ... CREATE TENSORFLOW JSON | NN ID: ${params.networkObj.networkId}`));

      const networkSaveResult = await params.networkObj.network.save(tensorflow.io.withSaveHandler(async (modelArtifacts) => modelArtifacts));
      networkSaveResult.weightData = Buffer.from(networkSaveResult.weightData).toString("base64");

      return JSON.stringify(networkSaveResult);
    }

    throw new Error(`${MODULE_ID_PREFIX} | *** UNKNOWN NETWORK TECH: ${params.networkObj.networkTechnology}`);

  }
  catch(err){
    console.log(chalkError(MODULE_ID_PREFIX + " | *** createNetwork ERROR: " + err));
    throw err
  }

};

const createJson = NeuralNetworkTools.prototype.createJson

NeuralNetworkTools.prototype.convertNetwork = async function(params){

  try{
    const nnObj = params.networkObj;

    if (empty(nnObj.networkJson)) {
      console.log(chalkError(`${MODULE_ID_PREFIX} | convertNetwork | *** NO JSON | TECH: ${nnObj.networkTechnology} | NN ID: ${nnObj.networkId}`));
      throw new Error("NO JSON NN");
    }

    console.log(chalkLog(`${MODULE_ID_PREFIX} | convertNetwork | TECH: ${nnObj.networkTechnology} | NNID: ${nnObj.networkId}`));

    if (nnObj.networkTechnology === "tensorflow") {
      nnObj.network = await convertTensorFlow({networkJson: nnObj.networkJson})
    }
    return nnObj;

  }
  catch(err){
    console.log(chalkError(`${MODULE_ID_PREFIX} | *** convertNetwork ERROR: ${err}`));
    throw err;
  }

};

const convertNetwork = NeuralNetworkTools.prototype.convertNetwork;
const createNetwork = NeuralNetworkTools.prototype.createNetwork;

let currentFitTensorflowNetwork = null;

NeuralNetworkTools.prototype.abortFit = async function () {

  try{
    if (currentFitTensorflowNetwork) {
      console.log(chalkAlert(`${MODULE_ID_PREFIX} | XXX TENSORFLOW ABORT FIT`));
      currentFitTensorflowNetwork.stopTraining = true;
    }
    return;
  }
  catch(err){
    console.log(chalkError(`${MODULE_ID_PREFIX} | *** TENSORFLOW ABORT FIT ERROR: ${err}`));
    throw err;
  }
}

NeuralNetworkTools.prototype.fit = async function (params) {
  try{

    const defaultOnEpochEnd = (epoch, logs) => {
      console.log(chalkLog(`${MODULE_ID_PREFIX} | TENSOR FIT | EPOCH: ${epoch} | LOSS: ${logs.loss.toFixed(3)} | ACC: ${logs.acc.toFixed(6)}`))
    }

    if (params.verbose){
      console.log(chalkLog(`${MODULE_ID_PREFIX} | TENSORFLOW FIT PARAMS"`));
      console.log({params})
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

    for(const dataObj of params.trainingSet){
      trainingSetData.push(dataObj.datum.input)
      trainingSetLabels.push(dataObj.datum.output)
    }

    const results = await currentFitTensorflowNetwork.fit(
      tensorflow.tensor(trainingSetData), 
      tensorflow.tensor(trainingSetLabels),
      options
    );

    return {network: currentFitTensorflowNetwork, stats: results};

  }
  catch(err){
    currentFitTensorflowNetwork = null;
    console.log(chalkError(`${MODULE_ID_PREFIX} | *** TENSORFLOW FIT ERROR: ${err}`));
    throw err;
  }
};

const fit = NeuralNetworkTools.prototype.fit

NeuralNetworkTools.prototype.activateNetwork = async function (params) {

  // const verbose = configuration.verbose || params.verbose;
  const nnId = params.networkId;

  if (!networksHashMap.has(nnId)){
    console.log(chalkError(`${MODULE_ID_PREFIX} | *** NN NOT IN HASHMAP: ${nnId}`));
    throw new Error(`${MODULE_ID_PREFIX} | *** NN NOT IN HASHMAP: ${nnId}`);
  }

  const nnObj = networksHashMap.get(nnId);

  if (nnObj.network.predict === undefined){

    console.log(chalkAlert(MODULE_ID_PREFIX + " | NN PREDICT UNDEFINED"
      + " | TECH: " + nnObj.networkTechnology 
      + " | ID: " + nnObj.networkId 
      + " | INPUTS: " + nnObj.inputsId 
    ));

    networksHashMap.delete(nnId);

    throw new Error("ACTIVATE_UNDEFINED: " + nnObj.networkId);
  }

  if (nnObj.meta === undefined){
    nnObj.meta = {}
  }
    
  const prediction = nnObj.network.predict([tensorflow.tensor(params.dataObj.datum.input, [1, params.dataObj.datum.input.length])]).arraySync();

  if (params.verbose) {
    console.log(chalkAlert(`TENSORFLOW | ${nnObj.networkId} | PREDICTION: ${prediction}`))
  }

  const networkOutput = {};
  networkOutput.nnId = nnId;
  networkOutput.networkId = nnId;
  networkOutput.output = prediction[0];
  networkOutput.inputHits = params.dataObj.inputHits;
  networkOutput.inputMisses = params.dataObj.inputMisses;
  networkOutput.inputHitRate = params.dataObj.inputHitRate;

  return networkOutput;
};

const activateNetwork = NeuralNetworkTools.prototype.activateNetwork

NeuralNetworkTools.prototype.runNetworkTest = async function (p) {

  try{

    const params = p || {};

    const trainingSetSize = 100;
    const trainingSet = [];

    const testInputsDoc = await createInputs()

    console.log(testInputsDoc)

    const testNetworkDoc = await createNetwork({ inputsObj: testInputsDoc })

    console.log(`NNT | ... COMPILING TEST TENSORFLOW NETWORK`)

    testNetworkDoc.network.compile({
      optimizer: 'sgd',
      loss: 'meanSquaredError',
      metrics: ['accuracy']
    });

    for(let i=0; i < trainingSetSize; i++ ){

      const datum = {};
      datum.input = Array.from({length: testInputsDoc.numInputs}, () => Math.random());
      datum.output = Math.random();

      trainingSet.push({datum})
    }

    const schedStartTime = moment().valueOf();

    const fitOptions = {};
    fitOptions.epochs = configuration.fit.epochs;
    fitOptions.callbacks = {};
    fitOptions.callbacks.onEpochEnd = (epoch, logs) => {

      const elapsedInt = moment().valueOf() - schedStartTime;
      const epochRate = epoch > 0 ? elapsedInt / epoch : 0;
      const timeToCompleteMS = epochRate * (fitOptions.epochs - epoch);

      const error = logs.loss ? logs.loss.toFixed(6) : 999999999;

      if (epoch % 100 === 0){
        console.log(`NNT | FIT | EPOCH ${epoch} | RATE ${epochRate.toFixed(1)} | ETC: ${Math.floor(timeToCompleteMS)} | ERROR: ${error}`)
      }
    };

    const results = await fit({
      networkId: testNetworkDoc.networkId,
      options: fitOptions,
      network: testNetworkDoc.network,
      trainingSet: trainingSet,
    });

    console.log(`================================================================`)
    console.log(
      `NNT | FIT COMPLETE` +
      ` | NN ID: ${testNetworkDoc.networkId}` +
      ` | EPOCHS ${results.stats.params.epochs}`
    )
    console.log(`================================================================`)

    console.log(`NNT | CREATE JSON | ${testNetworkDoc.networkId}`)

    testNetworkDoc.networkJson = await createJson({networkObj: testNetworkDoc})

    testNetworkDoc.network = null;

    // console.log(`NNT | CREATE DB DOC | ${testNetworkObj.networkId}`)

    // const nnDbObj = new global.artyouDb.NeuralNetwork(testNetworkObj)

    console.log(`NNT | SAVE DB NN DOC | ${testNetworkDoc.networkId}`)

    console.log({testNetworkDoc})

    delete testNetworkDoc.network;

    await testNetworkDoc.save();

    console.log(`NNT | LOAD DB NN DOC | ${testNetworkDoc.networkId}`)

    const loadedNnDoc = await global.artyouDb.NeuralNetwork.findOne({networkId: testNetworkDoc.networkId}).lean()

    console.log(`NNT | LOADED DB NN DOC | ID: ${loadedNnDoc.networkId} | INPUTS: ${loadedNnDoc.numInputs} | HL: ${loadedNnDoc.hiddenLayerSize}`)

    await loadNetwork({networkObj: loadedNnDoc})

    const reloadedNnObj = await convertNetwork({networkObj: loadedNnDoc})

    console.log(`NNT | RELOADED DB NN DOC | ID: ${reloadedNnObj.networkId} | INPUTS: ${reloadedNnObj.numInputs} | HL: ${reloadedNnObj.hiddenLayerSize}`)

    const dataTestObj = {};
    dataTestObj.datum = {};
    dataTestObj.datum.input = Array.from({length: reloadedNnObj.numInputs}, () => Math.random());
    dataTestObj.inputHits = Math.floor(reloadedNnObj.numInputs * Math.random());
    dataTestObj.inputMisses = reloadedNnObj.numInputs - dataTestObj.inputHits;
    dataTestObj.inputHitRate = dataTestObj.inputHits/reloadedNnObj.numInputs;

    const predictResults = await activateNetwork({
      networkId: reloadedNnObj.networkId,
      dataObj: dataTestObj
    })

    console.log({predictResults})

    // const s3PutObjectResults = await s3PutObject({
    //   Bucket: "art-you-networks",
    //   Key: `threecee/${testNetworkObj.networkId}.json`,
    //   Body: networkJson
    // })

    // console.log({s3PutObjectResults})

    return {
      networkId: reloadedNnObj.networkId,
      epochs: results.stats.params.epochs
    };
  }
  catch(err){
    currentFitTensorflowNetwork = null;
    console.log(chalkError(`${MODULE_ID_PREFIX} | *** TENSORFLOW FIT ERROR: ${err}`));
    throw err;
  }
};


module.exports = NeuralNetworkTools;
