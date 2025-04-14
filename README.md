# mangoExpressBackend


// This is the backend server for the working version of Mango, a automatic data gathering spreadsheet via AI voice phonecalls,
//built in the March 2025 Sequel x Inaugural Ai hackathon

//atm, this is very much a work in progress - the core functionality of being able to automate data gathering via phone calls is working
//the server implementation is quite workmanlike - the answers from each call are retrieved in a seperate, second API call after a waiting period
//which is the least worse way i could implement it so far - some problem with the fastify server is preventing me from delaying the reply.send()
//and sending back the answers from the call in the original server response

//currently, in order to try it out, you need to create a .env file in the conversational-ai-twilio folder add your own twilio, elevenlabs, google cloud and openai keys. In following format:

ELEVENLABS_AGENT_ID=xxxxxxxxxxxxxx - get from the dashboard of the elevenlabs agent you create
ELEVENLABS_API_KEY=xxxxxxxxxxxxxxx - get from ElevenLabs account
# Twilio
TWILIO_PHONE_NUMBER=44xxxxxxx - need to buy a twilio phone number, then add in the correct UK format after 44
TWILIO_ACCOUNT_SID=xxxxxxxxxxx - get from Twilio account
TWILIO_AUTH_TOKEN=xxxxxxxxxxxxxxx - get from Twilio account
OPENAI_API_KEY=xxxxxxxxxxxxxxx - get from openai account
GOOGLE_APPLICATION_CREDENTIALS="local-system-path-to-file" - download plan from google cloud, and add the local system path to the download here

# Starting server

cd into conversational-ai-twilio, then run: node outbound2.js
this will start the server, and create the ngrok test url, which needs to be updated in the two api post urls in the frontend folder