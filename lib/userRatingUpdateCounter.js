/* eslint-disable no-underscore-dangle */
const userRatingUpdateCounterHashmap = {};

const updateUserRatingCount = (user_id) => {
  userRatingUpdateCounterHashmap[user_id] = userRatingUpdateCounterHashmap[
    user_id
  ]
    ? (userRatingUpdateCounterHashmap[user_id] += 1)
    : (userRatingUpdateCounterHashmap[user_id] = 1);

  console.log(
    `USER RATING COUNT` +
      ` | USER _ID: ${user_id}` +
      ` | COUNT: ${userRatingUpdateCounterHashmap[user_id]}`
  );

  return userRatingUpdateCounterHashmap[user_id];
};

const resetUserRatingCount = (user_id) => {
  userRatingUpdateCounterHashmap[user_id] = 0;
  console.log(
    `RESET USER RATING COUNT` +
      ` | USER _ID: ${user_id}` +
      ` | COUNT: ${userRatingUpdateCounterHashmap[user_id]}`
  );

  return userRatingUpdateCounterHashmap[user_id];
};

const getUserRatingCount = (user_id) => userRatingUpdateCounterHashmap[user_id];
const getAllUsersRatingCount = () => userRatingUpdateCounterHashmap;

const initWatch = () => {
  global.artyouDb.Rating.watch({ fullDocument: "updateLookup" }).on(
    "change",
    (data) => {
      // console.log(data);
      updateUserRatingCount(data.fullDocument.user);
      console.log(
        `==> DB RATING CHANGE` +
          ` | OP: ${data.operationType}` +
          ` | ARTW _ID: ${data.fullDocument.artwork}` +
          ` | USER _ID: ${data.fullDocument.user}` +
          ` | USER COUNT: ${getUserRatingCount(data.fullDocument.user)}` +
          ` | RATE: ${data.fullDocument.rate}`
      );
    }
  );
};

const dbCheckInterval = setInterval(() => {
  if (global.artyouDb && global.artyouDb.Rating) {
    console.log(`==> INIT DB WATCH RATINGS`);
    clearInterval(dbCheckInterval);
    initWatch();
  }
}, 1000);

module.exports = {
  updateUserRatingCount,
  resetUserRatingCount,
  getUserRatingCount,
  getAllUsersRatingCount,
};