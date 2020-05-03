var express = require('express');
var cors = require('cors');
var helmet = require('helmet');
var morgan = require('morgan');
var bodyParser = require('body-parser');
var app = express();
var db = require('./db');
var config = require('./config');
 
var UserController = require('./user/UserController');
var AuthController = require('./auth/AuthController');

// adding Helmet to enhance your API's security
app.use(helmet());

// using bodyParser to parse JSON bodies into JS objects
app.use(bodyParser.json());

// enabling CORS for all requests
app.use(cors());

// adding morgan to log HTTP requests
app.use(morgan('combined'));

app.get('/api', function (req, res) {
  res.status(200).send('API works.');
});

app.use('/api/users', UserController);

app.use('/api/auth', AuthController);

app.listen(process.env.PORT || config.PORT, function() {
    console.log('Express server listening on port ' + (process.env.PORT || config.PORT));
});