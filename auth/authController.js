const express = require('express');
const router = express.Router();
const bodyParser = require('body-parser');
const twilio = require('twilio');
const client = new twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTHTOKEN);

const VerifyToken = require('./VerifyToken');

router.use(bodyParser.urlencoded({ extended: false }));
router.use(bodyParser.json());

const User = require('../user/User');

/**
 * Configure JWT
 */
const jwt = require('jsonwebtoken'); // used to create, sign, and verify tokens
const bcrypt = require('bcryptjs');

router.post('/login', function(req, res) {

  User.findOne({ email: req.body.email }, function (err, user) {
    if (err) return res.status(500).send('Error on the server.');
    if (!user) return res.status(404).send('No user found.');
    
    // check if the password is valid
    const passwordIsValid = bcrypt.compareSync(req.body.password, user.password);
    if (!passwordIsValid) return res.status(401).send({ auth: false, token: null });

    // if user is found and password is valid
    // create a token
    const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, {
      expiresIn: 86400 // expires in 24 hours
    });

    // return the information including token as JSON
    res.status(200).send({ auth: true, token: token });
  });

});

router.get('/logout', VerifyToken, function(req, res) {
  User.findOneAndUpdate({ 
    authToken: req.authToken
  }, { authToken: '' }, { new: true }, function (err, user) {
    if (err) return res.status(500).send({ msg: "There was a problem generating the otp for user.", type: 'error' });
    // authToken for user set to null
    req.authToken = '';
    return res.status(200).send({ msg: "Logout Successful" })
  });
});

router.post('/register', function(req, res) {

  const hashedPassword = bcrypt.hashSync(req.body.password, 8);

  User.create({
    name : req.body.name,
    email : req.body.email,
    password : hashedPassword
  }, 
  function (err, user) {
    if (err) return res.status(500).send("There was a problem registering the user`.");

    // if user is registered without errors
    // create a token
    const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, {
      expiresIn: 86400*30 // expires in 24 hours
    });

    res.status(200).send({ auth: true, token: token });
  });

});

// Dummy endpint to test Authentication

// router.get('/me', VerifyToken, function(req, res, next) {

//   User.findById(req.userId, { password: 0 }, function (err, user) {
//     if (err) return res.status(500).send("There was a problem finding the user.");
//     if (!user) return res.status(404).send("No user found.");
//     res.status(200).send(user);
//   });

// });

router.post('/otp-login', function(req, res) {
  if (!req.body.number) {
    return res.status(400).send({ msg:'Bad Request. Mobile Number Missing. Please Try Again', type: 'error', auth: 'failed' });
  }
  User.findOne({
    phoneNumber: req.body.number,
  },
  function (err, user) {
    if (err) return res.status(500).send({ msg:'Error on the server. Please Try Again', type: 'error', auth: 'failed' });
    const otp = Math.floor(100000 + Math.random() * 900000);
    if (!user) {
      User.create({
          phoneNumber: req.body.number,
          otp: otp
      },
      function (err, user) {
          if (err) return res.status(500).send({ msg: "There was a problem generating the otp. Please Try Again.", type: 'error', auth: 'failed' });
          client.messages.create({
            body: 'Welcome User, Here is your OTP to login into your account ' + otp,
            to: '+91' + req.body.number,  // Text this number
            from: process.env.TWILIO_TEST_NUMBER // From a valid Twilio number
          })
            .then(() => {
              return res.status(200).send({ msg: 'OTP Send Successflly To User', type: 'signup', auth: 'pending', otp: user.otp });
            }).catch(err => {
              return res.status(err.status || 503).send({ msg: err.message || 'OTP Service Unavailaible. Try Again in Some Time.', type: 'error', auth: 'failed', more_info: err.more_info })
            });
      });
    } else {
        User.findByIdAndUpdate(user._id, { phoneNumber: req.body.number, otp: otp }, { new: true }, function (err, user) {
          if (err) return res.status(500).send({ msg: "There was a problem generating the otp for user.", type: 'error', auth: 'failed' });
          client.messages.create({
            body: 'Welcome User, Here is your OTP to login into your account ' + user.otp,
            to: '+91' + req.body.number,  // Text this number
            from: process.env.TWILIO_TEST_NUMBER // From a valid Twilio number
          })
            .then(() => {
              return res.status(200).send({ msg: 'OTP Send Successflly To User', type: user.profileComplete ? 'login' : 'signup', auth: 'pending', otp: user.otp });
            })
            .catch(err => {
              return res.status(err.status || 503).send({ msg: err.message || 'OTP Service Unavailaible. Try Again in Some Time.', type: 'error', auth: 'failed', more_info: err.more_info })
            });
          });
        }
    });
});

