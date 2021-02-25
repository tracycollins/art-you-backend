/* eslint-disable no-undef */
const should = require("should");
const _ = require("lodash");
const faker = require("faker");
const moment = require("moment");
const Client = require("../lib/awsS3Client.js");

const NeuralNetworkTools = require("../lib/nnTools.js");
let nnt;

// nnt.on("ready", async (appName) => {
//   console.log(`NNT | READY | APP NAME: ${appName}`);
// });

// nnt.on("ready", async (appName) => {
//   console.log(`NNT | READY | APP NAME: ${appName}`);
//   await nnt.createInputs();
//   console.log(`NNT | >>> START NETWORK TEST`);
//   //   await nnt.runNetworkTest();
// });

let client;

describe("s3", function () {
  before(async function () {
    client = new Client();
    nnt = new NeuralNetworkTools("NNT");

    nnt.on("ready", async (appName) => {
      console.log(`NNT | READY | APP NAME: ${appName}`);
      await nnt.createInputSet();
      console.log(`NNT | >>> START NETWORK TEST`);
      //   await nnt.runNetworkTest();
    });
  });

  after(async function () {});

  describe("buckets", async function () {
    it("list", async function () {
      const results = await client.listBuckets();
      console.log(results.Buckets);
    });
  });

  describe("put and get", async function () {
    it("object", async function () {
      const bucketName = "art-you";
      const keyName = "hello_world.txt";
      const body = "Hello World!";

      const objectParams = { Bucket: bucketName, Key: keyName, Body: body };

      const resultsPut = await client.putObject(objectParams);
      console.log(resultsPut);

      delete objectParams.Body;
      const data = await client.getObject(objectParams);
      // const data = resultsGet.Body.toString("utf-8");
      console.log(`GET DATA: ${data}`);
      data.should.equal(body);
    });
  });
});
