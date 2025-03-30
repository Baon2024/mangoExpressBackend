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
    url: "http://demo.twilio.com/docs/voice.xml", //will need to replace this with the real "--.xml" url, for instructions
  });

  console.log(call.sid);
}

// Initialize Express app
const app = express();

// In-memory store for sheets
//const inMemorySheets = {};

// Configure CORS
app.use(cors());
app.use(express.json());

app.get('/', (req, res) => {

    const twiml = new VoiceResponse();

    twiml.say('Hello from your pals at Twilio! Have fun.');
    
    res.type('text/xml');
    res.send(twiml.toString());
})



app.post('/makeCall', (req, res) => {


   

    //need to get contextPrompt and numbers from req
    

  //add backend for making each call here
  // need to add prompt here for the API call to the agent: contextMessage will be inserted into prompt
  
  //see what the existing backend-call to Blank AI looks like in the backend github repo

})

app.post('/webhook', (req, res) => {

    //if you need to pass subsuquent questions for voiceagent to ask, then you can set a let prompt above, update from /makeCall, and use in /webhook 
  
    // Create TwiML response
    const twiml = new VoiceResponse();

    twiml.say('Hello from your pals at Twilio! Have fun.');

})






// Start the server
const PORT = process.env.PORT || 5003;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
}); 



// Assuming you have set up your ngrok tunnel like this:
ngrok.connect(5003)
  .then(url => {
    console.log(`Ingress established at: ${url}`);
  })
  .catch(err => {
    console.error('Failed to establish tunnel:', err);
  });

  //run "node server.js" to start the ngrok, don't need to do "pnpm exec http ngrok"