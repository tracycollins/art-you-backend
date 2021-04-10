/* eslint-disable no-undef */
const should = require("should");
const _ = require("lodash");
const faker = require("faker");
const moment = require("moment");
// const Client = require("../lib/awsS3Client.js");

// const ImageTools = require("../lib/imageTools.js");

const UserTools = require("../lib/userTools.js");

// const NeuralNetworkTools = require("../lib/nnTools.js");
// let nnt;

// nnt.on("ready", async (appName) => {
//   console.log(`NNT | READY | APP NAME: ${appName}`);
//   await nnt.createInputs();
//   console.log(`NNT | >>> START NETWORK TEST`);
//   //   await nnt.runNetworkTest();
// });

describe("userTools", function () {
  let usr;

  before(function (done) {
    usr = new UserTools("TUSR");

    usr.on("ready", (appName) => {
      try {
        console.log(`USR | READY | APP NAME: ${appName}`);
        done();
      } catch (err) {
        console.error(err);
      }
    });
  });

  after(function (done) {
    console.log(`TESTS COMPLETE`);
    process.exit();
  });

  describe("unratedArtworksByUser", function () {
    it("47 artworks", async function () {
      const response = await usr.getUnratedArtworks({
        model: "Artwork",
        user_id: "60483532b8c09b0015454be7",
        populate: "ratings",
        // limit: 10,
        lean: true,
      });
      console.log({ response });
      response.results.length.should.equal(47);
    });
  });
});

// describe("s3", function () {
//   let client;
//   before(async function () {
//     client = new Client();
//   });

//   after(async function () {});

//   describe("buckets", async function () {
//     it("list", async function () {
//       const results = await client.listBuckets();
//       console.log(results.Buckets);
//     });
//   });

//   describe("put and get", async function () {
//     it("object", async function () {
//       const bucketName = "art-you";
//       const keyName = "hello_world.txt";
//       const body = "Hello World!";

//       const objectParams = { Bucket: bucketName, Key: keyName, Body: body };

//       const resultsPut = await client.putObject(objectParams);
//       console.log(resultsPut);

//       delete objectParams.Body;
//       const data = await client.getObject(objectParams);
//       // const data = resultsGet.Body.toString("utf-8");
//       console.log(`GET DATA: ${data}`);
//       data.should.equal(body);
//     });
//   });
// });

// const imageDetectTypes = ["face", "label", "text"];

// describe("image", function () {
//   before(async function () {
//     imt = new ImageTools("IMT");
//     imt.on("ready", async (appName) => {
//       console.log(`IMT | READY | APP NAME: ${appName}`);
//     });
//     return;
//   });

//   after(async function () {
//     return;
//   });

//   describe("analyzeImage", async function () {
//     it("label detect", async function () {
//       this.timeout(15000);
//       const results = await imt.analyzeImage({
//         artist: "threecee",
//         imageFile: "tracyCollins_noWar.jpg",
//       });
//       console.log({ results });
//       return;
//     });
//     return;
//   });

//   describe("transformImage", async function () {
//     it("transform", async function () {
//       this.timeout(15000);
//       try {
//         const results = await imt.transformImage({
//           imageFilePath:
//             "/Volumes/RAID1/projects/art-you-frontend/public/artwork/images/artists/threecee/maskedThreeCee.jpg",
//           imageOutputFilePath:
//             "/Volumes/RAID1/projects/art-you-frontend/public/artwork/images/artists/threecee/maskedThreeCee-small.jpg",
//         });
//         console.log({ results });
//       } catch (err) {
//         console.error({ err });
//       }

//       return;
//     });
//     return;
//   });

//   return;
// });
