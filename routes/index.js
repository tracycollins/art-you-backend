const express = require("express");
const router = express.Router();
const cors = require("cors");

router.head("/", cors(), (req, res) => {
  console.info("HEAD /");
  res.sendStatus(204);
});
router.get("/", cors(), (req, res) => {
  console.info("GET /");
  res.json({
    text: "Simple CORS requests are working. [GET]",
  });
});
router.post("/", cors(), (req, res) => {
  console.info("POST /");
  res.json({
    text: "Simple CORS requests are working. [POST]",
  });
});

module.exports = router;
