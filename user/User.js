const mongoose = require('mongoose');

const UserSchema = new mongoose.Schema({  
  name: {
    type: String,
    required: false
  },
  phoneNumber: {
    type: String,
    required: true,
    unique: true
  },
  verified: {
    type: Boolean,
    default: false
  },
  email: {
    type: String,
    required: false,
    unique: true
  },
  password: {
    type: String,
    required: false
  },
  otp: {
    type: Map,
    of: Number,
    required: true
  },
  authToken: {
    type: String,
    required: false
  },
  profileComplete: {
    type: Boolean,
    default: false
  },
  role: {
    type: String,
    default: 'user'
  }
});

mongoose.model('User', UserSchema);

module.exports = mongoose.model('User');