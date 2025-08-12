import { pipeline } from '@huggingface/transformers';
import dotenv from 'dotenv';
import OpenAI from 'openai';

dotenv.config()

const client = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY, // Securely load API key
});

 let transcript = `Hello, I'm a Dubai property agent calling because you expressed interest in new build Dubai property. Would you prefer to s
peak in English or Arabic? English, please. Great. What's your name? Joseph. Thank you, Joseph. What is your budget? £135,000. Thank you, Joseph
. Which area of Dubai do you prefer? Central Dubai. Thank you, Joseph. Where do you currently live? London. What is your address in London? Gosw
ell Road. Thank you, Joseph. How old are you? 24. And when are you looking to move? December. Thank you, Joseph. Have a great day.
Transcript received: Hello, I'm a Dubai property agent calling because you expressed interest in new build Dubai property. Would you prefer to s
peak in English or Arabic? English, please. Great. What's your name? Joseph. Thank you, Joseph. What is your budget? £135,000. Thank you, Joseph
. Which area of Dubai do you prefer? Central Dubai. Thank you, Joseph. Where do you currently live? London. What is your address in London? Gosw
ell Road. Thank you, Joseph. How old are you? 24. And when are you looking to move? December. Thank you, Joseph. Have a great day.`

/*let zscPromise = null;
function getZSC() {
  if (!zscPromise) {
    zscPromise = pipeline(
      "zero-shot-classification",
      "Xenova/distilbert-base-uncased-mnli",
      { quantized: true }
    );
  }
  return zscPromise;
}*/


export default async function getWarmth(callTranscript) {
    const context = `You need to decide on the degree of the customer's interest in buying Dubai property, based on this call transcript: ${callTranscript}. 
Return only one of the following labels: Warm, Medium, Cool.`;

    const isProduction = process.env.NODE_ENV === "production";
    console.log("env is ", isProduction)

    if (isProduction) {
        // OpenAI client
        const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

        const response = await client.chat.completions.create({
            model: "gpt-4o-mini",
            messages: [
                { role: "system", content: "You are a classifier that returns only one label: Warm, Medium, or Cool." },
                { role: "user", content: context }
            ],
            temperature: 0
        });

        // Extract model's output and clean it
        const output = response.choices[0]?.message?.content?.trim();
        console.log("Predicted Warmth (prod):", output);
        return output;
    } else {
        // Dev mode → zero-shot classification pipeline
        const pipe = await pipeline('zero-shot-classification');
        const out = await pipe(context, ["Warm", "Medium", "Cool"]);

        console.log("out is ", out);
        const labels = out.labels;
        const scores = out.scores;

        console.log("Labels:", labels);
        console.log("Scores:", scores);

        const highestScoreIndex = scores.indexOf(Math.max(...scores));
        const highestLabel = labels[highestScoreIndex];

        console.log("Predicted Warmth (dev):", highestLabel);
        return highestLabel;
    }
}

getWarmth(transcript)