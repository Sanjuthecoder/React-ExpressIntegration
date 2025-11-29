const express = require("express");
var cors = require('cors');
const bcrypt = require('bcrypt'); // MANDATORY for password hashing
const mysql = require('mysql');
// --- New: MongoDB/Mongoose Imports ---
const mongoose = require('mongoose'); 

const app = express();
app.use(cors({
            origin: '*' // Replace with your frontend's actual origin
        }));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ===================================
//  --- 🌐 MongoDB/Mongoose Setup ---
// ===================================
// NOTE: Using PORT 8000 for the main server as defined later.
const MONGODB_URI = 'mongodb://localhost:27017/UserAuth'; 

mongoose.connect(MONGODB_URI)
  .then(() => console.log('✅ MongoDB connected successfully to UserAuth database'))
  .catch(err => console.error('❌ MongoDB connection error:', err));


// --- Mongoose User Schema and Model ---
const userSchema = new mongoose.Schema({
    name: { type: String, required: true },
    email: { type: String, required: true, unique: true },
    password: { type: String, required: true }
}, { timestamps: true });

// Mongoose Pre-Save Hook: Automatically hash the password before saving
userSchema.pre('save', async function(next) {
    // Only hash the password if it is new or has been modified
    // This is vital for security during registration!
    if (this.isModified('password')) {
        const salt = await bcrypt.genSalt(10);
        this.password = await bcrypt.hash(this.password, salt);
    }
    next();
});

const User = mongoose.model('User', userSchema);


// ===================================
//  --- 💾 MySQL Connection Setup ---
// ===================================

const connection = mysql.createConnection({
  host: "localhost",      
  user: "root",           
  password: "Acts@Batch#2025", 
  database: "Movie" 
});

connection.connect(err => {
  if (err) {
    console.error('❌ MySQL connection failed: ' + err.stack);
    return;
  }
  console.log('✅ Connected to MySQL database as id ' + connection.threadId);
});

// ===================================
//  --- 🛣️ Routes ---
// ===================================

// Route to handle movie details submission (MySQL)
app.post("/path", (req, res) => {
    let data = req.body;
    // Assuming 'id' is auto-increment in MySQL, not passing it here.
    const sql = "INSERT INTO MovieDetails (movieName, actor, releaseDate,movieType,state) VALUES (?, ?, ?, ?, ?)";
    const values = [data.name, data.actor, data.date, data.type, data.state]; 

    connection.query(sql, values, (err, result) => {
        if (err) {
            console.error("MySQL INSERT Error:", err);
            res.status(500).send({ type: "error", msg: "Failed to save to database" });
            return;
        }
        console.log("1 record inserted, ID:", result.insertId);
        res.send({ type: "success", msg: "Successfully saved to database" });
    });
});

// Route to send back all data from the database (MySQL)
app.get("/details", (req, res) => {
    console.log("getting details from DB");
    const sql = "SELECT * FROM MovieDetails";
    
    connection.query(sql, (err, rows) => {
        if (err) {
            console.error("MySQL SELECT Error:", err);
            res.status(500).send({ type: "error", msg: "Failed to retrieve data" });
            return;
        }
        res.send(rows);
    });
});


// ---------------------------------------------------------------------
// --- 1. ROUTE: User Registration (MongoDB)
// ---------------------------------------------------------------------

app.post('/register', async (req, res) => {
    console.log("Handling registration request...");
    const { name, email, password } = req.body;

    if (!name || !email || !password) {
        return res.status(400).send({ type: "error", message: "Name, email, and password are required." });
    }

    try {
        let existingUser = await User.findOne({ email });

        if (existingUser) {
            console.log(`Registration failed: User ${email} already exists.`);
            return res.status(409).send({ type: "error", message: "User with this email already exists." });
        }

        const newUser = new User({ name, email, password });
        await newUser.save(); // Password hashing happens here via the pre-save hook

        console.log(`New user ${email} registered successfully.`);
        
        const userResponse = { name: newUser.name, email: newUser.email, id: newUser._id };
        return res.status(201).send({ type: "success", message: "Registration successful.", user: userResponse });

    } catch (error) {
        console.error("MongoDB registration error:", error);
        res.status(500).send({ type: "error", message: "Internal server error during registration." });
    }
});

