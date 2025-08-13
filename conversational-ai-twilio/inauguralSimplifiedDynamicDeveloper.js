import fastifyFormBody from '@fastify/formbody';
import fastifyWs from '@fastify/websocket';
import dotenv from 'dotenv';
import Fastify from 'fastify';
import Twilio from 'twilio';
import WebSocket from 'ws';
import ngrok from 'ngrok';
import fs from 'fs';
import FormData from 'form-data';
import os from "os";
import path from "path";
import { SpeechClient } from '@google-cloud/speech';
//import wav from 'wav';
//const { decode } = wav;
import wavDecoder from 'wav-decoder';
import OpenAI from 'openai';
import cors from '@fastify/cors';
//const Fastify = require('fastify');
//const cors = require('@fastify/cors');
import { assembleAnswerWithLLm } from './assembleAnswerWithLLm.js';
import fetch from 'node-fetch';
import { supabaseReal } from './supabase.js';
import getWarmth from './warmthRatingFunction.js';

// Load environment variables from .env file
dotenv.config();

//getWarmth("prewarm").catch((e) => console.error("[prewarm]", e));

const client = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY, // Securely load API key
});




const callsInProgress = {}; // Global object to store ongoing calls
const stuffFromFrontendFunctionNeedToStore = {}; //this is here to store number of questions, and questions, so i can decipher them from transcrip
//in order to return right number of correctly seperated questions


// Check for required environment variables
const {
  ELEVENLABS_API_KEY,
  ELEVENLABS_AGENT_ID,
  TWILIO_ACCOUNT_SID,
  TWILIO_AUTH_TOKEN,
  TWILIO_PHONE_NUMBER,
  OPENAI_API_KEY,
  GOOGLE_APPLICATION_CREDENTIALS
} = process.env;

/*console.log("envs are: ", ELEVENLABS_API_KEY,
    ELEVENLABS_AGENT_ID,
    TWILIO_ACCOUNT_SID,
    TWILIO_AUTH_TOKEN,
    TWILIO_PHONE_NUMBER,);*/

if (
  !ELEVENLABS_API_KEY ||
  !ELEVENLABS_AGENT_ID ||
  !TWILIO_ACCOUNT_SID ||
  !TWILIO_AUTH_TOKEN ||
  !TWILIO_PHONE_NUMBER
) {
  console.error('Missing required environment variables');
  throw new Error('Missing required environment variables');
}

const fastify = Fastify({ logger: true });

// ✅ Register CORS plugin
fastify.register(cors, {
  origin: ['http://localhost:3004', 'https://yatakalam-frontend.vercel.app','http://localhost:8080'], // Allowed origins
  methods: ['GET', 'POST', 'OPTIONS'], // Allowed HTTP methods
  allowedHeaders: ['Content-Type', 'Authorization', 'ngrok-skip-browser-warning', 'Accept', 'X-Requested-With', 'redirect', 'Cache-Control', 'Pragma'] // Allowed headers
});




fastify.register(fastifyFormBody);
fastify.register(fastifyWs);




// ✅ Parse JSON requests
fastify.addContentTypeParser('application/json', { parseAs: 'string' }, (req, body, done) => {
  try {
    const json = JSON.parse(body);
    done(null, json);
  } catch (err) {
    done(err);
  }
});

const PORT = process.env.PORT || 8002;

// Root route for health check
fastify.get('/', async (_, reply) => {
  reply.send({ message: 'Server is running' });
});

// Initialize Twilio client
const twilioClient = new Twilio(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN);

// Helper function to get signed URL for authenticated conversations
async function getSignedUrl(agentID) {//will need to pass down agentID as param here
  try {
    const response = await fetch(
      `https://api.elevenlabs.io/v1/convai/conversation/get_signed_url?agent_id=${agentID}`,//will need to add agentID as query parameter here
      {
        method: 'GET',
        headers: {
          'xi-api-key': ELEVENLABS_API_KEY,
        },
      }
    );

    if (!response.ok) {
      throw new Error(`Failed to get signed URL: ${response.statusText}`);
    }

    const data = await response.json();
    return data.signed_url;
  } catch (error) {
    console.error('Error getting signed URL:', error);
    throw error;
  }
}

fastify.post('/call-status', async (req, reply) => {
    console.log('Call status webhook received:', req.body);
    reply.send();
  });
  

