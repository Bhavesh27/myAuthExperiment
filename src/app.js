import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import bodyParser from 'body-parser';
import mongoose from 'mongoose';

const env = process.env.ENV ? process.env.ENV : "dev"
if (env === 'dev') {
  require('../loadConfig')();
}

import AuthController from './controllers/auth/authController';
import VerifyToken from './controllers/auth/VerifyToken';

const app = express();

// db Connection
mongoose.connect(process.env.MONGODB_URI, { useNewUrlParser: true, useUnifiedTopology: true, useCreateIndex: true, useFindAndModify: false });

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

app.use('/api/auth', AuthController);
app.use(VerifyToken)

app.listen(process.env.PORT, () => {
    console.log('Express server listening on port ' + process.env.PORT);
});