/* eslint-disable no-undef */
const fs = require("fs-extra");
const jsonfile = require('jsonfile')
const _ = require('lodash')
const path = require('path')
const walker = require('walker');
const faker = require('faker');
const mkdirp = require('mkdirp')

const chalk = require("chalk");
// const chalkWarn = chalk.yellow;
const chalkAlert = chalk.red;
const chalkError = chalk.bold.red;
// const chalkLog = chalk.gray;

const S3Client = require("../lib/awsS3Client.js")
const awsS3Client = new S3Client();

global.artyouDb = require("@threeceelabs/mongoose-artyou");
global.dbConnection = false;

const DEFAULT_ARTISTS_FOLDER = "/Users/tc/Dropbox/Apps/art-you/artwork/artists"
// const artistsRootFolder = DEFAULT_ARTISTS_FOLDER;

const defaultMaxRandomImages = 7;

const modelsArray = [
	"Artwork",
	"Artist",
	"User",
	"Tag",
	"Rating",
	"Recommendation"
]
const configuration = {};
configuration.maxArtworksToSeed = Infinity;

const stats = {};
stats.artists = {};
stats.artists.processed = 0;

stats.artworks = {};
stats.artworks.seeded = 0;
stats.complete = false;

const defaultArtistInfoFileName = "artist_info.json";
const defaultArtistImageFileName = "artist_image.jpg";

const defaultSeedRootDir = process.env.ARTYOU_SEED_ROOT_DIR || "/Users/tc/Dropbox/Apps/art-you"
const defaultSeedDataDir = path.join("/", defaultSeedRootDir, "data")
const defaultImageSeedDir = path.join("/", defaultSeedDataDir, "images")

const defaultFakeSeedRootDir = process.env.ARTYOU_FAKE_SEED_ROOT_DIR || "/Users/tc/Dropbox/Apps/art-you-fake"

// REAL ARTISTS AND ARTWORK
// const defaultArtworkSeedDir = path.join("/", defaultSeedRootDir, "artwork")
// const defaultArtistsSeedDir = path.join("/", defaultArtworkSeedDir, "artists")
// const defaultUsersSeedDir = path.join("/", defaultSeedRootDir, "users")

// FAKE ARTISTS AND ARTWORK
const defaultFakeArtworkSeedDir = path.join("/", defaultFakeSeedRootDir, "artwork")
const defaultFakeArtistsSeedDir = path.join("/", defaultFakeArtworkSeedDir, "artists")
// const defaultFakeUsersSeedDir = path.join("/", defaultFakeSeedRootDir, "users")

// CLOUD DEFAULTS
const defaultArtistsRootUrl = process.env.ARTYOU_ARTISTS_ROOT_URL || "https://art-you-artists.s3.amazonaws.com"
// const defaultUsersRootUrl = process.env.ARTYOU_USERS_ROOT_URL || "https://art-you-users.s3.amazonaws.com"
const defaultArtworksRootUrl = process.env.ARTYOU_ARTWORKS_ROOT_URL || "https://art-you-artworks.s3.amazonaws.com"

const dbStats = async () => {
	const stats = {};

	for (const Model of modelsArray){
		stats[Model] = {}
		stats[Model].total = await global.artyouDb[Model].countDocuments();
	}
	return stats
}

const getRandomFilePath = async (params) => {
	// console.log(`getRandomFilePath | folder: ${params.folder}`)
	const files = fs.readdirSync(params.folder);
	const randomFile = _.sample(files)
	const randomFilePath = path.join("/", params.folder, randomFile)
	// console.log(`getRandomFilePath: ${randomFilePath}`)
	return randomFilePath
}

const getRandomImageFilePath = async (p) => {
	const params = p || {}
	const folder = params.folder || defaultImageSeedDir
	// console.log(`getRandomImageFilePath | folder: ${folder}`)
	const randomFilePath = await getRandomFilePath({folder: folder})
	// console.log(`getRandomImageFilePath: ${randomFilePath}`)
	return randomFilePath;
}

const getRandomDoc = async (params) => {
	const docs = await global.artyouDb[params.model].find({}).select('id').lean();
	const randomDoc = await global.artyouDb[params.model].findOne({id: _.sample(docs).id})
	return randomDoc
}