router.post('/verify', function(req, res) {
  if (!req.body.number) {
    return res.status(400).send({ msg:'Bad Request. Mobile Number Missing. Please Try Again', type: 'error', auth: 'failed' });
  }
    User.findOne({
        phoneNumber: req.body.number
    },
    function (err, user) {
        if (err) return res.status(500).send({ msg:'Error on the server. Please Try Again', type: 'error', auth: 'failed' });
        if (!user) return res.status(404).send({ msg: 'No user found.', type: 'error', auth: 'failed' });

        const otpIsValid = req.body.otp === user.otp ? true : false;
        if (!otpIsValid) return res.status(400).send({ auth: 'failed', type: 'error', msg: 'Invalid OTP. Please Try Again.' });

        // if user is found and otp is valid
        // create a token
        const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, {
            expiresIn: 86400*30 // expires in 24 hours
        });
        if (user.profileComplete) {
          User.findByIdAndUpdate(user._id, { authToken: token }, { new: true }, function (err, user) {
            if (err) return res.status(500).send({ msg: "There was a problem generating auth credentials.", type: 'error', auth: 'failed' });
            // return the information including token as JSON
            return res.status(200).send({ auth: true, user: { name: user.name, email: user.email, phoneNumber: user.phoneNmber, authToken: user.authToken }, msg: 'Authentication Sucessful' });
          });
        } else {
          if (!req.body.name) {
            return res.status(400).send({ msg:'Bad Request. Name Missing. Please Try Again', type: 'error', auth: 'failed' });
          }
          if (!req.body.email) {
            return res.status(400).send({ msg:'Bad Request. Email Missing. Please Try Again', type: 'error', auth: 'failed' });
          }
            User.findByIdAndUpdate(user._id, { authToken: token, email: req.body.email, name: req.body.name, profileComplete: true }, { new: true }, function (err, user) {
              if (err) return res.status(500).send({ msg: "There was a problem generating auth credentials.", auth: 'failed' });
              // return the information including token as JSON
              return res.status(200).send({ auth: true, user: { name: user.name, email: user.email, phoneNumber: user.phoneNmber, authToken: user.authToken }, msg: 'Authentication Sucessful' });
          });
        }
    }); 
});

router.post('/resend-otp', function(req, res) {
  if (!req.body.number) {
    return res.status(400).send({ msg:'Bad Request. Mobile Number Missing. Please Try Again', type: 'error', auth: 'failed' });
  }
    User.findOne({
        phoneNumber: req.body.number
    },
    function (err, user) {
        if (err) return res.status(500).send({ msg:'Error on the server. Please Try Again', type: 'error', auth: 'failed' });
        if (!user) {
          const otp = Math.floor(100000 + Math.random() * 900000);
          User.create({
            phoneNumber: req.body.number,
            otp: otp
          },
          function (err, user) {
            if (err) return res.status(500).send({ msg: "There was a problem generating the otp. Please Try Again.", type: 'error', auth: 'failed' });
            client.messages.create({
              body: 'Welcome User, Here is your OTP to login into your account ' + user.otp,
              to: '+91' + req.body.number,  // Text this number
              from: process.env.TWILIO_TEST_NUMBER // From a valid Twilio number
            })
              .then(() => {
                return res.status(200).send({ msg: 'OTP Send Successflly To User', auth: 'pending', otp: user.otp });
              })
              .catch(err => {
                return res.status(err.status || 503).send({ msg: err.message || 'OTP Service Unavailaible. Try Again in Some Time.', type: 'error', auth: 'failed', more_info: err.more_info })
              });
          });
        }
        else {
          client.messages.create({
            body: 'Welcome User, Here is your OTP to login into your account ' + user.otp,
            to: '+91' + req.body.number,  // Text this number
            from: process.env.TWILIO_TEST_NUMBER // From a valid Twilio number
          })
            .then(() => {
              return res.status(200).send({ msg: 'OTP Send Successflly To User', auth: 'pending', otp: user.otp });
            })
            .catch(err => {
              return res.status(err.status || 503).send({ msg: err.message || 'OTP Service Unavailaible. Try Again in Some Time.', type: 'error', auth: 'failed', more_info: err.more_info })
            });
        }
  });
})

module.exports = router;