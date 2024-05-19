const jwt = require("jsonwebtoken");
require("dotenv").config();

const payload = {
  userId: 1, // replace with actual user ID
  username: "exampleUser",
  userIsAdmin: true,
};

const token = jwt.sign(payload, process.env.JWT_KEY);
console.log(token);
