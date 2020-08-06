const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const bodyParser = require('body-parser');
const app = express();

const env = process.env.ENV ? process.env.ENV : "dev"

if (env === 'dev') {
  require("./loadConfig")()
}

const db = require('./db');
 
const UserController = require('./user/UserController');
const AuthController = require('./auth/authController');
const VerifyToken = require('./auth/VerifyToken');

// adding Helmet to enhance your API's security
app.use(helmet());
// using bodyParser to parse JSON bodies into JS objects
app.use(bodyParser.json());
// enabling CORS for all requests
app.use(cors());
// adding morgan to log HTTP requests
app.use(morgan('combined'));

// For Testing Purpose
// app.get('/api', function (req, res) {
//   res.status(200).send('API works.');
// });

app.use('/api/users', UserController);
app.use('/api/auth', AuthController);
app.use(VerifyToken)

app.listen(process.env.PORT, function() {
    console.log('Express server listening on port ' + process.env.PORT);
});