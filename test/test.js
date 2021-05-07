/* eslint-disable no-undef */
const should = require("should");
const _ = require("lodash");
const faker = require("faker");
const moment = require("moment");
// const Client = require("../lib/awsS3Client.js");

// const ImageTools = require("../lib/imageTools.js");

// const UserTools = require("../lib/userTools.js");

const os = require("os");
let hostname = os.hostname();
hostname = hostname.replace(/.tld/g, ""); // amtrak wifi
hostname = hostname.replace(/.local/g, "");
hostname = hostname.replace(/.home/g, "");
hostname = hostname.replace(/.at.net/g, "");
hostname = hostname.replace(/.fios-router.home/g, "");
hostname = hostname.replace(/word0-instance-1/g, "google");
hostname = hostname.replace(/word-1/g, "google");
hostname = hostname.replace(/word/g, "google");

const PF = `WKR_${hostname}_${process.pid}`;

const NeuralNetworkTools = require("../lib/nnTools.js");
let nnt = new NeuralNetworkTools();

nnt.on("ready", async (appName) => {
  console.log(`${PF} | NNT | READY | APP NAME: ${appName}`);
  // await nnt.createInputs();
  // // console.log(`NNT | >>>  NETWORK TEST`);
  // const inputsDoc = await nnt.createInputSet({
  //   image: { width: 64, height: 64, channels: 3 },
  // });
  // console.log({ inputsDoc });
  // const nnDoc = await nnt.createUserNetwork({ epochs: 100, maxCount: 5 });
  // const nnDoc = await nnt.createUserNetwork();
  // process.exit();
});

const dbName = "art47";
const mongoConnectionString = `mongodb+srv://${process.env.MONGODB_ATLAS_USERNAME}:${process.env.MONGODB_ATLAS_PASSWORD}@cluster0.kv4my.mongodb.net/${dbName}?retryWrites=true&w=majority`;

const Agenda = require("agenda");
const agenda = new Agenda({ db: { address: mongoConnectionString } });

const oauthIDarray = ["twitter|848591649575927810"];
const randomOauthID = _.sample(oauthIDarray);
const epochs = 247;

agenda.on("ready", async (data) => {
  console.log(`${PF} | AGENDA | READY`);
  let numRemoved = await agenda.cancel({ name: "test" });
  console.log(`${PF} | AGENDA | CANCELLED ${numRemoved} JOBS`);
  numRemoved = await agenda.cancel({ name: "recsUpdate" });
  console.log(`${PF} | AGENDA | CANCELLED ${numRemoved} JOBS`);
  console.log(
    `${PF} | AGENDA | STARTING test JOB: every 10 secs | PID: ${process.pid}`
  );
  await agenda.every("10 seconds", "test", {
    host: hostname,
    pid: process.pid,
    random: Math.random() * 100,
  });

  await agenda.now("recsUpdate", {
    op: "UPDATE_USER_RECS",
    oauthID: randomOauthID,
    networkId: false,
    epochs: epochs,
  });
});

agenda.on("start", (job) => {
  console.log(`${PF} | Job %s starting`, job.attrs.name);
});

agenda.on("complete", (job) => {
  console.log(`${PF} | Job %s finished`, job.attrs.name);
});

(async function () {
  await agenda.start();
})();

process.on("SIGTERM", async () => {
  console.log(`${PF} | TEST | ${process.pid} received a SIGTERM signal`);
  const numRemoved = await agenda.cancel({ name: "test" });
  console.log(`${PF} | AGENDA | CANCELLED ${numRemoved} JOBS`);
  await agenda.stop();
  process.exit(0);
});

process.on("SIGINT", async () => {
  console.log(`${PF} | TEST | ${process.pid} has been interrupted`);
  const numRemoved = await agenda.cancel({ name: "test" });
  console.log(`${PF} | AGENDA | CANCELLED ${numRemoved} JOBS`);
  await agenda.stop();
  process.exit(0);
});

// describe("userTools", function () {
//   let usr;

//   before(function (done) {
//     usr = new UserTools("TUSR");

//     usr.on("ready", (appName) => {
//       try {
//         console.log(`USR | READY | APP NAME: ${appName}`);
//         done();
//       } catch (err) {
//         console.error(err);
//       }
//     });
//   });

//   after(function (done) {
//     console.log(`TESTS COMPLETE`);
//     process.exit();
//   });

//   describe("unratedArtworksByUser", function () {
//     it("47 artworks", async function () {
//       const response = await usr.getUnratedArtworks({
//         model: "Artwork",
//         user_id: "60483532b8c09b0015454be7",
//         populate: "ratings",
//         // limit: 10,
//         lean: true,
//       });
//       console.log({ response });
//       response.results.length.should.equal(47);
//     });
//   });
// });

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
//       const bucketName = "art47";
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
//             "/Volumes/RAID1/projects/art47-frontend/public/artwork/images/artists/threecee/maskedThreeCee.jpg",
//           imageOutputFilePath:
//             "/Volumes/RAID1/projects/art47-frontend/public/artwork/images/artists/threecee/maskedThreeCee-small.jpg",
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
