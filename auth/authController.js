const express = require("express");
const router = express.Router();
const bodyParser = require("body-parser");
const { v4: uuidv4 } = require("uuid");

router.use(bodyParser.urlencoded({ extended: false }));
router.use(bodyParser.json());

const TwilioUtility = require("../utility/TwilioUtility");
const Validator = require("../utility/validator");
const VerifyToken = require("./VerifyToken");
const User = require("../user/User");

/**
 * Configure JWT
 */
const jwt = require("jsonwebtoken"); // used to create, sign, and verify tokens
const bcrypt = require("bcryptjs");

router.post("/login", function (req, res) {
  User.findOne({ email: req.body.email }, function (err, user) {
    if (err) return res.status(500).send("Error on the server.");
    if (!user) return res.status(404).send("No user found.");

    // check if the password is valid
    const passwordIsValid = bcrypt.compareSync(
      req.body.password,
      user.password
    );
    if (!passwordIsValid)
      return res.status(401).send({ auth: false, token: null });

    // if user is found and password is valid
    // create a token
    const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, {
      expiresIn: 86400, // expires in 24 hours
    });

    // return the information including token as JSON
    res.status(200).send({ auth: true, token: token });
  });
});

router.get("/logout", VerifyToken, function (req, res) {
  User.findOneAndUpdate(
    {
      authToken: req.authToken,
    },
    { authToken: "" },
    { new: true },
    function (err, user) {
      if (err)
        return res.status(500).send({
          msg: "There was a problem generating the otp for user.",
          type: "error",
        });
      if (!user) {
        return res
          .status(400)
          .send({ msg: "Bad Request. User Not Found.", type: "error" });
      }
      // authToken for user set to null
      req.authToken = "";
      return res.status(200).send({ msg: "Logout Successful" });
    }
  );
});

router.post("/register", function (req, res) {
  const hashedPassword = bcrypt.hashSync(req.body.password, 8);

  User.create(
    {
      name: req.body.name,
      email: req.body.email,
      password: hashedPassword,
    },
    function (err, user) {
      if (err)
        return res
          .status(500)
          .send("There was a problem registering the user`.");

      // if user is registered without errors
      // create a token
      const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, {
        expiresIn: 86400 * 30, // expires in 24 hours
      });

      res.status(200).send({ auth: true, token: token });
    }
  );
});

// Dummy endpint to test Authentication

// router.get('/me', VerifyToken, function(req, res, next) {

//   User.findById(req.userId, { password: 0 }, function (err, user) {
//     if (err) return res.status(500).send("There was a problem finding the user.");
//     if (!user) return res.status(404).send("No user found.");
//     res.status(200).send(user);
//   });

// });

router.post("/otp-login", function (req, res) {
  const { number } = req.body;
  if (!number || number.length !== 10) {
    return res.status(400).send({
      msg: "Bad Request. Mobile Number Missing or Incorrect. Please Try Again",
      type: "error",
      auth: "failed",
    });
  }
  User.findOne(
    {
      phoneNumber: number,
    },
    function (err, user) {
      if (err)
        return res.status(500).send({
          msg: "Error on the server. Please Try Again",
          type: "error",
          auth: "failed",
        });
      const otp = Math.floor(100000 + Math.random() * 900000);
      const timestamp = Math.round(new Date().getTime() / 1000);
      if (!user) {
        User.create(
          {
            phoneNumber: number,
            otp: { value: otp, timestamp },
          },
          function (err, user) {
            if (err)
              return res.status(500).send({
                msg:
                  "There was a problem generating the otp. Please Try Again.",
                type: "error",
                auth: "failed",
              });
            return TwilioUtility(user.otp.get("value"), number, "signup", res);
          }
        );
      } else {
        if (timestamp - user.otp.get('timestamp') < 300000) {
          return TwilioUtility(
            user.otp.get("value"),
            number,
            "login",
            res
          );
        }
        User.findByIdAndUpdate(
          user._id,
          { otp: { value: otp, timestamp } },
          { new: true },
          function (err, user) {
            if (err)
              return res.status(500).send({
                msg: "There was a problem generating the otp for user.",
                type: "error",
                auth: "failed",
              });
            return TwilioUtility(
              user.otp.get("value"),
              number,
              user.profileComplete ? "login" : "signup",
              res
            );
          }
        );
      }
    }
  );
});

