var express = require('express');
var router = express.Router();
var bodyParser = require('body-parser');
var config = require('../config'); // get config file
var twilio = require('twilio');
var client = new twilio((process.env.TWILIO_ACCOUNT_SID || config.TWILIO_ACCOUNT_SID), (process.env.TWILIO_AUTHTOKEN || config.TWILIO_AUTHTOKEN));

var VerifyToken = require('./VerifyToken');

router.use(bodyParser.urlencoded({ extended: false }));
router.use(bodyParser.json());
var User = require('../user/User');

/**
 * Configure JWT
 */
var jwt = require('jsonwebtoken'); // used to create, sign, and verify tokens
var bcrypt = require('bcryptjs');

router.post('/login', function(req, res) {

  User.findOne({ email: req.body.email }, function (err, user) {
    if (err) return res.status(500).send('Error on the server.');
    if (!user) return res.status(404).send('No user found.');
    
    // check if the password is valid
    var passwordIsValid = bcrypt.compareSync(req.body.password, user.password);
    if (!passwordIsValid) return res.status(401).send({ auth: false, token: null });

    // if user is found and password is valid
    // create a token
    var token = jwt.sign({ id: user._id }, process.env.JWT_SECRET || config.JWT_SECRET, {
      expiresIn: 86400 // expires in 24 hours
    });

    // return the information including token as JSON
    res.status(200).send({ auth: true, token: token });
  });

});

router.get('/logout', function(req, res) {
  res.status(200).send({ auth: false, token: null });
});

router.post('/register', function(req, res) {

  var hashedPassword = bcrypt.hashSync(req.body.password, 8);

  User.create({
    name : req.body.name,
    email : req.body.email,
    password : hashedPassword
  }, 
  function (err, user) {
    if (err) return res.status(500).send("There was a problem registering the user`.");

    // if user is registered without errors
    // create a token
    var token = jwt.sign({ id: user._id }, process.env.JWT_SECRET || config.JWT_SECRET, {
      expiresIn: 86400*30 // expires in 24 hours
    });

    res.status(200).send({ auth: true, token: token });
  });

});

router.get('/me', VerifyToken, function(req, res, next) {

  User.findById(req.userId, { password: 0 }, function (err, user) {
    if (err) return res.status(500).send("There was a problem finding the user.");
    if (!user) return res.status(404).send("No user found.");
    res.status(200).send(user);
  });

});

router.post('/otp-login', function(req, res) {
  User.findOne({
    phoneNumber: req.body.number
  },
  function (err, user) {
    if (err) return res.status(500).send({ msg:'Error on the server. Please Try Again', auth: 'failed' });
    var otp = Math.floor(100000 + Math.random() * 900000);
    if (!user) {
      User.create({
          phoneNumber: req.body.number,
          otp: otp
      },
      function (err, user) {
          if (err) return res.status(500).send({ msg: "There was a problem generating the otp. Please Try Again.", auth: 'pending' });
          client.messages.create({
            body: 'Welcome User, Here is your OTP to login into your account ' + otp,
            to: '+91' + req.body.number,  // Text this number
            from: process.env.TWILIO_TEST_NUMBER || config.TWILIO_TEST_NUMBER // From a valid Twilio number
          })
            .then(() => {
              res.status(200).send({ msg: 'OTP Send Successflly To User', auth: 'pending', otp: user.otp });
            }).catch(err => {
              res.status(err.status || 503).send({ msg: err.message || 'OTP Service Unavailaible. Try Again in Some Time.', auth: 'failed', more_info: err.more_info })
            });
      });
    } else {
        User.findByIdAndUpdate(user._id, { phoneNumber: req.body.number, otp: otp }, { new: true }, function (err, user) {
          if (err) return res.status(500).send({ msg: "There was a problem generating the otp for user.", auth: 'pending' });
          client.messages.create({
            body: 'Welcome User, Here is your OTP to login into your account ' + user.otp,
            to: '+91' + req.body.number,  // Text this number
            from: process.env.TWILIO_TEST_NUMBER || config.TWILIO_TEST_NUMBER // From a valid Twilio number
          })
            .then(() => {
              res.status(200).send({ msg: 'OTP Send Successflly To User', auth: 'pending', otp: user.otp });
            })
            .catch(err => {
              res.status(err.status || 503).send({ msg: err.message || 'OTP Service Unavailaible. Try Again in Some Time.', auth: 'failed', more_info: err.more_info })
            });
          });
        }
    });
});

router.post('/verify', function(req, res) {
    User.findOne({
        phoneNumber: req.body.number
    },
    function (err, user) {
        if (err) return res.status(500).send({ msg:'Error on the server. Please Try Again', auth: 'failed' });
        if (!user) return res.status(404).send({ msg: 'No user found.', auth: 'failed' });

        var otpIsValid = req.body.otp === user.otp ? true : false;
        if (!otpIsValid) return res.status(401).send({ auth: false, token: null, msg: 'Invalid OTP. Please Try Again.' });

        // if user is found and otp is valid
        // create a token
        var token = jwt.sign({ id: user._id }, process.env.JWT_SECRET || config.JWT_SECRET, {
            expiresIn: 86400*30 // expires in 24 hours
        });
    
        // return the information including token as JSON
        res.status(200).send({ auth: true, token: token, msg: 'Authentication Sucessful' });
    });
});

router.post('/resend-otp', function(req, res) {
    User.findOne({
        phoneNumber: req.body.number
    },
    function (err, user) {
        if (err) return res.status(500).send({ msg:'Error on the server. Please Try Again', auth: 'pending' });
        if (!user) {
          var otp = Math.floor(100000 + Math.random() * 900000);
          User.create({
            phoneNumber: req.body.number,
            otp: otp
          },
          function (err, user) {
            if (err) return res.status(500).send({ msg: "There was a problem generating the otp. Please Try Again.", auth: 'pending' });
            client.messages.create({
              body: 'Welcome User, Here is your OTP to login into your account ' + user.otp,
              to: '+91' + req.body.number,  // Text this number
              from: process.env.TWILIO_TEST_NUMBER || config.TWILIO_TEST_NUMBER // From a valid Twilio number
            })
              .then(() => {
                res.status(200).send({ msg: 'OTP Send Successflly To User', auth: 'pending', otp: user.otp });
              })
              .catch(err => {
                res.status(err.status || 503).send({ msg: err.message || 'OTP Service Unavailaible. Try Again in Some Time.', auth: 'failed', more_info: err.more_info })
              });
          });
        }
        else {
          client.messages.create({
            body: 'Welcome User, Here is your OTP to login into your account ' + user.otp,
            to: '+91' + req.body.number,  // Text this number
            from: process.env.TWILIO_TEST_NUMBER || config.TWILIO_TEST_NUMBER // From a valid Twilio number
          })
            .then(() => {
              res.status(200).send({ msg: 'OTP Send Successflly To User', auth: 'pending', otp: user.otp });
            })
            .catch(err => {
              res.status(err.status || 503).send({ msg: err.message || 'OTP Service Unavailaible. Try Again in Some Time.', auth: 'failed', more_info: err.more_info })
            });
        }
  });
})

module.exports = router;