# mangoExpressBackend


This is the backend server for the working version of Yatakalam.

the current server is the file inauguralSimplifiedDynamicAgentSelection, inside of the folder conversational-ai-twilio. 

# Prerequisites 

currently, in order to try it out, you need to create a .env file in the conversational-ai-twilio folder add your own twilio, elevenlabs and openai keys. In following format:

ELEVENLABS_AGENT_ID=xxxxxxxxxxxxxx - get from the dashboard of the elevenlabs agent you create
ELEVENLABS_API_KEY=xxxxxxxxxxxxxxx - get from ElevenLabs account
TWILIO_PHONE_NUMBER=44xxxxxxx - need to buy a twilio phone number, then add in the correct UK format after 44
TWILIO_ACCOUNT_SID=xxxxxxxxxxx - get from Twilio account
TWILIO_AUTH_TOKEN=xxxxxxxxxxxxxxx - get from Twilio account
OPENAI_API_KEY=xxxxxxxxxxxxxxx - get from openai account


# Starting server

cd into conversational-ai-twilio, then run: node outbound2.js
this will start the server, and create the ngrok test url, which needs to be updated in the main frontend folder in order to send requests in the local development environment.
