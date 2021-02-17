const MODULE_ID_PREFIX = "NNT";
const configuration = {};
configuration.verbose = false;

const statsObj = {};

const debug = require("debug")(MODULE_ID_PREFIX);

const deepcopy = require("deepcopy");
// const path = require("path");
const async = require("async");
const util = require("util");
const _ = require("lodash");
const EventEmitter = require("events");
const HashMap = require("hashmap").HashMap;
const defaults = require("object.defaults");
// const pick = require("object.pick");
const table = require("text-table");
const empty = require("is-empty");
const networksHashMap = new HashMap();
// const inputsHashMap = new HashMap();

const ThreeceeUtilities = require("@threeceelabs/threecee-utilities");
const tcUtils = new ThreeceeUtilities("NNT_TCU");

// const jsonPrint = tcUtils.jsonPrint;
const indexOfMax = tcUtils.indexOfMax;
const formatBoolean = tcUtils.formatBoolean;
const formatCategory = tcUtils.formatCategory;

const chalk = require("chalk");
// const chalkWarn = chalk.yellow;
const chalkAlert = chalk.red;
const chalkError = chalk.bold.red;
const chalkLog = chalk.gray;

const tensorflow = require("@tensorflow/tfjs-node"); // eslint-disable-line global-require

const networkDefaults = {};

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