// Route to initiate outbound calls
fastify.post('/outbound-call/:uniqueDeveloperNumber', async (request, reply) => {
  const { number } = request.body;
  console.log("number is: ", number);

  const uniqueDeveloperNumber = request.params.uniqueDeveloperNumber;
  console.log("uniqueDeveloperNumber is: ", uniqueDeveloperNumber);

  let questions 

  //use uniqueDeveloperNumber to retrieve correct developer questions from supabase database, and their id to use later to save
  let { data: developerQuestions, error } = await supabaseReal
  .from('user-details')
  .select('developer_questions')
  .eq("unique_developer_number", uniqueDeveloperNumber)

  if (error) {
    console.log("error returned from attempt to get developer questions: ", error);
    return;
  } else if (developerQuestions) {
    console.log("data returned from attempt to get developer questions: ", developerQuestions);
    questions = developerQuestions[0].developer_questions
  }

  console.log("value of questions after retrieving developer's questions: ", questions);
  let customQuestions = questions;

  //now use UDN to retrieve developer's UUID, and store for use in the webhook
  let { data: linked_user, error2 } = await supabaseReal
  .from('user-details')
  .select('linked_user')
  .eq("unique_developer_number", uniqueDeveloperNumber)

  let developerUUID

  if (error2) {
    console.log("there was an error trying to retrieve developer's UUID")
  } else if (linked_user) {
    console.log("UUID returned using developer's UDN is: ", linked_user);
    developerUUID = linked_user[0].linked_user
  }

  console.log("developerUUID after retriving it from supabase using UDN is: ", developerUUID);

  const countryCode = number.startsWith("+971") ? "UAE" : "Other";

  let agentID;
  
  let randomNumber = Math.round(Math.random());


  
    agentID =  "agent_8901k1p8n0hyf6s8nm6sh324c3zc"
  
  //need to replace random selection of agent, with selection based on phone number country code.

  console.log("agent id chosen is: ", agentID);

 
   const allQuestions = [...customQuestions];
  
  let questionNumber = allQuestions.length
  console.log("questionNumber after adding universal and customQuestions is: ", questionNumber);


  //can allow developer to send their own info for agent, by saving in database liek with questions, and then adding here in prompt to send.
  
  let prompt
  let first_message
  console.log("questionNumber intiialsied with length of custom questions is: ", questionNumber)

 if (agentID === "agent_1301k1r16hj3ew78sh3hds1s4y8x") {
  // ✅ Arabic version
  questions = ["ما اسمك؟", "ما ميزانيتك؟", "ما المنطقة التي تفضلها في دبي؟"];
  prompt = `أنت وكيل عقاري محترف من شركة Luxury Dubai، وهي شركة رائدة في مجال العقارات في دولة الإمارات. مهمتك هي جمع إجابات على الأسئلة التالية بشكل مهذب ومباشر، ثم إنهاء المكالمة بأدب بعد الحصول على كل الإجابات المطلوبة: ${allQuestions.join("، ")}`;
  first_message = "مرحبًا، أنا وكيل عقارات في دبي وأتصل بك لأنك أبديت اهتمامًا بعقارات دبي الجديدة. هل تفضل التحدث باللغة العربية أم الإنجليزية؟";
  //questionNumber = questions.length.toString();
} else {
  // ✅ English version
  //questions = ["What’s your name?", "What is your budget?", "Which area of Dubai do you prefer?"];
  prompt = `The interview questions are aimed at understanding an individual's personality across 5 key personality traits. Each question is attached to a type of personality trait. 
The user is you are ringing is called Jason Kramer. The Founder of Vital Findings. Your job is to collect answers to the following questions in a polite and direct way, then proactively end the call politely once all answers are obtained: ${allQuestions.join(", ")}`;
  first_message = "Hello, I'm an interviewer focused on undertsanding an individual's personality across 5 key personality traits. May I ask you some questions ";
  //questionNumber = questions.length.toString();
}


  //this can all be made dynamic, based on uniqueDeveloperCode passed as a parameter: '/:uniqueDeveloperCode/outbound-call'
  //then extract that with req.params.uniqueDeveloperCode (i presume still works like that in fastify?), and retrieve correct developer from database

  console.log("number is:", number, "prompt is:", prompt, "first_message is:", first_message, "questionNumber is:", questionNumber);

  //let agentID = ""
  //set agentID based on what the phone number prefix is, to UK English or UAE arabic agent id

  

  //do i need to change anything, to be able to do UAE or non-UK numbers??
  //change Agent ID based on whether number is UAE or UK, i think?
  //perhaps leave it blank initially in .env, and then set it here? (but wouldn't work in production)

  //const questionNumber = 4
  //const questions = ["How much does a new Ferrari cost?", "What colour ferrari would you like?"]

  const completePrompt = `You are a concise, procurement agent. When you have collected the answers to the questions you need to ask, proactively end the call in a polite manner.
  There are custom questions that the developer wants you to ask:  ${prompt}`

  //add in standard questions that will always be asked, as need that for predefined supabase data columns
 


  //i need to store number/realNumber, questionNumber and questions in a global state
    
   const trialPrompt = `You are a agent calling a number to ask questions the user has given you. You need to ask the person who answers ${questionNumber} questions. The questions are: ${questions} `;
   const trialFirstMessage = "Hi, I'm calling on behalf of my client. I would like to ask you a few questions.";

   //will need to store these variables in global state in key which is the phone number

   stuffFromFrontendFunctionNeedToStore[number] = {
    number,
    questionNumber,
    questions: allQuestions,
    correctPrompt: completePrompt,
    developerUUID,
    customQuestions
};

   

   console.log("value of stuffFromFrontendFunctionNeededToStore is:", stuffFromFrontendFunctionNeedToStore);

  if (!number) {
    return reply.code(400).send({ error: 'Phone number is required' });
  }

  console.log("request.headers.host is:", request.headers.host)

  try {
    const call = await twilioClient.calls.create({
      from: TWILIO_PHONE_NUMBER,
      to: number /*realNumber*/, //for testing
      url: `https://${request.headers.host}/outbound-call-twiml?prompt=${encodeURIComponent(//will need to add agentID as query param here
        completePrompt
      )}&first_message=${encodeURIComponent(first_message)}&agentId=${encodeURIComponent(agentID)}`,
      //this url, and query params passed, are how to pass dynamic variables to agent for starting
      
      record: true,  // Enables recording
    statusCallback: `https://${request.headers.host}/call-status`,
    statusCallbackEvent: ['completed', 'recording-completed'], //this is the chatgpt code to enable recording of the code and a webhook call with transcript
    recordingStatusCallback: `https://${request.headers.host}/recording-status`, // NEW: Webhook for recording
    recordingStatusCallbackEvent: ['completed'] // Fires when recording is done
    });
    

    if (call) {
    // Store callSid temporarily
    // // Prevent Fastify from auto-replying
    //  reply.hijack();

  callsInProgress[call.sid] = { reply }; //will need to delay reply until webhook endpoint, so block out reply below
    stuffFromFrontendFunctionNeedToStore[call.sid] = { number };
    console.log("stuffFromFrontendFunctionNeedToStore after adding number and call.side key-pair is:", stuffFromFrontendFunctionNeedToStore);

    console.log("callsInProgress is:", callsInProgress, "and call.sid is:", call.sid);

    console.log("reply.sent is:", reply.sent);
    //console.log("reply.send is:", reply.send);

    reply.send({
      success: true,
      message: 'Call initiated',
      callSid: call.sid,
    });
    console.log("reply.sent after initial reply.send is:", reply.sent);

    }
  } catch (error) {
    console.error('Error initiating outbound call:', error);

    console.log("reply.sent is:", reply.sent);
    
    // Only send reply if it hasn't been stored
  /*if (!reply.sent) {
    console.log('Sending response now');
    reply.code(500).send({
      success: false,
      error: 'Failed to initiate call',
    });
  }*/
  }
});

