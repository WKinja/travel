const mongoose = require('mongoose');

const tripSchema = new mongoose.Schema({
  userEmail: { 
    type: String, 
    required: true,
    trim: true,
    lowercase: true
  },
  tripName: { 
    type: String, 
    required: true,
    trim: true
  },
  destination: { 
    type: String, 
    required: true,
    trim: true
  },
  startDate: { 
    type: Date, 
    required: true 
  },
  endDate: { 
    type: Date, 
    required: true 
  },
  people: { 
    type: Number, 
    required: true,
    min: 1
  },
  accommodation: { 
    type: String, 
    required: true,
    enum: ['Hotel', 'Hostel', 'Airbnb', 'Resort', 'Other']
  },
  transport: { 
    type: String, 
    required: true,
    enum: ['Plane', 'Car', 'Train', 'Bus', 'Ship']
  },
  budget: { 
    type: Number, 
    default: 0,
    min: 0
  },
  activities: { 
    type: [String], 
    default: [],
    enum: ['Sightseeing', 'Outdoors', 'Adventure', 'Relaxation', 'Shopping', 'Dining']
  },
  createdAt: { 
    type: Date, 
    default: Date.now 
  }
}, {
  timestamps: true
});

module.exports = mongoose.model('Trip', tripSchema);