NeuralNetworkTools.prototype.loadInputs = async function(params){
  await tcUtils.loadInputs({inputsObj: params.inputsObj});
  return;
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

NeuralNetworkTools.prototype.deleteAllNetworks = async function(){

  try{

    console.log(chalkError(MODULE_ID_PREFIX + " | XXX DEL ALL NETWORKS"));

    networksHashMap.clear();

    statsObj.networks = {};
    statsObj.bestNetwork = {};
    statsObj.currentBestNetwork = {};

    return;

  }
  catch(err){
    console.log(chalkError(MODULE_ID_PREFIX + " | *** DEL ALL NN ERROR"
      + " | " + err
    ));
    throw err;
  }
};

NeuralNetworkTools.prototype.deleteNetwork = async function(){};

const deleteNetwork = NeuralNetworkTools.prototype.deleteNetwork;

let previousPrintedNetworkObj = {};

function outputNetworkInputText(params){
  if (params.truncated){
    console.log(chalkLog(
      params.hits + "/" + params.inputArraySize + " | HIT RATE: " + params.hitRate.toFixed(2) + "% | " + params.title
    ));
    return;
  }
  console.log(chalkLog(
    "______________________________________________________________________________________________________________________________________"
    + "\n" + params.hits + "/" + params.inputArraySize + " | HIT RATE: " + params.hitRate.toFixed(2) + "%"
    + "\n" + params.title
    + "\n" + params.text
  ));
}

NeuralNetworkTools.prototype.printNetworkInput = function(params){

  return new Promise(function(resolve, reject){

    if (!params.datum.input || params.datum.input === undefined){
      console.log(chalkError(MODULE_ID_PREFIX + " | *** printNetworkInput ERROR | datum.input UNDEFINED"));
      return reject();
    }

    const inputArray = params.datum.input;
    const nameArray = params.datum.name;
    const columns = params.columns || 100;

    let col = 0;
    let hitRowArray = [];

    let inputText = ".";
    let text = "";
    let textRow = "";
    let hits = 0;
    let hitRate = 0;
    const inputArraySize = inputArray.length;

    previousPrintedNetworkObj.truncated = false;

    async.eachOfSeries(inputArray, function(input, index, cb){

      if (input) {
        inputText = "X";
        hits += 1;
        hitRate = 100 * hits / inputArraySize;
        hitRowArray.push(nameArray[index]);
      }
      else {
        inputText = ".";
      }

      textRow += inputText;
      col += 1;

      if ((col === columns) || (index === inputArraySize)){

        text += textRow;
        text += " | " + hitRowArray;
        text += "\n";

        textRow = "";
        col = 0;
        hitRowArray = [];
      }

      cb();

    }, function(err){
      if (err) {
        console.log(chalkError(MODULE_ID_PREFIX + " | *** printNetworkInput ERROR: " + err));
        return reject(err);
      }

      previousPrintedNetworkObj = {
        title: params.title,
        inputsId: params.datum.inputsId,
        text: text,
        hits: hits,
        inputArraySize: inputArraySize,
        hitRate: hitRate,
        truncated: false
      };

      outputNetworkInputText(previousPrintedNetworkObj);
      resolve();
    });

  });
};

let titleDefault;

NeuralNetworkTools.prototype.printNetworkResults = function(p){

  const statsTextArray = [];

  return new Promise(function(resolve, reject){

    const params = p || {};

    // statsObj.currentBestNetwork = defaults(statsObj.currentBestNetwork, networkDefaults);
    defaults(statsObj.currentBestNetwork, networkDefaults);

    titleDefault = "T: " + statsObj.currentBestNetwork.networkTechnology.charAt(0).toUpperCase()
      + " | B: " + formatBoolean(statsObj.currentBestNetwork.binaryMode)
      // + " | LSM: " + formatBoolean(statsObj.currentBestNetwork.logScaleMode)
      + " | PF ONLY: " + formatBoolean(statsObj.currentBestNetwork.meta.userProfileOnlyFlag)
      + " - CFG: " + formatBoolean(configuration.userProfileOnlyFlag)
      + " | RK: " + statsObj.currentBestNetwork.rank
      + " PRK: " + statsObj.currentBestNetwork.previousRank
      + " | " + statsObj.currentBestNetwork.networkId
      + " | " + statsObj.currentBestNetwork.inputsId
      + " | " + statsObj.currentBestNetwork.meta.match + "/" + statsObj.currentBestNetwork.meta.total
      + " | MR: " + statsObj.currentBestNetwork.matchRate.toFixed(2) + "%"
      + " | RMR: " + statsObj.currentBestNetwork.runtimeMatchRate.toFixed(2) + "%"
      // + " | OUT: " + statsObj.currentBestNetwork.meta.output
      + " | CM: " + formatCategory(statsObj.currentBestNetwork.meta.category)
      + " A: " + formatCategory(statsObj.currentBestNetwork.meta.categoryAuto)
      + " | MTCH: " + formatBoolean(statsObj.currentBestNetwork.meta.matchFlag);

    if (!params.title) { params.title = titleDefault; }

    const sortedNetworksArray = _.sortBy(networksHashMap.values(), ["matchRate"]);
    _.reverse(sortedNetworksArray);

    async.eachOfSeries(sortedNetworksArray, function(nn, index, cb0){

      // const nn = defaults(n, networkDefaults);
      defaults(nn, networkDefaults);

      // nn.meta = defaults(n.meta, networkDefaults.meta);
      defaults(nn.meta, networkDefaults.meta);

      statsTextArray[index] = [];
      statsTextArray[index] = [
        MODULE_ID_PREFIX + " | ",
        nn.rank,
        nn.previousRank,
        nn.networkTechnology,
        nn.networkId,
        nn.inputsId,
        nn.numInputs,
        nn.runtimeMatchRate.toFixed(2),
        nn.overallMatchRate.toFixed(2),
        nn.successRate.toFixed(2),
        nn.testCycles,
        nn.testCycleHistory.length,
        nn.meta.matchFlag,
        formatBoolean(nn.binaryMode),
        // formatBoolean(nn.logScaleMode),
        formatBoolean(nn.meta.userProfileOnlyFlag),
        nn.meta.output,
        nn.meta.total,
        nn.meta.match,
        nn.meta.mismatch,
        nn.matchRate.toFixed(2),
      ];

      cb0();

    }, function(err){

      if (err) {
        console.log(chalkError("TNN | *** printNetworkResults ERROR: " + err));
        return reject(err);
      }

      statsTextArray.unshift([
        MODULE_ID_PREFIX + " | ",
        "RANK",
        "PREV RANK",
        "TECH",
        "NNID",
        "INPUTSID",
        "INPUTS",
        "RMR",
        "OAMR",
        "SR",
        "TCs",
        "TCH",
        "MFLAG",
        "BIN",
        // "LSM",
        "UPOF",
        "OUTPUT",
        "TOT",
        " M",
        " MM",
        " MR"
      ]);

      console.log(chalk.blue(
          "\nNNT | -------------------------------------------------------------------------------------------------------------------------------------------------"
        + "\nNNT | " + params.title 
        + "\nNNT | -------------------------------------------------------------------------------------------------------------------------------------------------\n"
        + table(statsTextArray, { align: ["l", "r", "r", "l", "l", "l", "r", "r", "r", "r", "r", "r", "l", "l", "l", "r", "r", "r", "r", "r"] })
        + "\nNNT | -------------------------------------------------------------------------------------------------------------------------------------------------"
      ));

      resolve(statsTextArray);

    });

  });
};

const printNetworkInput = NeuralNetworkTools.prototype.printNetworkInput;

NeuralNetworkTools.prototype.getNetworkStats = function (){
  return new Promise(function(resolve){
    resolve(statsObj);
  });
};

NeuralNetworkTools.prototype.createNetwork = async function(params){

  try{

    let network;
      
    if (params.networkObj.networkTechnology === "tensorflow") {

      console.log(chalkLog(`${MODULE_ID_PREFIX} | ... CREATING TENSORFLOW NETWORK`));

      network = tensorflow.sequential();
      network.add(tensorflow.layers.dense({inputShape: [params.numInputs], units: params.networkObj.hiddenLayerSize, activation: 'relu'}));
      network.add(tensorflow.layers.dense({units: 3, activation: 'softmax'}));

      return network;

    }

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
      
    if (!configuration.tensorflow.enabled && params.networkObj.networkTechnology === "tensorflow") {
      console.log(chalkError(`${MODULE_ID_PREFIX} | *** convertNetwork ERROR: TENSORFLOW NOT ENABLED | NN ID: ${params.networkObj.networkId}`));
      throw new Error(`${MODULE_ID_PREFIX} | *** convertNetwork ERROR: TENSORFLOW NOT ENABLED | NN ID: ${params.networkObj.networkId}`)
    }

    const nnObj = params.networkObj;

    if (empty(nnObj.network) && empty(nnObj.networkJson)) {
      console.log(chalkError(MODULE_ID_PREFIX + " | *** NO OLD NET or JSON EXIST | TECH: " + nnObj.networkTechnology + " | " + nnObj.networkId));
      throw new Error("NO JSON NN");
    }
    else if (!empty(nnObj.networkJson)) {

      console.log(chalkLog(MODULE_ID_PREFIX + " | JSON EXISTS | TECH: " + nnObj.networkTechnology + " | " + nnObj.networkId));

      if (nnObj.networkTechnology === "tensorflow") {
        nnObj.network = await convertTensorFlow({networkJson: nnObj.networkJson})
      }

      return nnObj;

    }
    else if (!empty(nnObj.network)) {
      console.log(chalkLog(MODULE_ID_PREFIX + " | OLD JSON EXISTS | TECH: " + nnObj.networkTechnology + " | " + nnObj.networkId));

      nnObj.networkJson = {};
      nnObj.networkJson = deepcopy(nnObj.network);
      nnObj.network = {};

      if (nnObj.networkTechnology === "tensorflow") {
        nnObj.network = await convertTensorFlow({networkJson: nnObj.networkJson})
      }

      return nnObj;
    }
    else{
      console.log(chalkError(MODULE_ID_PREFIX + " | *** convertNetwork ERROR: NO VALID NN JSON " + nnObj.networkId));
      throw new Error("NO VALID JSON NN: " + nnObj.networkId);
    }
  }
  catch(err){
    console.log(chalkError(MODULE_ID_PREFIX + " | *** convertNetwork ERROR: " + err));
    throw err
  }

};

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

    if (!configuration.tensorflow.enabled) {
      console.log(chalkError(`${MODULE_ID_PREFIX} | *** fit ERROR: TENSORFLOW NOT ENABLED | NN ID: ${params.network.networkId}`));
      throw new Error(`${MODULE_ID_PREFIX} | *** fit ERROR: TENSORFLOW NOT ENABLED | NN ID: ${params.network.networkId}`)
    }

    const defaultOnEpochEnd = (epoch, logs) => {
      console.log(chalkLog(`${MODULE_ID_PREFIX} | TENSOR FIT | EPOCH: ${epoch} | LOSS: ${logs.loss.toFixed(3)} | ACC: ${logs.acc.toFixed(6)}`))
    }

    params.options.epochs = params.options.epochs || params.options.iterations;

    if (params.verbose){
      console.log(chalkLog(MODULE_ID_PREFIX + " | TENSORFLOW FIT PARAMS"));
      console.log({params})
    }

    const onEpochEnd = params.onEpochEnd || defaultOnEpochEnd;
    // const network = params.network;
    currentFitTensorflowNetwork = params.network;

    const defaultOptions = {};
    defaultOptions.epochs = 1000;
    defaultOptions.batchSize = 20;
    defaultOptions.verbose = 0;
    defaultOptions.callbacks = {};
    defaultOptions.callbacks.onEpochEnd = onEpochEnd;

    // const options = defaults(params.options, defaultOptions);
    const options = params.options
    defaults(options, defaultOptions);

    console.log({options})

    const trainingSetData = [];
    const trainingSetLabels = [];

    for(const dataObj of params.trainingSet){
      // console.log({item})
      trainingSetData.push(dataObj.datum.input)
      trainingSetLabels.push(dataObj.datum.output)
    }

    const results = await currentFitTensorflowNetwork.fit(
      tensorflow.tensor(trainingSetData), 
      tensorflow.tensor(trainingSetLabels),
      options
    );

    // currentFitTensorflowNetwork = null;
    return {network: currentFitTensorflowNetwork, stats: results};

  }
  catch(err){
    currentFitTensorflowNetwork = null;
    console.log(chalkError(MODULE_ID_PREFIX + " | *** TENSORFLOW FIT ERROR: " + err));
    throw err;
  }
};

