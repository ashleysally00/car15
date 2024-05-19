const express = require("express");
const cors = require("cors");
const mysql = require("mysql2/promise");
const bodyParser = require("body-parser");
const bcrypt = require("bcrypt");
require("dotenv").config(); // Ensure this reads the .env file

const app = express();
const port = process.env.PORT;

const pool = mysql.createPool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME, // This reads the database name from the .env file
});

app.use(cors());
app.use(bodyParser.json());

// Middleware to handle database connection
app.use(async (req, res, next) => {
  try {
    req.db = await pool.getConnection();
    req.db.connection.config.namedPlaceholders = true;
    await req.db.query('SET SESSION sql_mode = "TRADITIONAL"');
    await req.db.query(`SET time_zone = '-8:00'`);
    await next();
    req.db.release();
  } catch (err) {
    console.log("Database connection error:", err);
    if (req.db) req.db.release();
    res
      .status(500)
      .json({ error: "Database connection error", details: err.message });
  }
});

// Root route
app.get("/", (req, res) => {
  res.send("Welcome to the Car API db");
});

// User registration
app.post("/register", async (req, res) => {
  try {
    const { password, username, userIsAdmin } = req.body;
    const isAdmin = userIsAdmin ? 1 : 0;
    const hashedPassword = await bcrypt.hash(password, 10);

    const [user] = await req.db.query(
      `INSERT INTO user (user_name, password, admin_flag)
      VALUES (:username, :hashedPassword, :userIsAdmin);`,
      { username, hashedPassword, userIsAdmin: isAdmin }
    );

    res.json({ success: true });
  } catch (err) {
    console.log("Error in /register:", err);
    res
      .status(500)
      .json({ error: "Registration failed", details: err.message });
  }
});

// User login
app.post("/log-in", async (req, res) => {
  try {
    const { username, password: userEnteredPassword } = req.body;

    const [[user]] = await req.db.query(
      `SELECT * FROM user WHERE user_name = :username`,
      { username }
    );

    if (!user) return res.status(404).json({ error: "Username not found" });

    const passwordMatches = await bcrypt.compare(
      userEnteredPassword,
      user.password
    );

    if (passwordMatches) {
      res.json({ success: true });
    } else {
      res.status(401).json({ error: "Password is wrong" });
    }
  } catch (err) {
    console.log("Error in /log-in:", err);
    res.status(500).json({ error: "Log-in failed", details: err.message });
  }
});

// Fetch all cars where deleted_flag is 0
app.get("/car", async (req, res) => {
  try {
    const [cars] = await req.db.query(
      `SELECT * FROM cars WHERE deleted_flag = 0;`
    );
    res.json({ cars });
  } catch (err) {
    console.error("Error in /car:", err);
    res
      .status(500)
      .json({ error: "Internal Server Error", details: err.message });
  }
});

// Insert a new car
app.post("/car", async (req, res) => {
  const { make, model, year } = req.body;
  try {
    const [result] = await req.db.query(
      `INSERT INTO cars (make, model, year, date_created, deleted_flag)
      VALUES (:make, :model, :year, NOW(), 0);`,
      { make, model, year }
    );
    res.json({ id: result.insertId, make, model, year, success: true });
  } catch (err) {
    console.error("Error in /car (POST):", err);
    res
      .status(500)
      .json({ error: "Internal Server Error", details: err.message });
  }
});

// Update car details
app.put("/car", async (req, res) => {
  const { id, make, model, year } = req.body;
  try {
    await req.db.query(
      `UPDATE cars SET make = :make, model = :model, year = :year WHERE id = :id;`,
      { id, make, model, year }
    );
    res.json({ id, make, model, year, success: true });
  } catch (err) {
    console.error("Error in /car (PUT):", err);
    res
      .status(500)
      .json({ error: "Internal Server Error", details: err.message });
  }
});

// Mark car as deleted
app.delete("/car/:id", async (req, res) => {
  const { id: carId } = req.params;
  try {
    await req.db.query(`UPDATE cars SET deleted_flag = 1 WHERE id = :carId`, {
      carId,
    });
    res.json({ success: true });
  } catch (err) {
    console.error("Error in /car (DELETE):", err);
    res
      .status(500)
      .json({ error: "Internal Server Error", details: err.message });
  }
});

app.listen(port, () => {
  console.log(`Server started at http://localhost:${port}`);
});
