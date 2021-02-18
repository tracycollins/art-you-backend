const MODULE_ID_PREFIX = "NNT";

const DEFAULT_NETWORK_TECHNOLOGY = 400;
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
const networksHashMap = new HashMap();

const chalk = require("chalk");
const chalkAlert = chalk.red;
const chalkError = chalk.bold.red;
const chalkLog = chalk.gray;

const tensorflow = require("@tensorflow/tfjs-node"); // eslint-disable-line global-require

const NeuralNetworkTools = function(app_name){
  const self = this;
  this.appname = app_name || "DEFAULT_APP_NAME";
  console.log("NN TOOLS | APP NAME: " + this.appname);

  EventEmitter.call(this);

  setTimeout(() => {
    self.emit("ready", self.appname);
  }, 100);
};

util.inherits(NeuralNetworkTools, EventEmitter);

NeuralNetworkTools.prototype.verbose = function(v){
  if (v === undefined) { return configuration.verbose; }
  configuration.verbose = v;
  console.log(chalkAlert(MODULE_ID_PREFIX + " | --> SET VERBOSE: " + configuration.verbose));
  return;
};

NeuralNetworkTools.prototype.loadInputs = async function(){
};

NeuralNetworkTools.prototype.convertTensorFlow = async function(params){

  try{

    if (!configuration.tensorflow.enabled) {
      console.log(chalkError(`${MODULE_ID_PREFIX} | *** convertTensorFlow ERROR: TENSORFLOW NOT ENABLED`));
      throw new Error(`${MODULE_ID_PREFIX} | *** convertTensorFlow ERROR: TENSORFLOW NOT ENABLED`)
    }

    let nnJson = {}
    try{
      // old style
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

NeuralNetworkTools.prototype.loadNetwork = async function(){};

NeuralNetworkTools.prototype.deleteAllNetworks = async function(){};

NeuralNetworkTools.prototype.deleteNetwork = async function(){};

NeuralNetworkTools.prototype.getNetworkStats = function (){};

NeuralNetworkTools.prototype.createNetwork = async function(p){

  try{
      
    const params = p || {};

    console.log(chalkLog(`${MODULE_ID_PREFIX} | ... CREATING TENSORFLOW NETWORK`));

    const networkObj = {}

    networkObj.networkId = params.networkId || `nn_test_${moment().valueOf()}`
    networkObj.networkTechnology = params.networkTechnology || configuration.networkTechnology;
    networkObj.numInputs = params.numInputs || configuration.numInputs;
    networkObj.numOutputs = params.numOutputs || configuration.numOutputs;
    networkObj.hiddenLayerSize = params.hiddenLayerSize || configuration.hiddenLayerSize;
    networkObj.activationInput = params.activationInput || configuration.activationInput;
    networkObj.activationOutput = params.activationOutput || configuration.activationOutput;
    
    networkObj.network = tensorflow.sequential();

    networkObj.network.add(tensorflow.layers.dense({
      inputShape: [networkObj.numInputs], 
      units: networkObj.hiddenLayerSize, 
      activation: networkObj.activationInput
    }));

    networkObj.network.add(tensorflow.layers.dense({
      units: networkObj.numOutputs,
      activation: networkObj.activationOutput
    }));

    return networkObj;

  }
  catch(err){
    console.log(chalkError(MODULE_ID_PREFIX + " | *** createNetwork ERROR: " + err));
    throw err
  }

};

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

  if (!nnObj.networkRawFlag || (nnObj.networkRawFlag === undefined) || 
    ((nnObj.network.activate === undefined) && (nnObj.network.run === undefined) && (nnObj.network.predict === undefined))
  ){

    console.log(chalkAlert(MODULE_ID_PREFIX + " | NN ACTIVATE/RUN/PREDICT UNDEFINED"
      + " | TECH: " + nnObj.networkTechnology 
      + " | ID: " + nnObj.networkId 
      + " | INPUTS: " + nnObj.inputsId 
      + " | NN RAW FLAG: " + nnObj.networkRawFlag 
    ));

    networksHashMap.delete(nnId);

    throw new Error("ACTIVATE_UNDEFINED: " + nnObj.networkId);

  }

  if (nnObj.meta === undefined){
    nnObj.meta = {}
  }
    
  const prediction = nnObj.network.predict([tensorflow.tensor(params.dataObj.datum.input, [1, params.dataObj.datum.input.length])]).arraySync();

  if (params.verbose) {
    console.log(chalkAlert("TENSORFLOW | " + nnObj.networkId))
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

NeuralNetworkTools.prototype.runNetworkTest = async function (p) {

  try{

    const params = p || {};

    const trainingSetSize = 100;
    const trainingSet = [];

    const testNetworkObj = await createNetwork()

    console.log(`NNT | ... COMPILING TEST TENSORFLOW NETWORK`)

    testNetworkObj.network.compile({
      optimizer: 'sgd',
      loss: 'meanSquaredError',
      metrics: ['accuracy']
    });

    for(let i=0; i < trainingSetSize; i++ ){

      const datum = {};
      datum.input = Array.from({length: testNetworkObj.numInputs}, () => Math.random());
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
      networkId: testNetworkObj.networkId,
      options: fitOptions,
      network: testNetworkObj.network,
      trainingSet: trainingSet,
    });

    console.log(`================================================================`)
    console.log(
      `NNT | FIT COMPLETE` +
      ` | NN ID: ${testNetworkObj.networkId}` +
      ` | EPOCHS ${results.stats.params.epochs}`
    )
    console.log(`================================================================`)

    return {
      networkId: testNetworkObj.networkId,
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