NeuralNetworkTools.prototype.activateSingleNetwork = async function (params) {

  const userProfileOnlyFlag = (params.userProfileOnlyFlag !== undefined) ? params.userProfileOnlyFlag : configuration.userProfileOnlyFlag;
  const verbose = configuration.verbose || params.verbose;
  const nnId = params.networkId;

  if (!networksHashMap.has(nnId)){
    console.log(chalkError(MODULE_ID_PREFIX + " | NN NOT IN HASHMAP: " + nnId));
    throw new Error("NN NOT IN HASHMAP: " + nnId);
  }

  const nnObj = networksHashMap.get(nnId);

  if (!configuration.tensorflow.enabled && nnObj.networkTechnology === "tensorflow") {
    console.log(chalkError(`${MODULE_ID_PREFIX} | *** activateSingleNetwork ERROR: TENSORFLOW NOT ENABLED | NN ID: ${nnObj.networkId}`));
    throw new Error(`${MODULE_ID_PREFIX} | *** activateSingleNetwork ERROR: TENSORFLOW NOT ENABLED | NN ID: ${nnObj.networkId}`)
  }

  if (!nnObj.network || (nnObj.network === undefined)){
    console.log(chalkError(MODULE_ID_PREFIX + " | *** NN UNDEFINED: " + nnId));
    await deleteNetwork(nnId);
    throw new Error("NN UNDEFINED: " + nnId);
  }

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

  const user = params.dataObj.user;

  if (nnObj.meta === undefined){
    nnObj.meta = {}
  }
  
  nnObj.meta.userProfileOnlyFlag = (nnObj.meta.userProfileOnlyFlag !== undefined) ? nnObj.meta.userProfileOnlyFlag : userProfileOnlyFlag;

  if (verbose) {
    console.log(chalkLog(MODULE_ID_PREFIX + " | CONVERT DATUM"
      + " | @" + user.screenName
      + " | INPUTS ID: " + nnObj.inputsId
      + " | H/M/TOT: " + params.dataObj.datum.inputHits + "/" + params.dataObj.inputMisses + "/" + nnObj.numInputs
      + " | INPUT HIT RATE: " + params.dataObj.inputHitRate.toFixed(3) + "%"
    ));
  }

  let outputRaw = [];

  const allZero = params.dataObj.datum.input.every((value) => value === 0);

  if (allZero) {
    debug(chalkAlert(MODULE_ID_PREFIX + " | !!! ALL ZERO INPUT | activateSingleNetwork"
      + " | NN: " + nnObj.networkId
      + " | @" + params.dataObj.user.screenName
      + " | INPUTS ID: " + params.dataObj.inputsId
      + " | H/M/TOT: " + params.dataObj.inputHits + "/" + params.dataObj.inputMisses + "/" + nnObj.numInputs
      + " | INPUT HIT RATE: " + params.dataObj.inputHitRate.toFixed(3) + "%"
    ));
  }
  
  if (nnObj.networkTechnology === "tensorflow"){
    const prediction = nnObj.network.predict([tensorflow.tensor(params.dataObj.datum.input, [1, params.dataObj.datum.input.length])]).arraySync();
    if (params.verbose) {
      console.log(chalkAlert("TENSORFLOW | " + nnObj.networkId))
    }
    outputRaw = prediction[0];
  }
  else{
    outputRaw = nnObj.network.activate(params.dataObj.datum.input);
  }

  const networkOutput = {};
  networkOutput.nnId = nnId;
  networkOutput.networkId = nnId;
  networkOutput.user = {};
  networkOutput.user.nodeId = user.nodeId;
  networkOutput.user.screenName = user.screenName;
  networkOutput.user.category = (!user.category || user.category === "false" || user.category === undefined) ? "none" : user.category;
  networkOutput.user.categoryAuto = (!user.categoryAuto || user.categoryAuto === "false" || user.categoryAuto === undefined) ? "none" : user.categoryAuto;
  networkOutput.user.categorizeNetwork = user.categorizeNetwork;
  networkOutput.binaryMode = nnObj.binaryMode;
  networkOutput.userProfileOnlyFlag = userProfileOnlyFlag;
  networkOutput.outputRaw = [];
  networkOutput.outputRaw = outputRaw;
  networkOutput.output = [];
  networkOutput.output = [0,0,0];
  networkOutput.categoryAuto = (!user.categoryAuto || user.categoryAuto === "false" || user.categoryAuto === undefined) ? "none" : user.categoryAuto;
  networkOutput.matchFlag = "MISS";
  networkOutput.inputHits = params.dataObj.inputHits;
  networkOutput.inputMisses = params.dataObj.inputMisses;
  networkOutput.inputHitRate = params.dataObj.inputHitRate;

  if (outputRaw.length !== 3) {
    console.log(chalkError(MODULE_ID_PREFIX + " | *** NN OUTPUT SIZE !== 3  | " + nnId + " | outputRaw: " + outputRaw));
    return networkOutput;
  }

  const maxOutputIndex = await indexOfMax(outputRaw);

  switch (maxOutputIndex) {
    case 0:
      networkOutput.categoryAuto = "left";
      networkOutput.output = [1,0,0];
    break;
    case 1:
      networkOutput.categoryAuto = "neutral";
      networkOutput.output = [0,1,0];
    break;
    case 2:
      networkOutput.categoryAuto = "right";
      networkOutput.output = [0,0,1];
    break;
    default:
      networkOutput.categoryAuto = "none";
      networkOutput.output = [0,0,0];
  }

  networkOutput.matchFlag = ((user.category !== "none") && (networkOutput.categoryAuto === user.category)) ? "MATCH" : "MISS";

  if (verbose) {

    const title = nnObj.networkId
        + " | TECH: " + nnObj.networkTechnology 
        + " | BIN: " + nnObj.binaryMode 
        // + " | LOG: " + nnObj.logScaleMode 
        + " | PROF ONLY: " + userProfileOnlyFlag 
        + " | INP: " + nnObj.inputsId 
        + " | H/M: " + networkOutput.inputHits + "/" + networkOutput.inputMisses
        + " | R: " + networkOutput.inputHitRate.toFixed(3) + "%"
        + " | @" + user.screenName 
        + " | C: " + formatCategory(user.category) 
        + " | A: " + formatCategory(networkOutput.categoryAuto)
        + " | MTCH: " + networkOutput.matchFlag;

    await printNetworkInput({
      title: title,
      datum: params.dataObj.datum
    });

    return networkOutput;
  }
  else{
    return networkOutput;
  }
};

