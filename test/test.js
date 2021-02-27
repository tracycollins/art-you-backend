/* eslint-disable no-undef */
const should = require("should");
const _ = require("lodash");
const faker = require("faker");
const moment = require("moment");
const Client = require("../lib/awsS3Client.js");

const ImageTools = require("../lib/imageTools.js");
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

describe("s3", function () {
  let client;
  before(async function () {
    client = new Client();
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

const imageDetectTypes = ["face", "label", "text"];

describe("image", function () {
  before(async function () {
    imt = new ImageTools("IMT");
    imt.on("ready", async (appName) => {
      console.log(`IMT | READY | APP NAME: ${appName}`);
    });
    return;
  });

  after(async function () {
    return;
  });

  describe("analyzeImage", async function () {
    it("label detect", async function () {
      this.timeout(15000);
      const results = await imt.analyzeImage({
        artist: "threecee",
        imageFile: "tracyCollins_noWar.jpg",
      });
      console.log({ results });
      // const results = await imt.analyzeImage({
      //   artist: "threecee",
      //   imageFile: "tracyCollins_noWar.jpg",
      // });

      // console.log({ results });

      // for (detectType of imageDetectTypes) {
      //   const detectTypeParam = `${detectType}Detection`;
      //   const results = await imt.analyzeImage({
      //     detectType: detectTypeParam,
      //     imageUrl: "/Volumes/RAID1/projects/art-you-backend/test/test.jpg",
      //   });
      //   console.log(results);
      //   const annotationsKey = `${detectType}Annotations`;
      //   results.analysis[annotationsKey].length.should.greaterThan(0);
      //   for (annotation of results.analysis[annotationsKey]) {
      //     console.log({ annotation });
      //   }
      // }
      return;
    });
    return;
  });

  return;
});
