require('dotenv').config();
const express = require('express');
const cors = require('cors');
const Twilio = require('twilio');
const ngrok = require('ngrok');


// Initialize Express app
const app = express();



// Configure CORS
app.use(cors());
app.use(express.json());

const {
    ELEVENLABS_API_KEY,
    ELEVENLABS_AGENT_ID,
    TWILIO_ACCOUNT_SID,
    TWILIO_AUTH_TOKEN,
    TWILIO_PHONE_NUMBER,
    OPENAI_API_KEY,
    GOOGLE_APPLICATION_CREDENTIALS
  } = process.env;

  console.log("twilio phone number is:", TWILIO_PHONE_NUMBER);

// Initialize Twilio client
const twilioClient = new Twilio(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN);


  const randomSentences = [
    ["The cat jumped over the fence."],
    ["A dog chased after the ball in the yard."],
    ["My friend loves to play video games every weekend."],
    ["The teacher explained the lesson in great detail."],
    ["A student finished their homework early this afternoon."],
    ["The car drove down the winding road at top speed."],
    ["A bird flew across the sky, soaring above the trees."],
    ["An astronaut floated in space, gazing at the Earth below."],
    ["The scientist discovered a new species of insect."],
    ["The chef prepared a delicious meal for the guests."]
  ];
  
  function getRandomNumber() {
    return Math.floor(Math.random() * randomSentences.length);
}
  

app.post('/SpoofEndpoint', async (req, res) => {
    
    
    //console.log("req.body is:", await req.body);
    const spoofData  = await req.body;
    console.log("spoofData in /spoofEndpoint is:", spoofData);

    const formattedNumber = spoofData.formattedNumber;
    console.log("formattedNumber is:", formattedNumber);

    const contextPrompt = spoofData.contextText;
    console.log("contextPrompt in the backend is:", contextPrompt);

    const questionsToAsk = spoofData.question;
    console.log("QuestionsToAsk in the backend:", questionsToAsk, "length is:", questionsToAsk.length);


    const columnsOfDataToReturn = questionsToAsk.length;
    console.log("columnsOfDataToReturn is:", columnsOfDataToReturn);

    const time = Math.random();
    const randomTime = time * 1000
    console.log("randomTime is:", randomTime);

    const realNumber = '+447311252643'; // Correctly formatted number +447311252643

    const prompt = `You need to ask these questions: ${questionsToAsk}`;
    const firstMessage = `Hi, I'm calling to ask you some questions. Are we okay to proceed?`
    
    
    
    setTimeout(() => {

        let spoofDataToReturn = [];
    console.log("spoofDataToReturn is:", spoofDataToReturn);
    
    /*for (let i = 0; i < columnsOfDataToReturn; i++) {
        const result = randomSentences[getRandomNumber()];
        console.log("result (random sentence) within for loop is:", result);
        spoofDataToReturn.push(result);
        
    
    }*/ //Temporaryily removed for test
    console.log("spoofDataToReturn after data adding is:", spoofDataToReturn);
    const response = ["Joe-Joe", "Cambridge", "£20"]
    spoofDataToReturn.push(response);

    res.status(201).send(spoofDataToReturn);
    }, /*randomTime*/ 4500) 
  })

  //add backend for making each call here
  // need to add prompt here for the API call to the agent: contextMessage will be inserted into prompt
  
  //see what the existing backend-call to Blank AI looks like in the backend github repo

//})





// Start the server
const PORT = process.env.PORT || 5005;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
}); 

/*ngrok.connect(5005)
  .then(url => {
    console.log(`Ingress established at: ${url}`);
  })
  .catch(err => {
    console.error('Failed to establish tunnel:', err);
  });*/