const activateSingleNetwork = NeuralNetworkTools.prototype.activateSingleNetwork;

NeuralNetworkTools.prototype.activate = async function (params) {

  if (networksHashMap.size === 0) {
    console.log(chalkError(MODULE_ID_PREFIX + " | *** NO NETWORKS IN HASHMAP"));
    throw new Error(MODULE_ID_PREFIX + " | *** NO NETWORKS IN HASHMAP");
  }

  try{

    const nnIdArray = networksHashMap.keys();

    const activateParamsDefaults = {
      useDatumCacheFlag: configuration.useDatumCacheFlag,
      userProfileOnlyFlag: configuration.userProfileOnlyFlag,
      binaryMode: configuration.binaryMode,
      convertDatumFlag: configuration.convertDatumFlag,
      verbose: configuration.verbose
    };

    const promiseArray = [];

    const activateParams = Object.assign(activateParamsDefaults, params);

    for(const nnId of nnIdArray){

      if (!networksHashMap.has(nnId)){
        throw new Error(MODULE_ID_PREFIX + " | NET NOT IN HASHMAP | NN ID: " + nnId);
      }

      const nnObj = networksHashMap.get(nnId);

      activateParams.networkId = nnId;

      if (activateParams.convertDatumFlag) {

        activateParams.dataObj = false;

        if (!activateParams.dataObj){

          activateParams.dataObj = await tcUtils.convertDatum({
            inputsId: nnObj.inputsId,
            user: activateParams.user, 
            binaryMode: activateParams.binaryMode, 
            userProfileOnlyFlag: activateParams.userProfileOnlyFlag,
            verbose: activateParams.verbose
          });

        }

        if (!activateParams.dataObj || activateParams.dataObj === undefined) {
          console.log(MODULE_ID_PREFIX + " | *** CONVERT DATUM ERROR | NO RESULTS");
          throw new Error("CONVERT DATUM ERROR | NO RESULTS")
        }
      }
      else{
        activateParams.inputsId = nnObj.inputsId;
        activateParams.dataObj = params.dataObj;
      }

      promiseArray.push(activateSingleNetwork(activateParams));

    }

    const resultsArray = await Promise.all(promiseArray); // results is array of networkOutputs

    const networkOutput = resultsArray.reduce((nnOutHashMap, nnOut) => {
      nnOutHashMap[nnOut.networkId] = nnOut;
      return nnOutHashMap;
    }, {});

    return {user: params.user, networkOutput: networkOutput};

  }
  catch(err){
    console.log(chalkError(MODULE_ID_PREFIX + " | activate | *** ACTIVATE NN ERROR"
      + " | " + err
    ));
    throw err;
  }
};

module.exports = NeuralNetworkTools;
