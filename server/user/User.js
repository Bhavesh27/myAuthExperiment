var mongoose = require('mongoose');

var UserSchema = new mongoose.Schema({  
  phoneNumber: String,
  otp: String
});
mongoose.model('User', UserSchema);

module.exports = mongoose.model('User');