let fileId = '1QTiy_kKrPmwlkhaAkefa6xkINYdImugR';
let dest = './GACFile'; // Ensure this is a valid path, like './GACFile'
//https://drive.google.com/file/d/1QTiy_kKrPmwlkhaAkefa6xkINYdImugR/view?usp=sharing

async function downloadFileFromGoogleDrive(fileId, dest) {
    try {
        // Google Drive direct download URL
        const fileUrl = `https://drive.google.com/uc?export=download&id=${fileId}`;

        console.log(`Requesting download from: ${fileUrl}`);

        const response = await fetch(fileUrl);

        if (!response.ok) {
            throw new Error(`Failed to download file: ${response.statusText}`);
        }

        console.log(`Download successful, saving to: ${dest}`);

        // Save the file to the destination path
        const writer = fs.createWriteStream(dest);

        // Ensure the pipe is correctly set up
        response.body.pipe(writer);

        return new Promise((resolve, reject) => {
            writer.on('finish', () => {
                console.log('File download and save complete.');
                resolve();
            });
            writer.on('error', (err) => {
                console.error('Error saving file:', err);
                reject(err);
            });
        });
    } catch (error) {
        console.error('Error during download:', error);
    }
}





const getTranscript = async (recordingUrl) => {
    const transcription = await twilioClient.transcriptions.create({
      recordingSid: recordingUrl.split('/').pop(), // Extract the recording SID from the URL
    });
    console.log("transcription object inside of getTranscript functions is:", getTranscript);
  
    return transcription.transcriptionText;
  };

  /*async function transcribeAudio(audioBuffer) {
    const tempDir = os.tmpdir(); // Get system temp directory
    const filePath = path.join(tempDir, "temp_audio.wav"); // Use temp directory

    fs.writeFileSync(filePath, Buffer.from(audioBuffer)); // Save buffer to file

    console.log("Audio file saved at:", filePath);

    const form = new FormData();
    form.append("file", fs.createReadStream(filePath));
    form.append("model", "whisper-1");

    const response = await fetch("https://api.openai.com/v1/audio/transcriptions", {
        method: "POST",
        headers: {
            Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
            ...form.getHeaders(),
        },
        body: form,
    });

    fs.unlinkSync(filePath); // Cleanup after transcription

    if (!response.ok) {
        throw new Error(`Failed to transcribe audio: ${response.statusText}`);
    }

    const data = await response.json();
    return data.text;
}*/