const fakeImage = async (params) => {

	const seedRootDir = params.seedRootDir || defaultFakeSeedRootDir
	let filePath = ""
	let keyName = ""
	let imageUrl = ""
	let bucketName = ""

	switch (params.imageType){
		case "artist":
			bucketName = "art-you-artists";
			filePath = params.filePath || path.join("/", seedRootDir, params.artist, defaultArtistImageFileName)
			keyName = `${params.artist}/${defaultArtistImageFileName}`
			imageUrl = `${defaultArtistsRootUrl}/${params.artist}/${defaultArtistImageFileName}`
			imageTitle = path.parse(defaultArtistImageFileName).name;
		break;
		case "user":
			bucketName = "art-you-users";
			filePath = params.filePath || path.join("/", seedRootDir, params.user, "images", params.imageFileName)
			keyName = `${params.user}/images/${params.imageFileName}`
			imageUrl = `${defaultArtworksRootUrl}/${params.user}/images/${params.imageFileName}`
			imageTitle = path.parse(params.imageFileName).name;
		break;
		case "artwork":
			bucketName = "art-you-artworks";
			filePath = params.filePath || path.join("/", seedRootDir, params.artist, "images", params.imageFileName)
			keyName = `${params.artist}/images/${params.imageFileName}`
			imageUrl = `${defaultArtworksRootUrl}/${params.artist}/images/${params.imageFileName}`
			imageTitle = path.parse(params.imageFileName).name;
		break;
		default:
			console.log(`DB | SEED | fakeImage | *** UNKNOWN imageType: ${params.imageType}`);
			throw new Error(`DB | SEED | fakeImage | *** UNKNOWN imageType: ${params.imageType}`)
	}

	const s3putImageOptions = {
		bucketName: params.bucketName || bucketName,
		keyName: params.keyName || keyName,
		file: filePath
	}

	// console.log({s3putImageOptions})

	await s3putImage(s3putImageOptions);

	const dbImageObj = {
		title: params.title || imageTitle,
		description: params.description || faker.lorem.sentences(),
		url: params.imageUrl || imageUrl,
	}

	const image = new global.artyouDb.Image(dbImageObj)

	const newImage = await image.save();
	return newImage;
}

const initFakeArtist = async (params) => {

	// console.log("initFakeArtist")
	// console.log({params})
	const artistObj = params.artistObj;
	const artist = artistObj.userName.toLowerCase()

	console.log(`DB | SEED | initFakeArtist | ARTIST: ${artist} ID: ${artistObj.id} | INDEX: ${params.index}`);

	const artistFolderPath = path.join("/", defaultFakeArtistsSeedDir, artistObj.id);
	const artistInfoJsonFilePath = path.join("/", artistFolderPath, defaultArtistInfoFileName);
	const artistImageFilePath = path.join("/", artistFolderPath, defaultArtistImageFileName);

	// console.log({artistFolderPath})
	// console.log({artistInfoJsonFilePath})
	// console.log({artistImageFilePath})

	mkdirp.sync(path.join("/", artistFolderPath, "images"))
	mkdirp.sync(path.join("/", artistFolderPath, "image_analysis"))

	jsonfile.writeFileSync(artistInfoJsonFilePath, artistObj)
	const randomImageFilePath = await getRandomImageFilePath();	

	await fs.copy(randomImageFilePath, artistImageFilePath)

	artistObj.image = await fakeImage({
		imageType: "artist",
		artist: artistObj.userName,
		filePath: randomImageFilePath
	})

	return;

}

const updateDbModel = async (params) => {

	const modelObj = params.modelObj;
	
	try{

		console.log(`DB | SEED | -?- INDEX: ${params.index} | SEARCH | ${modelObj.type} | ID: ${modelObj.id}`);
		let dbDoc = await global.artyouDb[modelObj.type].findOne({id: modelObj.id}).lean();

		const results = {};

		if (dbDoc){
			console.log(`DB | SEED | -*- INDEX: ${params.index} | HIT   | ${modelObj.type} | ID: ${dbDoc.id}`);
			results.hit = true;
		}
		else{
			console.log(`DB | SEED | --- INDEX: ${params.index} | MISS   | ${modelObj.type} | ID: ${modelObj.id}`);
			dbDoc = new global.artyouDb[modelObj.type](modelObj);
			await dbDoc.save();
			console.log(`DB | SEED | +++ INDEX: ${params.index} | NEW    | ${modelObj.type} | ID: ${dbDoc.id}`);
			results.new = true;
		}

		return dbDoc;

	}
	catch(err){
		console.error(`DB | SEED | *** INDEX: ${params.index} | ${modelObj.type} | ERROR: ${err}`);
		throw err;
	}
}

