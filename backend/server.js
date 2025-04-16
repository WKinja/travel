const express = require('express');
const mongoose = require('mongoose');
const dotenv = require('dotenv');
const cors = require('cors');
const bcrypt = require('bcrypt');
const nodemailer = require('nodemailer');
const path = require('path');

const User = require('./models/User');
const Trip = require('./models/Trip');

dotenv.config();
const app = express();
const PORT = process.env.PORT || 5000;

// === Enhanced CORS Configuration ===
app.use(cors({
  origin: ['http://localhost:3000', 'http://127.0.0.1:5500'], // Add your frontend URLs
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true
}));

// === Middleware ===
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

// === MongoDB Connection ===
mongoose.connect(process.env.MONGO_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
  retryWrites: true,
  w: 'majority'
})
.then(() => console.log("✅ MongoDB Connected"))
.catch(err => console.error("❌ MongoDB connection error:", err));

// === Serve Frontend ===
app.use(express.static(path.join(__dirname, '..', 'public')));
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'public', 'login.html'));
});

// === API Routes ===

// USERS CRUD
app.get('/api/users', async (req, res) => {
  try {
    const users = await User.find({}, { password: 0 }); // Exclude password
    if (!users || users.length === 0) {
      console.log("No users found.");
      return res.status(200).json([]); // Send empty array if no users
    }
    res.status(200).json({
      success: true,
      users
    });
  } catch (error) {
    console.error("Error fetching users:", error);
    res.status(500).json({ 
      success: false,
      message: 'Failed to fetch users',
      error: error.message 
    });
  }
});

// SIGNUP
app.post('/api/signup', async (req, res) => {
  const { name, email, password, role = 'user' } = req.body;
  try {
    const existing = await User.findOne({ email });
    if (existing) return res.status(400).json({ 
      success: false,
      message: "Email already exists" 
    });

    const hashedPassword = await bcrypt.hash(password, 10);
    const user = new User({ name, email, password: hashedPassword, role });
    await user.save();

    res.status(201).json({ 
      success: true,
      message: "Signup successful",
      user: { id: user._id, name, email, role }
    });
  } catch (error) {
    console.error("Signup Error:", error);
    res.status(500).json({ 
      success: false,
      message: "Server error during signup",
      error: error.message 
    });
  }
});

// LOGIN
app.post('/api/login', async (req, res) => {
  const { email, password } = req.body;
  try {
    const user = await User.findOne({ email });
    if (!user) return res.status(400).json({ 
      success: false,
      message: "User not found" 
    });

    const passwordMatch = await bcrypt.compare(password, user.password);
    if (!passwordMatch) return res.status(400).json({ 
      success: false,
      message: "Invalid password" 
    });

    res.status(200).json({
      success: true,
      message: "Login successful",
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role
      }
    });
  } catch (error) {
    console.error("Login Error:", error);
    res.status(500).json({ 
      success: false,
      message: "Server error during login",
      error: error.message 
    });
  }
});

// TRIPS ENDPOINTS (UPDATED)
app.post('/api/trips', async (req, res) => {
  try {
    const { 
      email, 
      tripName, 
      destination, 
      fromDate, 
      toDate, 
      people, 
      accommodation, 
      transport, 
      budget, 
      activities 
    } = req.body;

    // Validate required fields
    if (!email || !tripName || !destination) {
      return res.status(400).json({ 
        success: false,
        message: "Missing required fields (email, tripName, destination)" 
      });
    }

    const trip = new Trip({
      userEmail: email,
      tripName,
      destination,
      startDate: fromDate,
      endDate: toDate,
      people: parseInt(people),
      accommodation,
      transport,
      budget: parseFloat(budget) || 0,
      activities: Array.isArray(activities) ? activities : [activities].filter(Boolean),
      createdAt: new Date()
    });

    await trip.save();
    
    res.status(201).json({ 
      success: true,
      message: "Trip saved successfully",
      trip 
    });
    
  } catch (error) {
    console.error("Save Trip Error:", error);
    res.status(500).json({ 
      success: false,
      message: "Failed to save trip",
      error: error.message 
    });
  }
});

app.get('/api/trips/:email', async (req, res) => {
  try {
    const trips = await Trip.find({ userEmail: req.params.email })
      .sort({ createdAt: -1 });
    
    res.status(200).json({ 
      success: true,
      trips 
    });
    
  } catch (error) {
    console.error("Get Trips Error:", error);
    res.status(500).json({ 
      success: false,
      message: "Failed to fetch trips",
      error: error.message 
    });
  }
});