async function transcribeAudio(audioBuffer) {
    const tempDir = os.tmpdir(); // Get system temp directory
    const filePath = path.join(tempDir, 'temp_audio.wav'); // Use temp directory

    // Save audio buffer to file
    fs.writeFileSync(filePath, Buffer.from(audioBuffer));

    console.log('Audio file saved at:', filePath);

    //This is where openai whisper replacement of google cloud begins

    const form = new FormData();
    form.append("file", fs.createReadStream(filePath));
    form.append("model", "whisper-1");

    const response = await fetch("https://api.openai.com/v1/audio/transcriptions", {
        method: "POST",
        headers: {
            Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
            ...form.getHeaders(),
        },
        body: form,
    });

    fs.unlinkSync(filePath); // Cleanup

    if (!response.ok) {
        throw new Error(`Failed to transcribe audio: ${response.statusText}`);
    }

    const data = await response.json();
    return data.text;


    //This is original google cloud code below
    // Read the audio file and decode it
    /*const audioData = fs.readFileSync(filePath);

    try {
        // Decode the WAV file using wav-decoder
        const wav = await wavDecoder.decode(audioData);
        const sampleRate = wav.sampleRate; // Get the sample rate from the decoded file

        await downloadFileFromGoogleDrive(fileId, dest);
        console.log("downloaded GAC now")

        // Initialize Google Cloud Speech-to-Text client
        const client = new SpeechClient();

        // Prepare the audio file for transcription (encode it as base64)
        const audio = {
            content: fs.readFileSync(filePath).toString('base64'),
        };

        // Configure the transcription request with the detected sample rate
        const config = {
            encoding: 'LINEAR16', // Specify encoding of your audio
            sampleRateHertz: sampleRate, // Use the sample rate from the WAV header
            languageCode: 'en-US', // Language of the audio
        };

        const request = {
            audio: audio,
            config: config,
        };

        // Send the transcription request to Google Cloud
        const [response] = await client.recognize(request);

        // Extract transcription from the response
        const transcription = response.results
            .map(result => result.alternatives[0].transcript)
            .join('\n');

        console.log('Transcription:', transcription);

        // Cleanup the temporary file after transcription
        fs.unlinkSync(filePath);

        return transcription;

    } catch (error) {
        // Cleanup the temporary file in case of an error
        fs.unlinkSync(filePath);
        throw new Error(`Failed to transcribe audio: ${error.message}`);
    }*/
}

  async function getTranscriptExternal(recordingUrl) {
    const auth = Buffer.from(`${process.env.TWILIO_ACCOUNT_SID}:${process.env.TWILIO_AUTH_TOKEN}`).toString('base64');

    const response = await fetch(recordingUrl, {
        headers: { Authorization: `Basic ${auth}` }
    });

    if (!response.ok) {
        throw new Error(`Failed to fetch recording: ${response.statusText}`);
    }

    const audioBuffer = await response.arrayBuffer();
    console.log("audioBuffer in getTranscriptExternal is:", audioBuffer);
    const audioTranscribed = await transcribeAudio(audioBuffer); // Call external transcription service
    console.log("audioTranscribed is:", audioTranscribed);
    return audioTranscribed;
}

