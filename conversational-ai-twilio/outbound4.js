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

// Load environment variables from .env file
dotenv.config();

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
  origin: ['http://localhost:3004', 'https://cc7f-131-111-185-176.ngrok-free.app', 'https://mango-frontend-liard.vercel.app'], // Allowed origins
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
async function getSignedUrl() {
  try {
    const response = await fetch(
      `https://api.elevenlabs.io/v1/convai/conversation/get_signed_url?agent_id=${ELEVENLABS_AGENT_ID}`,
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
fastify.post('/outbound-call', async (request, reply) => {
  const { number, prompt, first_message, questionNumber } = request.body;
  console.log("number is:", number, "prompt is:", prompt, "first_message is:", first_message, "questionNumber is:", questionNumber);

  //okay, you need to send questions from frontend too, so they can be attached to input for LLM

  //when testing locally, unblock questionNumber below, and remove it above || or add questionNumber to curl body

  const realNumber = '+447311252643'; // Correctly formatted number +447311252643

  //const questionNumber = 4
  const questions = ["How much does a new Ferrari cost?", "What colour ferrari would you like?"]

  const completePrompt = `You are a concise, procurement agent. When you have collected the answers to the questions you need to ask, proactively end the call in a polite manner.
  Here's extra instruction:  ${prompt}`

  //i need to store number/realNumber, questionNumber and questions in a global state
    
   const trialPrompt = `You are a agent calling a number to ask questions the user has given you. You need to ask the person who answers ${questionNumber} questions. The questions are: ${questions} `;
   const trialFirstMessage = "Hi, I'm calling on behalf of my client. I would like to ask you a few questions.";

   //will need to store these variables in global state in key which is the phone number

   stuffFromFrontendFunctionNeedToStore[number] = {
    number,
    questionNumber,
    correctPrompt: completePrompt,
};

   /*stuffFromFrontendFunctionNeedToStore.number = number;
   stuffFromFrontendFunctionNeedToStore.questionNumber = questionNumber;
   stuffFromFrontendFunctionNeedToStore.questions = questions;
   stuffFromFrontendFunctionNeedToStore.correctPrompt = completePrompt;*/

   
  

   console.log("value of stuffFromFrontendFunctionNeededToStore is:", stuffFromFrontendFunctionNeedToStore);

  if (!realNumber) {
    return reply.code(400).send({ error: 'Phone number is required' });
  }

  console.log("request.headers.host is:", request.headers.host)

  try {
    const call = await twilioClient.calls.create({
      from: TWILIO_PHONE_NUMBER,
      to: number /*realNumber*/, //for testing
      url: `https://${request.headers.host}/outbound-call-twiml?prompt=${encodeURIComponent(
        completePrompt
      )}&first_message=${encodeURIComponent(first_message)}`,
      
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

    // Read the audio file and decode it
    const audioData = fs.readFileSync(filePath);

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
    }
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

    const { RecordingUrl, CallSid } = request.body;

    console.log("reply.sent is:", reply.sent);
    console.log("callsInProgress[CallSid] before checking reply:", callsInProgress[CallSid]);

    let number = stuffFromFrontendFunctionNeedToStore[CallSid].number
    delete stuffFromFrontendFunctionNeedToStore[CallSid].number //this should ensure its no longer around to interfere??


    if (RecordingUrl) {
        try {
            const transcript = await getTranscriptExternal(RecordingUrl);
            console.log("Transcript received:", transcript);
            //reply.send({ success: true, RecordingUrl, transcript });
            console.log("value of number in fastify webhook endpoint is:", number);

            //neeed tro retcieve questions and questionNumber from global state
            console.log("value of stuffFromFrontendFunctionNeededToStore is:", stuffFromFrontendFunctionNeedToStore);
            const questionNumber = stuffFromFrontendFunctionNeedToStore[number].questionNumber;
            const questions = stuffFromFrontendFunctionNeedToStore[number].questions;
            const correctPrompt = stuffFromFrontendFunctionNeedToStore[number].correctPrompt;

            console.log("value of quetsionNumber, questions and correctPrompt retrieved with number are:", questionNumber, questions, correctPrompt);

            //console.log("correctPrompt is:", correctPrompt);
            


            //then retrieve these values from sFFFNTS

            const prompt = `The number of questions is ${questionNumber}. The questions that were asked are: ${questions}. The transcript of the call is: ${transcript}`;
            
            const prompt2 = `You need to extract answers from the transcript to answer each question listed below. 
- The output **must** be a JSON array with exactly ${questionNumber} elements.
- Each answer should directly match the question.
- If the transcript does not contain an answer, return "I’m not sure."
- Format example: ["answer1", "answer2", "answer3"].

## Questions: 
${correctPrompt}

## Transcript:
"${transcript}"`;

            console.log("the value of prompt is:", prompt);

            //okay, now add the call to the LLM here, and prompt engineering to show example of how to return array of answers
            const messages = [
                {
                    role: "system",
                    content: /*`You need to take the answers given by the user from the transcript, to answer the questions listed in the prompt. You can only answer the questions using the information in the transcript. The answer should be structured so that each answer is a string member of an array. The number of array items should match the number of questions: ${questionNumber}.Return the answers as a valid JSON array with one item per question. If an answer is missing, return "I’m not sure." Example format: ["answer1", "answer2", "answer3"]. `*/ `You need to extract answers from the transcript to answer each question listed in the prompt. 
                    - ou are an assistant extracting answers from a call transcript.
        - Only use the information present in the transcript to answer the questions.
        - Return exactly ${questionNumber} answers in a valid JSON array..
                    - The transcript is this: ${prompt2}.
                    - If the transcript lacks an answer, insert "I’m not sure." in its place.
                    - The format **must** be valid JSON: ["answer1", "answer2", ..., "answer${questionNumber}"].`,
                },
                {
                    role: "user",
                    content: prompt2,
                },
                /*{
                    role: "user",
                    content: "The number of questions is: 3. The questions that were asked are: Where is Cambridge?, In what Country is Cambridge located?, How much does it cost to rent in Cambridge per year?. Transcript: ",
                },
                {
                    role: "assistant",
                    content: "['£170,000 pounds', 'blue']",
                }*/
            ]

            //okay, so just need to get this to work
            stuffFromFrontendFunctionNeedToStore[number].messages = messages;
            
            console.log("transcript length is:", transcript.length);


            const parsedResponse = await assembleAnswerWithLLm(messages);
        
            /*const response = await client.chat.completions.create({
                model: "gpt-4o-mini",
                store: false,
                messages: messages,
            });
            console.log("full response is:", response);
            console.log("response is:", response.choices[0].message);

            const correctResponse = response.choices[0].message;
            console.log("correctResponse is:", correctResponse.content);
            const parsedResponse = JSON.parse(correctResponse.content);*/

            console.log("parsedResponse is:", parsedResponse);

            //need to add response to globalState
            stuffFromFrontendFunctionNeedToStore[number].response = parsedResponse;   
            console.log("stuffFromFrontendFunctionNeededToStore[number] is here:", stuffFromFrontendFunctionNeedToStore[number]);
            console.log("stuffFromFrontendFunctionNeededToStore[number].response is here:", stuffFromFrontendFunctionNeedToStore[number].response);
            
            
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
curl -X POST  https://f342-131-111-185-176.ngrok-free.app/outbound-call \
-H "Content-Type: application/json" \
-d '{
  "prompt": "You are Eric, an outbound car sales agent. You are calling to sell a new car to the customer. Be friendly and professional and answer all questions.",
  "first_message": "Hello Thor, my name is Eric, I heard you were looking for a new car! What model and color are you looking for?",
  "questionNumber": "2",
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



fastify.get(`/retrieve-response/:number`, async (request, reply) => {

    //console.log("request in /retrieveResponse endpoint is:", request);
    reply.type('application/json');
    reply
    .header('Access-Control-Allow-Origin', '*')
    .header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
    .header('Access-Control-Allow-Headers', 'Content-Type, Authorization')
    /*.send()*/;

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

})

//curl -X GET https://74d7-131-111-185-176.ngrok-free.app/retrieve-response

// TwiML route for outbound calls
fastify.all('/outbound-call-twiml', async (request, reply) => {
  const prompt = request.query.prompt || '';
  const first_message = request.query.first_message || '';

  const twimlResponse = `<?xml version="1.0" encoding="UTF-8"?>
    <Response>
        <Connect>
        <Stream url="wss://${request.headers.host}/outbound-media-stream">
            <Parameter name="prompt" value="${prompt}" />
            <Parameter name="first_message" value="${first_message}" />
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
    const setupElevenLabs = async () => {
      try {
        const signedUrl = await getSignedUrl();
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
    setupElevenLabs();

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
fastify.listen({ port: PORT, host: '0.0.0.0' }, (err) => {
    if (err) {
      console.error('Error starting server:', err);
      process.exit(1);
    }
    console.log(`[Server] Listening on port ${PORT}`);
  });

  (async function() {
    const url = await ngrok.connect({
      proto: 'http',  // or 'tcp' if needed
      addr: PORT, // Match your Fastify server's port
      region: 'us' // Change based on your location if needed
    });
    console.log(`Ngrok tunnel established at: ${url}`);
  })();

 //next steops, once twilio number works and can test call itself
 //is to add in endpoint for webhook, to get transcript on completion, and and then use stored numberOfQuestions and questions
 //to feed them + transcript to LLM to output an array of the answers given by the user
 //can then return that to the frontend function


  /*
  
  curl -X POST https://69fc-131-111-185-176.ngrok-free.app/outbound-call \
-H "Content-Type: application/json" \
-d '{
  "prompt": "You are Eric, an outbound car sales agent. You are calling to sell a new car to the customer. Be friendly and professional and answer all questions.",
  "first_message": "Hello Thor, my name is Eric, I heard you were looking for a new car! What model and color are you looking for?",
  "number": "447311252643"
}'
  */

//just need to opress any key to get past test, now need to test with my custome inital mesage and prompt = try and do multiple questiosn in the prompt engineering
//

