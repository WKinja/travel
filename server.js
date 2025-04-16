const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const bcrypt = require('bcrypt');
const path = require('path');
const dotenv = require('dotenv');
const User = require('./backend/models/User');
const Trip = require('./backend/models/Trip');

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// === Middleware ===
app.use(cors());
app.use(express.json());

// === Serve static files ===
app.use(express.static(path.join(__dirname, 'public')));

// === MongoDB Connection ===
mongoose.connect(process.env.MONGO_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true
})
.then(() => console.log("✅ MongoDB Connected"))
.catch(err => console.error("❌ MongoDB Error:", err));

// === Default route: serve login page ===
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'login.html'));
});

// === Signup ===
app.post('/api/signup', async (req, res) => {
  const { name, email, password, role = 'user' } = req.body;
  try {
    const existing = await User.findOne({ email });
    if (existing) return res.status(400).json({ message: "Email already exists" });

    const hashed = await bcrypt.hash(password, 10);
    const user = new User({ name, email, password: hashed, role });
    await user.save();
    res.status(201).json({ message: "Signup successful" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
});

// === Login ===
app.post('/api/login', async (req, res) => {
  const { email, password } = req.body;
  try {
    const user = await User.findOne({ email });
    if (!user) return res.status(400).json({ message: "User not found" });

    const match = await bcrypt.compare(password, user.password);
    if (!match) return res.status(400).json({ message: "Invalid password" });

    res.status(200).json({
      message: "Login successful",
      user: {
        name: user.name,
        email: user.email,
        role: user.role
      }
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
});

// === Get all users ===
app.get('/api/users', async (req, res) => {
  try {
    const users = await User.find(); // Fetch all users from the database
    if (!users || users.length === 0) {
      return res.status(200).json([]); // Send an empty array instead of 404
    }
    res.json(users); // Send back the list of users
  } catch (err) {
    console.error("Error fetching users:", err);
    res.status(500).json({ message: "Failed to fetch users. Please try again." });
  }
});

// === Save Trip ===
app.post('/api/trips', async (req, res) => {
  try {
    const {
      tripName,
      destination,
      fromDate,
      toDate,
      activities = [],
      people,
      accommodation,
      transport,
      budget,
      userEmail
    } = req.body;

    if (!destination || !userEmail) {
      return res.status(400).json({ message: "Missing required fields" });
    }

    const newTrip = new Trip({
      tripName: tripName?.trim(),
      destination: destination?.trim(),
      fromDate,
      toDate,
      activities: Array.isArray(activities) ? activities : [],
      people: Number(people),
      accommodation,
      transport,
      budget: Number(budget),
      userEmail
    });

    await newTrip.save();
    res.status(201).json({ message: "Trip saved successfully" });
  } catch (error) {
    console.error("Trip Save Error:", error);
    res.status(500).json({ message: "Failed to save trip" });
  }
});

// === Get trips by user email ===
app.get('/api/trips/:email', async (req, res) => {
  try {
    const trips = await Trip.find({ userEmail: req.params.email });
    res.json(trips);
  } catch (err) {
    res.status(500).json({ message: "Failed to fetch trips" });
  }
});

// === Admin Statistics ===
app.get('/api/stats', async (req, res) => {
  try {
    const users = await User.find();
    const roles = users.reduce((acc, user) => {
      acc[user.role] = (acc[user.role] || 0) + 1;  // Count each role occurrence
      return acc;
    }, {});

    const rolesStats = Object.keys(roles).map(role => ({ role, count: roles[role] }));

    const monthlySignups = users.reduce((acc, user) => {
      const month = new Date(user.createdAt).toISOString().split('T')[0].slice(0, 7);  // Extract month
      acc[month] = (acc[month] || 0) + 1;
      return acc;
    }, {});

    const monthlyStats = Object.keys(monthlySignups).map(month => ({ month, count: monthlySignups[month] }));

    const dailyActivity = users.map(user => {
      return {
        day: new Date(user.createdAt).toISOString().split('T')[0],
        count: 1
      };
    });

    res.json({ roles: rolesStats, monthlySignups: monthlyStats, dailyActivity });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to fetch statistics" });
  }
});

app.listen(PORT, () => {
  console.log(`🚀 Server running at http://localhost:${PORT}`);
});