/*fastify.post('/call-status', async (request, reply) => {
    const { CallSid, CallStatus, RecordingUrl } = request.body;

    console.log("recieved form twilio:", req.body);
  
    if (CallStatus === 'completed' && callsInProgress[CallSid]) {
      // Step 3: Get transcript (call an external function)
      const transcript = await getTranscriptExternal(RecordingUrl);

      console.log("trans", transcript);

      //need to first feed transcript to an LLM, in order to get returned array of answers to the questions
      //then attach number, so returned array matches what frontend expects
  
      // Step 4: Send response back to frontend
     callsInProgress[CallSid].reply.send({ 
        success: true, 
        message: 'Call completed', 
        callSid: CallSid, 
        transcript 
      });
  
      // Clean up memory
      delete callsInProgress[CallSid];
    }
  
    /*reply.send({ success: true });
  });*/

  fastify.post('/recording-status', async (request, reply) => {
    console.log("Received recording webhook:", request.body);

    //this is where you extract transcript, and store in database. 

    const { RecordingUrl, CallSid } = request.body;

    console.log("reply.sent is:", reply.sent);
    console.log("callsInProgress[CallSid] before checking reply:", callsInProgress[CallSid]);

    let number = stuffFromFrontendFunctionNeedToStore[CallSid].number
    delete stuffFromFrontendFunctionNeedToStore[CallSid].number //this should ensure its no longer around to interfere??

   





    if (RecordingUrl) {
        try {
            const transcript = await getTranscriptExternal(RecordingUrl); //replace with new one
            console.log("Transcript received:", transcript);
            //reply.send({ success: true, RecordingUrl, transcript });
            console.log("value of number in fastify webhook endpoint is:", number);

            //neeed tro retcieve questions and questionNumber from global state
            console.log("value of stuffFromFrontendFunctionNeededToStore is:", stuffFromFrontendFunctionNeedToStore);
            const questionNumber = stuffFromFrontendFunctionNeedToStore[number].questionNumber;
            const questions = stuffFromFrontendFunctionNeedToStore[number].questions;
            const correctPrompt = stuffFromFrontendFunctionNeedToStore[number].correctPrompt;
            const customQuestionsOriginal = stuffFromFrontendFunctionNeedToStore[number].customQuestions;

            console.log("value of quetsionNumber, questions and correctPrompt retrieved with number are:", questionNumber, questions, correctPrompt);
            console.log("value of customQuestiosn in webhook endoint is ",customQuestionsOriginal)
            //console.log("correctPrompt is:", correctPrompt);
            


            //then retrieve these values from sFFFNTS

            
            
           const prompt2 = `
You are an assistant extracting answers from a transcript.

Instructions:
- Only use the transcript below to answer the listed questions.
- Return the output as a valid JSON array of objects, with one object per question.
- Each object should have a single key (the question topic, e.g. "name", "budget") and a value that is the answer.
- If the answer cannot be found in the transcript, use "I’m not sure."
- The total number of answers must be exactly ${questionNumber}.

Example format:
[
  { "name": "John Smith" },
  { "budget": "£250,000" },
  { "area": "South London" }
]

for custom questions (${questions}), return a second array with teh structure:
[
  { "questionKey": "/answer to question/" },
  { "questionKey": "/answer to question/" },
]

do this for as many custom questions as there are (${questionNumber - 3})

Questions:
${correctPrompt}

Transcript:
"""${transcript}"""
`;

const prompt3 = `
You are an extraction assistant.

Return ONLY a valid JSON array (no code fences, no prose, no extra characters) of exactly ${customQuestionsOriginal.length} objects.
Each object must have exactly **one key** and its string value.



- For these custom items, use the **exact question text** as the key, in this order:
${JSON.stringify(customQuestionsOriginal, null, 2)}

Answer rules:
- Use ONLY the transcript below.
- If the answer is unknown, use "I’m not sure."
- No comments, no explanations, no markdown code fences — output only raw JSON.

Transcript:
"""${transcript}"""
`;

const messages = [
  {
    role: "system",
    content: "You are a precise extraction assistant. Follow the user's instructions exactly and output only the structured JSON answer.",
  },
  {
    role: "user",
    content: prompt3,
  },
];


            //okay, so just need to get this to work
            stuffFromFrontendFunctionNeedToStore[number].messages = messages;
            
            console.log("transcript length is:", transcript.length);


            const parsedResponse = await assembleAnswerWithLLm(messages);
            console.log("parsedResponse is:", parsedResponse);

            //add to database, in right arrangement
            //need fields from parsedResponse, plus number


            /*shape is this: parsedResponse is: [
  { name: 'January' },
  { budget: 'two hundred thousand dollars' },
  { area: 'Central Dubai' }
] */        const name = parsedResponse.find(obj => obj.name)?.name;
const budget = parsedResponse.find(obj => obj.budget)?.budget;
const area = parsedResponse.find(obj => obj.area)?.area;

console.log("Name:", name);
console.log("Budget:", budget);
console.log("Area:", area);

const parsedBudget = parseFloat(
  (budget || '').replace(/[^0-9.]/g, '')
);          
const universalQuestions = ['name', 'budget', 'area'];

// Extract custom questions
const customQuestions = parsedResponse.filter(item => {
  // Get the key for each item (e.g., 'live', 'address')
  const key = Object.keys(item)[0];
  // Filter out the universal questions and keep the custom ones
  return !universalQuestions.includes(key);
});

// The result will be an array of objects with custom question keys and their answers
console.log("Custom Questions:", customQuestions);

            //const cleanedNumber = number.replace(/^\+/, '');
            let stringNumber = number.toString()

            let developerUUID = stuffFromFrontendFunctionNeedToStore[number].developerUUID;
            console.log("developerUUID in webhook for call transcript is: ", developerUUID);

            /*const { data, error } = await supabase
            .from('inauguralMango')
            .insert([
            { phoneNumber: stringNumber, name: name, budget: parsedBudget, area: area },
            ])
            .select()*/

            //get warmthRating here, import function
            const leadWarmthRating = await getWarmth(transcript)
            console.log("leadWarmRating returned in main scrit is ", leadWarmthRating)

            const { data, error } = await supabaseReal
  .from('Call Lead Details')
  .insert([
    { linked_user: developerUUID, phoneNumber: stringNumber, name: name, budget: parsedBudget, area: area, custom_questions: customQuestions, lead_warmth_rating: leadWarmthRating },
  ])
  .select()

            console.log("data from supabase insertion attempt is: ", data, "and error is: ", error);

            //need to add response to globalState
            //stuffFromFrontendFunctionNeedToStore[number].response = parsedResponse;   
            console.log("stuffFromFrontendFunctionNeededToStore[number] is here:", stuffFromFrontendFunctionNeedToStore[number]);
            //console.log("stuffFromFrontendFunctionNeededToStore[number].response is here:", stuffFromFrontendFunctionNeedToStore[number].response);
            
            
              //delete callsInProgress[CallSid];
            delete stuffFromFrontendFunctionNeedToStore[questionNumber, questions];
            delete stuffFromFrontendFunctionNeedToStore[number].messages //no need to keep this around, when answer's been got
            
            
           

        } catch (error) {
            console.error("Error fetching transcript:", error);
            console.log('Sending response now');
            //reply.send({ success: false, message: "Failed to get transcript", error: error.message });
        }
    } else {
        console.log("No RecordingUrl found in webhook");
        console.log('Sending response now');
        //reply.send({ success: false, message: "No recording found" });
    }
});