// ---------------------------------------------------------------------
// --- 2. NEW ROUTE: User Login (MongoDB)
// ---------------------------------------------------------------------

app.post('/login', async (req, res) => {
    console.log("Handling login request...");
    const { email, password } = req.body; // Get credentials from the request body

    if (!email || !password) {
        return res.status(400).send({ type: "error", message: "Email and password are required for login." });
    }

    try {
        // 1. Find the user by email
        const user = await User.findOne({ email });

        if (!user) {
            // User not found
            console.log(`Login failed for ${email}: User not found.`);
            return res.status(401).send({ type: "error", message: "Invalid credentials." });
        }
        
        // --- DIAGNOSTIC LOGGING ADDED HERE ---
        console.log(`User found. Stored Hash: ${user.password}`);
        console.log(`Incoming Password (plaintext): ${password}`);

        // 2. Compare the provided password with the stored hashed password
        const isMatch = await bcrypt.compare(password, user.password);
        
        // --- DIAGNOSTIC LOGGING ADDED HERE ---
        console.log(`bcrypt.compare result (isMatch): ${isMatch}`);

        if (!isMatch) {
            // Password mismatch
            return res.status(401).send({ type: "error", message: "Invalid credentials." });
        }

        // 3. Successful login
        console.log(`Login successful for user ${email}.`);
        // Do not send the hashed password back
        const userResponse = { name: user.name, email: user.email, id: user._id };
        return res.send({ type: "success", message: "Login successful.", user: userResponse });

    } catch (error) {
        console.error("MongoDB login error:", error);
        res.status(500).send({ type: "error", message: "Internal server error during login." });
    }
});


// Route to handle movie details update by ID (MySQL)
app.put("/update/:id", (req,res)=>{
    const id = req.params.id;
    const data = req.body;

    const sql = `
        UPDATE MovieDetails 
        SET movieName = ?, actor = ?, releaseDate = ?, movieType = ?, state = ?
        WHERE id = ?`; 

    const values = [
        data.movieName, // Use data keys that match your frontend editedItem structure
        data.actor, 
        data.releaseDate, 
        data.movieType, 
        data.state, 
        id 
    ];

    connection.query(sql, values, (err, result) => {
        if (err) {
            console.error("MySQL UPDATE Error:", err);
            return res.status(500).send({ 
                type: "error", 
                msg: "Failed to update database record." 
            });
        }
        
        if (result.affectedRows === 0) {
            console.log(`Update attempted, but Movie ID ${id} not found.`);
            return res.status(404).send({ 
                type: "error", 
                msg: `Movie ID ${id} not found.` 
            });
        }
        
        console.log(`Movie ID ${id} updated successfully.`);
        res.send({ 
            type: "success", 
            msg: `Successfully updated Movie ID ${id}.`,
            rowsAffected: result.affectedRows
        });
    });
});

// Route to handle deletion of a movie record by ID (MySQL)
app.delete("/delete/:id", (req, res) => {
    const movieId = req.params.id;
    const sql = "DELETE FROM MovieDetails WHERE id = ?"; 

    connection.query(sql, [movieId], (err, result) => {
        if (err) {
            console.error("MySQL DELETE Error:", err);
            return res.status(500).send({ 
                type: "error", 
                msg: "Failed to delete database record." 
            });
        }
        
        if (result.affectedRows === 0) {
            console.log(`Deletion attempted, but Movie ID ${movieId} not found.`);
            return res.status(404).send({ 
                type: "error", 
                msg: `Movie ID ${movieId} not found.` 
            });
        }
        
        console.log(`Movie ID ${movieId} deleted successfully.`);
        res.send({ 
            type: "success", 
            msg: `Successfully deleted Movie ID ${movieId}.`,
            rowsAffected: result.affectedRows
        });
    });
});

app.get("/", (req, res) => {
    res.send("Hello");
});

// Start the server
app.listen(8000, function() {
    console.log("Server is running at 8000");
});