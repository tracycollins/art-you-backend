/* eslint-disable no-undef */
const should = require('should');
const _ = require('lodash')
const faker = require('faker');
const moment = require("moment");
const Client = require("../lib/awsS3Client.js")

let client;

describe("s3", function() {

	before(async function() {
    client = new Client();
	});

	after(async function() {
	});

	describe("buckets", async function() {

		it("list", async function() {
      const results = await client.listBuckets();
      console.log(results.Buckets)
		});
		
	});

	describe("put and get", async function() {

		it("object", async function() {

      const bucketName = "art-you";
      const keyName = "hello_world.txt";
      const body = "Hello World!"

      const objectParams = { Bucket: bucketName, Key: keyName, Body: body };

      const resultsPut = await client.putObject(objectParams);
      console.log(resultsPut)

      delete objectParams.Body;
      const resultsGet = await client.getObject(objectParams);
      const data = resultsGet.Body.toString('utf-8')
      console.log(`GET DATA: ${data}`)
      data.should.equal(body)
		});
		
	});

});