/*
curl -X POST  https://583f9bd77ce7.ngrok-free.app/outbound-call \
-H "Content-Type: application/json" \
-d '{
  "number": "447311252643"
}'

curl -X POST https://78b9-131-111-185-176.ngrok-free.app/retrieve-response/:447311252643 \
-H "Content-Type: application/json" \
-d '{
  "number": "447311252643"
}'

curl -X POST https://f342-131-111-185-176.ngrok-free.app/retrieve-response/447311252643 \
-H "Content-Type: application/json" \
-d '{}'
*/



/*fastify.get(`/retrieve-response/:number`, async (request, reply) => {

    //console.log("request in /retrieveResponse endpoint is:", request);
    reply.type('application/json');
    reply
    .header('Access-Control-Allow-Origin', '*')
    .header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
    .header('Access-Control-Allow-Headers', 'Content-Type, Authorization')
    /*.send();

    const { number } = request.params 

    // If request is OPTIONS (preflight), do NOT modify or delete data
    if (request.method === 'OPTIONS') {
        return reply.code(204).send(); // Send a 204 No Content response
    }
    console.log("retrieve endpoint hit by fetch api request to get info for: ", number);

    //now need to change from .get to .post, in order to send number with api call, and use that to access response: [number].response
    //delete the global data attached to the number, then return response


    //const messages = stuffFromFrontendFunctionNeedToStore[number].messages;
    //console.log("messages for LLM in /retrieve-response endpoint:", messages);


     

    const correctResponse = stuffFromFrontendFunctionNeedToStore[number].response;
    console.log("correctResponse in /retrieveResponse endpoint is:", correctResponse);

    //const number = stuffFromFrontendFunctionNeedToStore.number;
    //console.log("number in /retrieveResponse endpoint is:", number);

    //I need to create this data structure: ['+447912345678', 'Joe-Joe', 'Cambridge', '£20']
    //so, need to stringify number
    //const stringifyNumber = JSON.stringify(number);
    //console.log("stringified number should be:", stringifyNumber);

    correctResponse.unshift(number);
    console.log("correctResponse after adding stringifiedNumber:", correctResponse);
    
    //lets try and make these delete if request doesn't have the options header??
    delete stuffFromFrontendFunctionNeedToStore[number].response;
    delete stuffFromFrontendFunctionNeedToStore[number].number;
    //delete stuffFromFrontendFunctionNeedToStore.questions;
    delete stuffFromFrontendFunctionNeedToStore[number].questionNumber;
    //delete stuffFromFrontendFunctionNeedToStore.messages;
    delete stuffFromFrontendFunctionNeedToStore[number].correctPrompt;
    delete stuffFromFrontendFunctionNeedToStore[number];

    console.log("stuffFromFrontendNeededToStore after deletion is now:", stuffFromFrontendFunctionNeedToStore);

    reply.code(201).send(correctResponse);

})*/



