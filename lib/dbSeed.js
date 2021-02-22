/* eslint-disable no-undef */
const fs = require("fs-extra");
const jsonfile = require('jsonfile')
const _ = require('lodash')
const path = require('path')
const walker = require('walker');
const faker = require('faker');

const S3Client = require("../lib/awsS3Client.js")
const awsS3Client = new S3Client();

global.artyouDb = require("@threeceelabs/mongoose-artyou");
global.dbConnection = false;

// (async () => {
//   global.dbConnection = await global.artyouDb.connect()
// })();

const DEFAULT_ARTISTS_FOLDER = "/Users/tc/Dropbox/Apps/art-you/artwork/artists"
// const artistsRootFolder = DEFAULT_ARTISTS_FOLDER;

const modelsArray = [
	"Artwork",
	"Artist",
	"User",
	"Tag",
	"Rating",
	"Recommendation"
]

const dbStats = async () => {
	const stats = {};

	for (const Model of modelsArray){
		stats[Model] = {}
		stats[Model].total = await global.artyouDb[Model].countDocuments();
	}
	return stats
}

const getRandomDoc = async (params) => {
	const docs = await global.artyouDb[params.model].find({}).select('id').lean();
	const randomDoc = await global.artyouDb[params.model].findOne({id: _.sample(docs).id})
	return randomDoc
}

const fakeImage = async () => {
	const image = new global.artyouDb.Image({
		title: faker.lorem.sentence(),
		description: faker.lorem.sentences(),
		url: faker.random.image(),
	})
	const newImage = await image.save();
	return newImage;
}

const fakeDoc = async (params) => {

	const model = params.model;
	let modelObj;
	let dbDoc;
	
	try{

		switch (model) {

			case 'Artist':

				modelObj = {
					id: "artist_" + Date.now(),
					userName: faker.internet.userName(), 
					url: faker.internet.url(), 
					firstName: faker.name.firstName(), 
					middleName: faker.name.middleName(), 
					lastName: faker.name.lastName(), 
					bio: faker.lorem.sentences(),
					location: faker.address.city(),
					birthDate: faker.date.past(),
					deathDate: faker.date.recent(),
				}
				modelObj.image = await fakeImage()
				break;
		
			case 'User':
				modelObj = {
					id: "user_" + Date.now(),
					userName: faker.internet.userName(), 
					url: faker.internet.url(), 
					firstName: faker.name.firstName(), 
					middleName: faker.name.middleName(), 
					lastName: faker.name.lastName(),
					bio: faker.lorem.sentences(),
					location: faker.address.city(),
					birthDate: faker.date.past(),
				}
				modelObj.image = await fakeImage()
				break;
		
			case 'Artwork':
				modelObj = {
					id: "artwork_" + Date.now(),
					title: faker.random.words(), 
					description: faker.lorem.paragraph(), 
					medium: faker.music.genre(), 
				}
				modelObj.artist = await getRandomDoc({model: 'Artist'})
				modelObj.image = await fakeImage()

				break;
		
			case 'Rating':

				modelObj = {
					id: "rating_" + Date.now(),
					rate: Math.random(),
				}

				modelObj.user = await getRandomDoc({model: 'User'})
				modelObj.artwork = await getRandomDoc({model: 'Artwork'})
				break;
		
			case 'Recommendation':

				modelObj = {
					id: "recommendation_" + Date.now(),
					score: Math.random(),
				}

				modelObj.user = await getRandomDoc({model: 'User'})
				modelObj.artwork = await getRandomDoc({model: 'Artwork'})
				break;
		
			case 'Tag':
				modelObj = {
					id: faker.random.word().toLowerCase()
				}
				break;
		
			default:
				break;
		}

		dbDoc = await global.artyouDb[model].findOne({id: modelObj.id}).lean();

		const results = {};

		if (dbDoc){
			console.log(`-*- DB | ${params.index} | HIT | ${model}: ${dbDoc.id}`);
			results.hit = true;
		}
		else{
			dbDoc = new global.artyouDb[model](modelObj);
			await dbDoc.save();
			console.log(`+++ DB | ${params.index} | NEW | ${model}: ${dbDoc.id}`);
			// console.log({dbDoc});
			results.new = true;
		}

		return results;

	}
	catch(err){
		console.error(`*** DB | ${params.index} | ${model} ERROR: ${err}`);
		throw err;
	}
}

const createDocs = async (params) => {

	try{

		const results = {}
		results[params.model] = {}
		results[params.model].hits = 0
		results[params.model].new = 0
		results[params.model].total = 0
		
		console.log(`DB SEED | createDocs | START | MODEL: ${params.model}  | FAKE: ${params.fake} | NUM: ${params.number}`);

		for(let index = 0; index < params.number; index++ ) {
			params.index = index;
			const modelResults = await fakeDoc(params)
			results[params.model].hits = modelResults.hit ? results[params.model].hits + 1 : results[params.model].hits;
			results[params.model].new = modelResults.new ? results[params.model].new + 1 : results[params.model].new;
			results[params.model].total = results[params.model].hits + results[params.model].new
		}

		return results
	}
	catch(err){
		console.error("*** DB SEED | seedDb | ERROR: " + err);
		throw(err)
	}
}

const artistRegex = /artwork\/artists\/(.+?)\//;
const artistNameReplaceRegex = /\W/g;