const fakeDoc = async (params) => {

	const model = params.model;
	let modelObj;
	let dbDoc;
	
	try{

		console.log(`DB | SEED | fakeDoc | model: ${model} | INDEX: ${params.index}`);

		switch (model) {

			case 'Artist':

				modelObj = {
					// id: "artist_" + Date.now(),
					type: model,
					userName: faker.internet.userName().toLowerCase(), 
					url: faker.internet.url(), 
					firstName: faker.name.firstName(), 
					middleName: faker.name.middleName().toUpperCase(), 
					lastName: faker.name.lastName(),
					bio: faker.lorem.sentences(),
					location: faker.address.city(),
					birthDate: faker.date.past(),
					deathDate: faker.date.recent(),
				}

				modelObj.name = `${modelObj.firstName} ${modelObj.middleName} ${modelObj.lastName}`
				modelObj.displayName = modelObj.name

				modelObj.id = generateArtistId(modelObj)

				await initFakeArtist({artistObj: modelObj, index: params.index})

				dbDoc = await updateDbModel({modelObj: modelObj, index: params.index})

				await loadArtworks({
					enableRandomImages: true, 
					artistDoc: dbDoc, 
					folder: `${defaultFakeArtistsSeedDir}/${dbDoc.id}/images`
				})

				break;
		
			case 'User':
			
				modelObj = {
					type: model,
					id: "user_" + Date.now(),
					userName: faker.internet.userName().toLowerCase(), 
					url: faker.internet.url(), 
					firstName: faker.name.firstName(), 
					middleName: faker.name.middleName(), 
					lastName: faker.name.lastName(),
					bio: faker.lorem.sentences(),
					location: faker.address.city(),
					birthDate: faker.date.past(),
				}

				modelObj.image = await fakeImage({
					imageType: "user",
					user: faker.internet.userName().toLowerCase(),
					imageFileName: randomImageFileName
				})

				dbDoc = await updateDbModel({modelObj: modelObj, index: params.index})

				break;
		
			case 'Artwork':

				modelObj = {
					type: model,
					id: "artwork_" + Date.now(),
					title: faker.random.words(), 
					description: faker.lorem.paragraph(), 
					medium: faker.music.genre(), 
				}

				modelObj.artist = await getRandomDoc({model: 'Artist'})

				modelObj.image = await fakeImage({
					imageType: "artwork",
					artist: modelObj.artist.userName,
					imageFileName: randomImageFileName
				})

				dbDoc = await updateDbModel({modelObj: modelObj, index: params.index})

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
					type: model,
					id: faker.random.word().toLowerCase()
				}

				dbDoc = await updateDbModel({modelObj: modelObj, index: params.index})

				break;
		
			default:
				console.error(`DB | SEED | *** fakeDoc | INDEX: ${params.index} | ${model} | ERROR: UNKNOWN MODEL TYPE: ${model}`);
				throw new Error(`UNKNOWN MODEL TYPE: ${model}`)
		}

		return dbDoc;

	}
	catch(err){
		console.error(`DB | SEED | *** INDEX: ${params.index} | ${model} | ERROR: ${err}`);
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
		
		console.log(`DB | SEED | createDocs | START | MODEL: ${params.model}  | FAKE: ${params.fake} | NUM: ${params.number}`);

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
		console.error("DB | SEED | *** seedDb | ERROR: " + err);
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
		return artistObj.name.trim().toLowerCase().replace(artistNameReplaceRegex, "")
	}
}

const generateArtworkId = (params) => {
	const title = params.title.replace(artistNameReplaceRegex, "")
	const artworkId = `artist_id_${params.artistDoc.id}_title_${title}`.trim().toLowerCase();
	return artworkId;
}

const s3putImage = async (p) => {

	try {

		const params = p || {}

		const fileContent = fs.readFileSync(params.file);

		const objectParams = { 
			Bucket: params.bucketName, 
			Key: params.keyName, 
			Body: fileContent
		};

		const results = await awsS3Client.putObject(objectParams);

		return results;

	}
	catch(err){
		console.log(chalkError(`DB | SEED | *** s3putImage ERROR: ${err}`))
		throw err;
	}

}

const fileQueue = [];
let fileQueueInterval;
let fileQueueReady = true;

