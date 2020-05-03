var mongoose = require('mongoose');
var config = require('./config');
mongoose.connect(process.env.MONGODB_URI || config.MONGODB_URI);