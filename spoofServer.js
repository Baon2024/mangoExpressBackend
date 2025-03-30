require('dotenv').config();
const express = require('express');
const cors = require('cors');



// Initialize Express app
const app = express();



// Configure CORS
app.use(cors());
app.use(express.json());





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
    
    setTimeout(() => {

        let spoofDataToReturn = [];
    console.log("spoofDataToReturn is:", spoofDataToReturn);
    
    for (let i = 0; i < columnsOfDataToReturn; i++) {
        const result = randomSentences[getRandomNumber()];
        console.log("result (random sentence) within for loop is:", result);
        spoofDataToReturn.push(result);
        
    
    }
    console.log("spoofDataToReturn after data adding is:", spoofDataToReturn);

    res.status(201).send(spoofDataToReturn);

}, randomTime)

  //add backend for making each call here
  // need to add prompt here for the API call to the agent: contextMessage will be inserted into prompt
  
  //see what the existing backend-call to Blank AI looks like in the backend github repo

})





// Start the server
const PORT = process.env.PORT || 5005;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
}); 