// ADMIN STATS - Fixed date handling
app.get('/api/stats', async (req, res) => {
  try {
    const [users, trips] = await Promise.all([ 
      User.find().lean(), 
      Trip.find().lean() 
    ]);

    // 1. Roles Distribution
    const roles = users.reduce((acc, user) => {
      const role = user.role || 'user';
      acc[role] = (acc[role] || 0) + 1;
      return acc;
    }, {});

    // 2. Monthly Signups with proper date validation
    const monthlySignupsMap = users.reduce((acc, user) => {
      try {
        const createdAt = user.createdAt ? new Date(user.createdAt) : new Date();
        if (isNaN(createdAt.getTime())) {
          console.warn(`Invalid date for user ${user._id}`);
          return acc;
        }
        
        const monthYear = `${createdAt.getFullYear()}-${String(createdAt.getMonth() + 1).padStart(2, '0')}`;
        acc[monthYear] = (acc[monthYear] || 0) + 1;
      } catch (err) {
        console.error(`Error processing user ${user._id}:`, err);
      }
      return acc;
    }, {});

    const monthlySignups = Object.entries(monthlySignupsMap)
      .map(([month, count]) => ({ month, count }))
      .sort((a, b) => a.month.localeCompare(b.month));

    // 3. Daily Activity with date validation
    const dailyActivityMap = users.reduce((acc, user) => {
      try {
        const createdAt = user.createdAt ? new Date(user.createdAt) : new Date();
        if (isNaN(createdAt.getTime())) {
          console.warn(`Invalid date for user ${user._id}`);
          return acc;
        }
        
        const dateStr = createdAt.toISOString().split('T')[0];
        acc[dateStr] = (acc[dateStr] || 0) + 1;
      } catch (err) {
        console.error(`Error processing user ${user._id}:`, err);
      }
      return acc;
    }, {});

    const dailyActivity = Object.entries(dailyActivityMap)
      .map(([day, count]) => ({ day, count }))
      .sort((a, b) => a.day.localeCompare(b.day));

    // 4. Recent Trips (last 5)
    const recentTrips = trips
      .map(trip => {
        try {
          const date = trip.createdAt ? new Date(trip.createdAt) : new Date();
          return {
            ...trip,
            createdAt: isNaN(date.getTime()) ? new Date() : date
          };
        } catch (err) {
          console.error(`Error processing trip ${trip._id}:`, err);
          return {
            ...trip,
            createdAt: new Date()
          };
        }
      })
      .sort((a, b) => b.createdAt - a.createdAt)
      .slice(0, 5)
      .map(trip => ({
        id: trip._id,
        name: trip.tripName,
        destination: trip.destination,
        date: trip.createdAt.toISOString().split('T')[0]
      }));

    res.status(200).json({
      success: true,
      stats: {
        totalUsers: users.length,
        totalTrips: trips.length,
        roles,
        monthlySignups,
        dailyActivity,
        recentTrips
      }
    });

  } catch (error) {
    console.error("Error fetching stats:", error);
    res.status(500).json({ 
      success: false,
      message: 'Failed to load statistics.',
      error: error.message 
    });
  }
});
// Edit User
app.put('/api/users/:id', async (req, res) => {
  const { id } = req.params;
  const { name, email, role } = req.body;

  try {
    const updatedUser = await User.findByIdAndUpdate(id, { name, email, role }, { new: true });
    if (!updatedUser) {
      return res.status(404).json({ success: false, message: "User not found" });
    }
    res.status(200).json({ success: true, user: updatedUser });
  } catch (error) {
    console.error("Error updating user:", error);
    res.status(500).json({ success: false, message: "Error updating user", error: error.message });
  }
});

// Delete User
app.delete('/api/users/:id', async (req, res) => {
  const { id } = req.params;

  try {
    const deletedUser = await User.findByIdAndDelete(id);
    if (!deletedUser) {
      return res.status(404).json({ success: false, message: "User not found" });
    }
    res.status(200).json({ success: true, message: "User deleted successfully" });
  } catch (error) {
    console.error("Error deleting user:", error);
    res.status(500).json({ success: false, message: "Error deleting user", error: error.message });
  }
});

// Edit Trip
app.put('/api/trips/:id', async (req, res) => {
  const { id } = req.params;
  const { tripName, destination, fromDate, toDate, people, accommodation, transport, budget, activities } = req.body;

  try {
    const updatedTrip = await Trip.findByIdAndUpdate(id, { tripName, destination, fromDate, toDate, people, accommodation, transport, budget, activities }, { new: true });
    if (!updatedTrip) {
      return res.status(404).json({ success: false, message: "Trip not found" });
    }
    res.status(200).json({ success: true, trip: updatedTrip });
  } catch (error) {
    console.error("Error updating trip:", error);
    res.status(500).json({ success: false, message: "Error updating trip", error: error.message });
  }
});

// Delete Trip
app.delete('/api/trips/:id', async (req, res) => {
  const { id } = req.params;

  try {
    const deletedTrip = await Trip.findByIdAndDelete(id);
    if (!deletedTrip) {
      return res.status(404).json({ success: false, message: "Trip not found" });
    }
    res.status(200).json({ success: true, message: "Trip deleted successfully" });
  } catch (error) {
    console.error("Error deleting trip:", error);
    res.status(500).json({ success: false, message: "Error deleting trip", error: error.message });
  }
});


// === Start Server ===
app.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
}); 