const generateArtistId = (artistObj) => {

	if (artistObj.instagram_username !== undefined && artistObj.instagram_username.startsWith("@")) { 
		return artistObj.instagram_username.toLowerCase()
	}
	
	if (artistObj.twitter_username !== undefined && artistObj.twitter_username.startsWith("@")) { 
		return artistObj.twitter_username.toLowerCase()
	}
	
	if (artistObj.name !== undefined) { 
		// console.log(artistObj.name)
		return artistObj.name.trim().toLowerCase().replace(artistNameReplaceRegex, "")
	}
	
}


const findOneAndUpdateOptions = {
  new: true,
  upsert: true,
}

const walk = function(params) {

  return new Promise(function (resolve, reject) {

		let results = {}
		
		walker(params.folder)
			// .filterDir(function(dir, stat) {
			// 	if (dir === '/etc/pam.d') {
			// 		console.warn('Skipping /etc/pam.d and children')
			// 		return false
			// 	}
			// 	return true
			// })
			.on('entry', function(entry, stat) {
			})
			.on('dir', function(dir, stat) {
			})
			.on('file', async function(file, stat) {

				const artistMatchArray = artistRegex.exec(file)
				const artist = (artistMatchArray && artistMatchArray[1]) ? artistMatchArray[1] : false;

				if (artist && path.parse(file).base === `${artist}.json`){

					const artistInfoObj = await jsonfile.readFile(file)

					console.log(`DB SEED | ARTIST INFO JSON: ${path.parse(file).base}`)

					const artistId = generateArtistId(artistInfoObj)

					const artistObj = {
						id: artistId,
						oauthID: artistInfoObj.oauthID,
						displayName: artistInfoObj.name,
						instagramUsername: artistInfoObj.instagram_username,
						twitterUsername: artistInfoObj.twitter_username,
						facebookUrl: artistInfoObj.facebook_url,
						artistUrl: artistInfoObj.artist_url,
						wikipediaUrl: artistInfoObj.wikipedia_url,
						bio: artistInfoObj.bio,
						location: faker.address.city(),
						birthDate: artistInfoObj.birthdate,
						deathDate: artistInfoObj.deathdate
					}
					// console.log({artistObj})

					const artistDoc = await global.artyouDb.Artist.findOneAndUpdate({id: artistId}, artistObj, findOneAndUpdateOptions)

					const artistImageFile = path.join("/", path.parse(file).dir, "artist_image.jpg")
					const fileContent = fs.readFileSync(artistImageFile);

					const bucketName = "art-you-artists";
					const keyName = `${artist}/artist_image.jpg`;
					const body = fileContent;

					const objectParams = { Bucket: bucketName, Key: keyName, Body: body };

					await awsS3Client.putObject(objectParams);

					const artistImageUrl = `https://art-you-artists.s3.amazonaws.com/${artist}/artist_image.jpg`

					const image = new global.artyouDb.Image({
						title: artistInfoObj.name,
						url: artistImageUrl
					})

					artistDoc.image = await image.save();
					await artistDoc.save();

					delete objectParams.Body;
					// const data = await awsS3Client.getObject(objectParams);

					console.log(`DB SEED | +++ ARTIST | ${artistDoc.displayName} | IMAGE: ${artistImageUrl}`)
				}
				
			})
			.on('error', function(err, entry, stat) {
				console.log(`DB SEED | *** ERROR *** | ENTRY: ${entry} | ERROR: ${err}`)
			})
			.on('end', function() {
				console.log(`DB SEED | FOLDER WALK COMPLETE | ${params.folder}`)
				resolve(results);
			})
	})

}

const loadArtists = async (params) => {

	try{

		console.log(`DB SEED | loadArtists | START | FOLDER: ${params.folder} | NUM: ${params.maxArtworks}`);

		const maxArtworks = params.maxArtworks || Infinity;

		const results = await walk({folder: params.folder})

		return results
	}
	catch(err){
		console.error("*** DB SEED | seedDb | ERROR: " + err);
		throw(err)
	}
}


const seedDb = async (params) => {

	try{

		console.log(`DB SEED | seedDb | START | FAKE: ${params.fake}`);

		let results = {};

		if (params.fake){
			results.Tag = await createDocs({ model: 'Tag', number: 47, fake: params.fake})
			results.User = await createDocs({ model: 'User', number: 67, fake: params.fake})
			results.Artist = await createDocs({ model: 'Artist', number: 37, fake: params.fake})
			results.Artwork = await createDocs({ model: 'Artwork', number: 57, fake: params.fake})
			results.Rating = await createDocs({ model: 'Rating', number: 77, fake: params.fake})
			results.Recommendation = await createDocs({ model: 'Recommendation', number: 87, fake: params.fake})

			// console.log(results)
		}
		else{
			results = await loadArtists({
				folder: DEFAULT_ARTISTS_FOLDER
			})
		}

		const stats = await dbStats();
		return stats

	}
	catch(err){
		console.error("*** DB SEED | seedDb | ERROR: " + err);
		throw(err)
	}
}

const main = async () => {

	try{


		global.dbConnection = await global.artyouDb.connect()

		const stats = await global.dbConnection.db.stats();
		console.log("DB SEED | MONGO DB STATS\n", stats);

		return await seedDb({ fake: false })

	}
	catch(err){
		console.error("*** DB SEED | ERROR: " + err);
		throw(err)
	}
}

main()
.then((results) => {
	console.log(`DB | SEED | END`)
	console.log({results})
	console.log(`DB | SEED | WAIT FOR ASYNC OPS TO COMPLETE ...`)
	setTimeout(() => {
		if (global.dbConnection !== undefined) { global.dbConnection.close(); }
	}, 20000);
})
.catch((err) => {
	if (global.dbConnection !== undefined) { global.dbConnection.close(); }
	console.error(err)
})
