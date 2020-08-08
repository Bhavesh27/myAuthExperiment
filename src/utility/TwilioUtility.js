import twilio from "twilio";

function TwilioUtility(otp, number, nextStep, res) {
  const client = new twilio(
    process.env.TWILIO_ACCOUNT_SID,
    process.env.TWILIO_AUTHTOKEN
  );
  client.messages
    .create({
      body: "Welcome User, Here is your OTP to login into your account " + otp,
      to: "+91" + number, // Text this number
      from: process.env.TWILIO_TEST_NUMBER, // From a valid Twilio number
    })
    .then(() => {
      return res
        .status(200)
        .send({
          msg: "OTP Send Successflly To User",
          type: nextStep,
          auth: "pending",
          otp: otp,
        });
    })
    .catch((err) => {
      return res
        .status(err.status || 503)
        .send({
          msg:
            err.message || "OTP Service Unavailaible. Try Again in Some Time.",
          type: "error",
          auth: "failed",
          more_info: err.more_info,
        });
    });
}

export default TwilioUtility;