router.post("/verify", function (req, res) {
  const { number, otp } = req.body;
  if (!number || number.length !== 10) {
    return res.status(400).send({
      msg: "Bad Request. Mobile Number Missing or Incorrect. Please Try Again",
      type: "error",
      auth: "failed",
    });
  }
  User.findOne(
    {
      phoneNumber: number,
    },
    function (err, user) {
      if (err)
        return res.status(500).send({
          msg: "Error on the server. Please Try Again",
          type: "error",
          auth: "failed",
        });
      if (!user)
        return res.status(400).send({
          msg: "Bad Request. No user found with given Mobile Number.",
          type: "error",
          auth: "failed",
        });

      let otpIsValid = false;
      if (otp === user.otp.get("value")) {
        const timestamp = Math.round(new Date().getTime() / 1000);
        if (timestamp - user.otp.get("timestamp") < 300000) {
          otpIsValid = true;
        }
      }
      if (!otpIsValid)
        return res.status(400).send({
          auth: "failed",
          type: "error",
          msg: "Invalid OTP. Please Try Again.",
        });

      if (user.profileComplete) {
        // if user is found and otp is valid
        // create a token
        const userData = {
          name: user.name,
          email: user.email,
          phoneNumber: user.phoneNumber,
          role: user.role,
          // authToken: user.authToken ? user.authToken : uuidv4(),
        };
        if (user.authToken) {
          // if user is found and otp is valid login the user
            // create a token
            const token = jwt.sign(
              { ...userData, id: user._id, authToken: user.authToken },
              process.env.JWT_SECRET,
              {
                expiresIn: 86400, // expires in 24 hours
              }
            );
            // return the information including token as JSON
            return res.status(200).send({
              auth: true,
              user: { ...userData, authToken: token },
              msg: "Authentication Sucessful",
            });
        }
        User.findByIdAndUpdate(
          user._id,
          { authToken: uuidv4() },
          { new: true },
          function (err, user) {
            if (err)
              return res.status(500).send({
                msg: "There was a problem generating auth credentials.",
                type: "error",
                auth: "failed",
              });

            // if user is found and otp is valid login the user
            // create a token
            const token = jwt.sign(
              { ...userData, id: user._id },
              process.env.JWT_SECRET,
              {
                expiresIn: 86400, // expires in 24 hours
              }
            );
            // return the information including token as JSON
            return res.status(200).send({
              auth: true,
              user: { ...userData, authToken: token },
              msg: "Authentication Sucessful",
            });
          }
        );
      } else {
        const { name, email } = req.body;
        if (!name) {
          return res.status(400).send({
            msg: "Bad Request. Name Missing. Please Try Again",
            type: "error",
            auth: "failed",
          });
        }
        if (!email || !Validator.validateEmail(email)) {
          return res.status(400).send({
            msg: "Bad Request. Email Missing or Invalid. Please Try Again",
            type: "error",
            auth: "failed",
          });
        }
        const userData = {
          name,
          email,
          phoneNumber: user.phoneNumber,
          role: user.role,
          authToken: uuidv4(),
        };

        User.findByIdAndUpdate(
          user._id,
          { authToken: userData.authToken, email, name, profileComplete: true },
          { new: true },
          function (err, user) {
            if (err)
              return res.status(500).send({
                msg: "There was a problem generating auth credentials.",
                auth: "failed",
              });

            // if user is found and otp is valid login the user
            // create a token
            const token = jwt.sign(
              { ...userData, id: user._id },
              process.env.JWT_SECRET,
              {
                expiresIn: 86400, // expires in 24 hours
              }
            );
            // return the information including token as JSON
            return res.status(200).send({
              auth: true,
              user: { ...userData, authToken: token },
              msg: "Authentication Sucessful",
            });
          }
        );
      }
    }
  );
});

router.post("/resend-otp", function (req, res) {
  const { number } = req.body;
  if (!number || number.length !== 10) {
    return res.status(400).send({
      msg: "Bad Request. Mobile Number Missing. Please Try Again",
      type: "error",
      auth: "failed",
    });
  }
  User.findOne(
    {
      phoneNumber: number,
    },
    function (err, user) {
      if (err)
        return res.status(500).send({
          msg: "Error on the server. Please Try Again",
          type: "error",
          auth: "failed",
        });
      const otp = Math.floor(100000 + Math.random() * 900000);
      if (!user) {
        User.create(
          {
            phoneNumber: number,
            otp: {
              value: otp,
              timestamp: Math.round(new Date().getTime() / 1000),
            },
          },
          function (err, user) {
            if (err)
              return res.status(500).send({
                msg:
                  "There was a problem generating the otp. Please Try Again.",
                type: "error",
                auth: "failed",
              });
            return TwilioUtility(user.otp.get("value"), number, "reset-otp", res);
          }
        );
      } else {
        const timestamp = Math.round(new Date().getTime() / 1000);
        if (timestamp - user.otp.get("timestamp") < 300000) {
          return TwilioUtility(user.otp.get("value"), number, "reset-otp", res);
        } else {
          User.findByIdAndUpdate(
            { phoneNumber: number },
            { otp: { value: otp, timestamp: timestamp } },
            { new: true },
            function (err, user) {
              if (err)
                return res.status(500).send({
                  msg: "There was a problem generating auth credentials.",
                  type: "error",
                  auth: "failed",
                });
              return TwilioUtility(otp, number, "reset-otp", res);
            }
          );
        }
      }
    }
  );
});

module.exports = router;
