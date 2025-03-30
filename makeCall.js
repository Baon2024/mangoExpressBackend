// Download the helper library from https://www.twilio.com/docs/node/install
const twilio = require("twilio"); // Or, for ESM: import twilio from "twilio";

// Find your Account SID and Auth Token at twilio.com/console
// and set the environment variables. See http://twil.io/secure
const TWILIO_ACCOUNT_SID = 'AC11c4c49551f9e9fe6779d9291d9e4b66';
const TWILIO_AUTH_TOKEN = 'c88ffb414481af03ca81e825d7f2e4d1';
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const VoiceResponse = require('twilio').twiml.VoiceResponse;
const ngrok = require('ngrok');
const authtoken_from_env = '2up3M8Zq718vQNPYkTrYAWfgp6r_7tykyYLxqhMAPr2BXna6D';

const accountSid = process.env.TWILIO_ACCOUNT_SID;
const authToken = process.env.TWILIO_AUTH_TOKEN;
//const client = twilio(accountSid, authToken);
const client = twilio(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN);

async function createCall() {
  const call = await client.calls.create({
    from: "+987654321", //replace with phone number you buy
    to: '+4407311252643', //my personal phone number
    url: "http://demo.twilio.com/docs/voice.xml",
  });

  console.log(call.sid);
}

//createCall();

const http = require('http');
//const VoiceResponse = require('twilio').twiml.VoiceResponse;

http
  .createServer((req, res) => {
    // Create TwiML response
    const twiml = new VoiceResponse();

    twiml.say('Hello from your pals at Twilio! Have fun.');

    res.writeHead(200, { 'Content-Type': 'text/xml' });
    res.end(twiml.toString());
  })
  .listen(5004, '127.0.0.1');

console.log('TwiML server running at http://127.0.0.1:1337/');



// Get your endpoint online
/*ngrok.connect({ addr: PORT || 5003, authtoken_from_env: true })
	.then(listener => console.log(`Ingress established at: ${listener.url()}`));*/

// Assuming you have set up your ngrok tunnel like this:
ngrok.connect(5004)
  .then(url => {
    console.log(`Ingress established at: ${url}`);
  })
  .catch(err => {
    console.error('Failed to establish tunnel:', err);
  });