/* eslint-disable no-underscore-dangle */
const PF = `RUC_${process.pid}`;
console.log(`${PF} | userRatingUpdateCounter`);

let dbCheckInterval = false;

process.on("SIGTERM", () => {
  console.log(`${PF} | ${process.pid} received a SIGTERM signal`);
  if (dbCheckInterval) {
    clearInterval(dbCheckInterval);
  }
});

process.on("SIGINT", () => {
  console.log(`${PF} | ${process.pid} has been interrupted`);
  if (dbCheckInterval) {
    clearInterval(dbCheckInterval);
  }
});

const userRatingUpdateCounterHashmap = {};

const updateUserRatingCount = (oauthID) => {
  userRatingUpdateCounterHashmap[oauthID] = userRatingUpdateCounterHashmap[
    oauthID
  ]
    ? (userRatingUpdateCounterHashmap[oauthID] += 1)
    : (userRatingUpdateCounterHashmap[oauthID] = 1);

  return userRatingUpdateCounterHashmap[oauthID];
};

const resetUserRatingCount = (oauthID) => {
  userRatingUpdateCounterHashmap[oauthID] = 0;
  console.log(
    `RESET USER RATING COUNT` +
      ` | USER OAUTHID: ${oauthID}` +
      ` | COUNT: ${userRatingUpdateCounterHashmap[oauthID]}`
  );

  return userRatingUpdateCounterHashmap[oauthID];
};

const getUserRatingCount = (oauthID) => userRatingUpdateCounterHashmap[oauthID];
const getAllUsersRatingCount = () => userRatingUpdateCounterHashmap;

const initWatch = () => {
  console.log(`${PF} | +++ INIT WATCH`);
  global.art47db.Rating.watch({ fullDocument: "updateLookup" }).on(
    "change",
    (data) => {
      // console.log(data);
      updateUserRatingCount(data.fullDocument.user);
      console.log(
        `${PF}` +
          ` | ==> DB RATING CHANGE` +
          ` | OP: ${data.operationType}` +
          ` | ARTW _ID: ${data.fullDocument.artwork}` +
          ` | USER _ID: ${data.fullDocument.user}` +
          ` | USER COUNT: ${getUserRatingCount(data.fullDocument.user)}` +
          ` | RATE: ${data.fullDocument.rate}`
      );
    }
  );
};

function initDbCheckInterval() {
  dbCheckInterval = setInterval(() => {
    if (global.art47db && global.art47db.Rating) {
      console.log(`${PF}` + ` | ==> INIT DB WATCH RATINGS`);
      clearInterval(dbCheckInterval);
      initWatch();
    }
  }, 1000);
}

initDbCheckInterval();

module.exports = {
  updateUserRatingCount,
  resetUserRatingCount,
  getUserRatingCount,
  getAllUsersRatingCount,
};