const initfileQueueInterval = async (params) => {

	clearInterval(fileQueueInterval);

	fileQueueInterval = setInterval(async () => {
		
		if (fileQueueReady && stats.complete){
			console.log(chalkAlert(`DB | SEED | XXX MAX ARTWORKS SEEDED: ${stats.artworks.seeded}/${configuration.maxArtworksToSeed} | QUITTING ...`))
			clearInterval(fileQueueInterval);
			fileQueue.length = 0;
		}
		else if (fileQueueReady && fileQueue.length > 0){
			fileQueueReady = false;
			const file = fileQueue.shift();
			await processArtistArtworkFile({file: file})
			fileQueueReady = true;
		}
		
	}, params.interval);

	return;

}

const processArtistArtworkFile = async (params) => {

	try {

		const file = params.file;

		const artistMatchArray = artistRegex.exec(file)
		const artist = (artistMatchArray && artistMatchArray[1]) ? artistMatchArray[1] : false;

		if (artist && path.parse(file).base === defaultArtistInfoFileName){

			const currentArtistFolder = path.parse(file).dir;
			const currentArtistArtworkImagesFolder = path.join("/", currentArtistFolder, "images")
			const artistInfoObj = await jsonfile.readFile(file)

			console.log(`DB | SEED | ARTIST INFO JSON: ${file}`)

			const artistId = generateArtistId(artistInfoObj)

			const artistObj = {
				id: artistId,
				oauthID: artistInfoObj.oauthID,
				displayName: artistInfoObj.name,
				userName: artistInfoObj.name,
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

			let artistDoc = await global.artyouDb.Artist.findOne({id: artistId})

			if (!artistDoc){
				artistDoc = new global.artyouDb.Artist(artistObj)
			}

			const artistImageFile = path.join("/", currentArtistFolder, defaultArtistImageFileName)

			await s3putImage({
				bucketName: "art-you-artists",
				keyName: `${artist}/${defaultArtistImageFileName}`,
				file: artistImageFile
			});

			const artistImageUrl = `${defaultArtistsRootUrl}/${artist}/${defaultArtistImageFileName}`

			const image = new global.artyouDb.Image({
				title: artistInfoObj.name,
				url: artistImageUrl
			})

			artistDoc.image = await image.save();
			await artistDoc.save();

			await loadArtworks({artistDoc: artistDoc, folder: currentArtistArtworkImagesFolder})

			stats.artists.processed += 1
			console.log(`DB | SEED | +++ ARTIST | PROCESSED: ${stats.artists.processed} | ${artistDoc.displayName} | IMAGE: ${artistImageUrl}`)

			return;
		}
	}
	catch(err){
		console.log(`DB processArtistArtworkFile | *** ERROR: ${err}`)
		throw err;
	}

}

const walk = function(params) {

  return new Promise(function (resolve, reject) {

		const results = {}
		stats.walkCompleteFlag = false;
		
		walker(params.folder)
			.on('file', async function(file) {
				if (configuration.maxArtworksToSeed > 0 && stats.artworks.seeded < configuration.maxArtworksToSeed) {
					fileQueue.push(file)
					if (fileQueue.length % 100 === 0 ) console.log(`DB | SEED | FQ: ${fileQueue.length} | ${stats.artworks.seeded}`)
				}
			})
			.on('error', function(err, entry) {
				console.error(`DB | SEED | *** ERROR *** | ENTRY: ${entry} | ERROR: ${err}`)
				return reject(err)
			})
			.on('end', function() {
				console.log(`DB | SEED | FOLDER WALK COMPLETE | ${params.folder}`)
				stats.walkCompleteFlag = true
				resolve(results);
			})
	})

}

const loadArtists = async (p) => {

	try{

		const params = p || {};

		console.log(`DB | SEED | loadArtists | START | FOLDER: ${params.folder}`);

		const results = await walk({folder: params.folder})

		return results
	}
	catch(err){
		console.error("DB | SEED | *** seedDb | ERROR: " + err);
		throw(err)
	}
}

const loadArtworks = async (p) => {

	try{

		const params = p || {};

		const enableRandomImages = params.enableRandomImages || false;
		const maxRandomImages = params.maxRandomImages || defaultMaxRandomImages;
		const randomImageDir = params.randomImageDir || defaultImageSeedDir;

		const bucketName = params.bucketName || "art-you-artworks"

		console.log(`DB | SEED | loadArtworks | RANDOM IMAGES: ${enableRandomImages} / ${maxRandomImages} MAX | ARTIST: ${params.artistDoc.displayName} | IMAGES FOLDER: ${params.folder}`);

		let imageFiles = []

		if (enableRandomImages){
			imageFiles = _.sampleSize(fs.readdirSync(randomImageDir), Math.floor(maxRandomImages * Math.random()))
			console.log(`DB | SEED | loadArtworks | LOADING ${imageFiles.length} *RANDOM* IMAGES | ARTIST: ${params.artistDoc.displayName} | IMAGES FOLDER: ${params.folder}`);
		}
		else{
			imageFiles = fs.readdirSync(params.folder);
			console.log(`DB | SEED | loadArtworks | LOADING ${imageFiles.length} IMAGES | ARTIST: ${params.artistDoc.displayName} | IMAGES FOLDER: ${params.folder}`);
		}


		for (const imageFile of imageFiles){

			if (path.extname(imageFile) === ".jpg" || path.extname(imageFile) === ".jpeg" || path.extname(imageFile) === ".png"){

				const artworkImageFile = path.join("/", params.folder, imageFile)

				if (enableRandomImages) {
					await fs.copy(path.join("/", randomImageDir, imageFile), artworkImageFile)
				}

				const keyName = `${params.artistDoc.userName}/images/${imageFile}`

				await s3putImage({
					bucketName: bucketName,
					keyName: keyName,
					file: artworkImageFile
				});
			
				const artworkImageUrl = `https://${bucketName}.s3.amazonaws.com/${keyName}`
				const imageTitle = path.parse(imageFile).name;

				const image = new global.artyouDb.Image({
					title: imageTitle,
					url: artworkImageUrl
				})

				const artworkId = generateArtworkId({artistDoc: params.artistDoc, title: imageTitle})
				
				console.log({artworkId})
				const artworkObj = {
					artworkId: artworkId,
					title: imageTitle,
					url: artworkImageUrl,
				}

				let artworkDoc = await global.artyouDb.Artwork.findOne({artworkId: artworkId})

				if (!artworkDoc){
					artworkDoc = new global.artyouDb.Artwork(artworkObj)
				}
				
				artworkDoc.artist = params.artistDoc
				artworkDoc.image = await image.save();

				await artworkDoc.save();

				stats.artworks.seeded += 1

				console.log(`DB | SEED | s3putImage | ARTIST: ${params.artistDoc.displayName} | TITLE: ${imageTitle} | IMAGE: ${artworkImageFile}`);
			}
			else{
				console.log(`DB | SEED | s3putImage | SKIP: ${imageFile}`);
			}
		}

		return
	}
	catch(err){
		console.error("DB | SEED | *** seedDb | ERROR: " + err);
		throw(err)
	}
}

const seedDb = async (params) => {

	try{

		console.log(`DB | SEED | seedDb | START | FAKE: ${params.fake}`);

		let results = {};

		if (params.fake){
			// results.Tag = await createDocs({ model: 'Tag', number: 47, fake: params.fake})
			// results.User = await createDocs({ model: 'User', number: 67, fake: params.fake})
			results.Artist = await createDocs({ model: 'Artist', number: 3, fake: params.fake})
			// results.Artwork = await createDocs({ model: 'Artwork', number: 57, fake: params.fake})
			// results.Rating = await createDocs({ model: 'Rating', number: 77, fake: params.fake})
			// results.Recommendation = await createDocs({ model: 'Recommendation', number: 87, fake: params.fake})
		}

		if (params.loadArtists){
			results = await loadArtists({
				folder: DEFAULT_ARTISTS_FOLDER
			})
		}

		const stats = await dbStats();
		return stats

	}
	catch(err){
		console.error("DB | SEED | *** seedDb | ERROR: " + err);
		throw(err)
	}
}

const main = async () => {

	try{


		global.dbConnection = await global.artyouDb.connect()
		await global.artyouDb.createDefaultIndexes()

		const stats = await global.dbConnection.db.stats();
		console.log("DB | SEED | MONGO DB STATS\n", stats);

		initfileQueueInterval({interval: 100})

		await seedDb({ fake: true })
		return;

	}
	catch(err){
		console.error("DB | SEED | *** ERROR: " + err);
		throw(err)
	}
}

main()
.then((results) => {
	
	console.log(chalk.blue(`DB | SEED | END`))
	console.log({results})
	console.log(chalk.blue(`DB | SEED | WAIT FOR ASYNC OPS TO COMPLETE ...`))

	const waitFinishInterval = setInterval(() => {

		if (stats.complete){
			clearInterval(waitFinishInterval)
			if (global.dbConnection !== undefined) { global.dbConnection.close(); }
		}
		stats.complete = true;

	}, 10000);

})
.catch((err) => {
	if (global.dbConnection !== undefined) { global.dbConnection.close(); }
	console.error(err)
})