// TwiML route for outbound calls
fastify.all('/outbound-call-twiml', async (request, reply) => {
  // ❌ You’re using query params; keep it for now just to prove the fix works
  const rawPrompt = request.query.prompt || '';
  const rawFirst = request.query.first_message || '';
  const rawAgentId = request.query.agentId || '';

  // Escape for XML attribute values
  const escapeAttr = (s = '') =>
    String(s)
      .replace(/\r?\n+/g, ' ')   // no newlines in attributes
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&apos;');

  const prompt = escapeAttr(rawPrompt);
  const first_message = escapeAttr(rawFirst);
  const agentId = escapeAttr(rawAgentId);

  const twimlResponse = `<?xml version="1.0" encoding="UTF-8"?>
    <Response>
        <Connect>
        <Stream url="wss://${request.headers.host}/outbound-media-stream">
            <Parameter name="prompt" value="${prompt}" />
            <Parameter name="first_message" value="${first_message}" />
            <Parameter name="agentId" value="${agentId}" />
        </Stream>
        </Connect>
    </Response>`;

  reply.type('text/xml').send(twimlResponse);
});

// WebSocket route for handling media streams
fastify.register(async (fastifyInstance) => {
  fastifyInstance.get('/outbound-media-stream', { websocket: true }, (ws, req) => {
    console.info('[Server] Twilio connected to outbound media stream');

    // Variables to track the call
    let streamSid = null;
    let callSid = null;
    let elevenLabsWs = null;
    let customParameters = null; // Add this to store parameters

    // Handle WebSocket errors
    ws.on('error', console.error);

    // Set up ElevenLabs connection
    const setupElevenLabs = async (agentId) => {//will need to pass agentID here
      try {
        const signedUrl = await getSignedUrl(agentId);//will need to pass agentID here, extracted as param 
        elevenLabsWs = new WebSocket(signedUrl);

        elevenLabsWs.on('open', () => {
          console.log('[ElevenLabs] Connected to Conversational AI');

          // Send initial configuration with prompt and first message
          const initialConfig = {
            type: 'conversation_initiation_client_data',
            dynamic_variables: {
              user_name: 'Angelo',
              user_id: 1234,
            },
            conversation_config_override: {
              agent: {
                prompt: {
                  prompt: customParameters?.prompt || 'you are a gary from the phone store',
                },
                first_message:
                  customParameters?.first_message || 'hey there! how can I help you today?',
              },
            },
          };

          console.log(
            '[ElevenLabs] Sending initial config with prompt:',
            initialConfig.conversation_config_override.agent.prompt.prompt
          );

          // Send the configuration to ElevenLabs
          elevenLabsWs.send(JSON.stringify(initialConfig));
        });

        elevenLabsWs.on('message', (data) => {
          try {
            const message = JSON.parse(data);

            switch (message.type) {
              case 'conversation_initiation_metadata':
                console.log('[ElevenLabs] Received initiation metadata');
                break;

              case 'audio':
                if (streamSid) {
                  if (message.audio?.chunk) {
                    const audioData = {
                      event: 'media',
                      streamSid,
                      media: {
                        payload: message.audio.chunk,
                      },
                    };
                    ws.send(JSON.stringify(audioData));
                  } else if (message.audio_event?.audio_base_64) {
                    const audioData = {
                      event: 'media',
                      streamSid,
                      media: {
                        payload: message.audio_event.audio_base_64,
                      },
                    };
                    ws.send(JSON.stringify(audioData));
                  }
                } else {
                  console.log('[ElevenLabs] Received audio but no StreamSid yet');
                }
                break;

              case 'interruption':
                if (streamSid) {
                  ws.send(
                    JSON.stringify({
                      event: 'clear',
                      streamSid,
                    })
                  );
                }
                break;

              case 'ping':
                if (message.ping_event?.event_id) {
                  elevenLabsWs.send(
                    JSON.stringify({
                      type: 'pong',
                      event_id: message.ping_event.event_id,
                    })
                  );
                }
                break;

              case 'agent_response':
                console.log(
                  `[Twilio] Agent response: ${message.agent_response_event?.agent_response}`
                );
                break;

              case 'user_transcript':
                console.log(
                  `[Twilio] User transcript: ${message.user_transcription_event?.user_transcript}`
                );
                break;

              default:
                console.log(`[ElevenLabs] Unhandled message type: ${message.type}`);
            }
          } catch (error) {
            console.error('[ElevenLabs] Error processing message:', error);
          }
        });

        elevenLabsWs.on('error', (error) => {
          console.error('[ElevenLabs] WebSocket error:', error);
        });

        elevenLabsWs.on('close', () => {
          console.log('[ElevenLabs] Disconnected');
        });
      } catch (error) {
        console.error('[ElevenLabs] Setup error:', error);
      }
    };

    // Set up ElevenLabs connection
    //setupElevenLabs(); - move to intialise if msg.event === "start"

    // Handle messages from Twilio
    ws.on('message', (message) => {
      try {
        const msg = JSON.parse(message);
        if (msg.event !== 'media') {
          console.log(`[Twilio] Received event: ${msg.event}`);
        }

        switch (msg.event) {
          case 'start':
            streamSid = msg.start.streamSid;
            callSid = msg.start.callSid;
            customParameters = msg.start.customParameters; // Store parameters
            console.log(`[Twilio] Stream started - StreamSid: ${streamSid}, CallSid: ${callSid}`);
            console.log('[Twilio] Start parameters:', customParameters);


            // ✅ Extract the dynamic agent ID from Twilio params
            const agentId = customParameters.agentId;
            console.log('[Server] Using agentId for ElevenLabs:', agentId);
            // ✅ Setup the connection to the correct agent
            setupElevenLabs(agentId);
            
            break;

          case 'media':
            if (elevenLabsWs?.readyState === WebSocket.OPEN) {
              const audioMessage = {
                user_audio_chunk: Buffer.from(msg.media.payload, 'base64').toString('base64'),
              };
              elevenLabsWs.send(JSON.stringify(audioMessage));
            }
            break;

          case 'stop':
            console.log(`[Twilio] Stream ${streamSid} ended`);
            if (elevenLabsWs?.readyState === WebSocket.OPEN) {
              elevenLabsWs.close();
            }
            break;

          default:
            console.log(`[Twilio] Unhandled event: ${msg.event}`);
        }
      } catch (error) {
        console.error('[Twilio] Error processing message:', error);
      }
    });

    // Handle WebSocket closure
    ws.on('close', () => {
      console.log('[Twilio] Client disconnected');
      if (elevenLabsWs?.readyState === WebSocket.OPEN) {
        elevenLabsWs.close();
      }
    });
  });
});

//start Fastify server
async function startServer() {
  try {
    await fastify.listen({ port: PORT, host: '0.0.0.0' });
    console.log(`[Server] Listening on port ${PORT}`);

    // Only run ngrok in development
    if (process.env.NODE_ENV !== 'production') {
      const url = await ngrok.connect({
        proto: 'http',
        addr: PORT,
        region: 'us',
      });
      console.log(`🚇 Ngrok tunnel established at: ${url}`);
    }
  } catch (err) {
    console.error('Error starting server:', err);
    process.exit(1);
  }
}

startServer();

 /*
  
  curl -X POST https://69fc-131-111-185-176.ngrok-free.app/outbound-call \
-H "Content-Type: application/json" \
-d '{
  "prompt": "You are Eric, an outbound car sales agent. You are calling to sell a new car to the customer. Be friendly and professional and answer all questions.",
  "first_message": "Hello Thor, my name is Eric, I heard you were looking for a new car! What model and color are you looking for?",
  "number": "447311252643"
}'
  */
