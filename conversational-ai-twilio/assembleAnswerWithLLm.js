import OpenAI from 'openai';
import dotenv from 'dotenv';
dotenv.config();

 //const parsedResponse = await assembleAnswerWithLLm(messages);

 //lets try and add in llama or deepseeck, via HF inference
 import { HfInference } from "@huggingface/inference";
 //const hf = new HfInference('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');
 const hf = new HfInference(process.env.HUGGINGFACE);

 /* 
 // Chat completion API
const out = await inference.chatCompletion({
  model: "meta-llama/Llama-3.1-8B-Instruct",
  messages: [{ role: "user", content: "Hello, nice to meet you!" }], //replace with messages
  max_tokens: 512
});
console.log(out.choices[0].message);
 */

 const client = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY, // Securely load API key
});
        
export async function assembleAnswerWithLLm(messages) {

    console.log("messages inside of assembelAnswerWithLLM is:", messages);

 const response = await client.chat.completions.create({
    model: "gpt-4o-mini",
    store: false,
    messages: messages,
});
console.log("full response is:", response);
console.log("response is:", response.choices[0].message);

/*const out = await hf.chatCompletion({
    model: "HuggingFaceH4/zephyr-7b-alpha", //this is a free huggingFace model
    messages: messages, //replace with messages
    max_tokens: 512
  });
  console.log(out.choices[0].message);*/

const correctResponse = response.choices[0].message /*out.choices[0].message*/;
console.log("correctResponse is:", correctResponse.content);
const parsedResponse = JSON.parse(correctResponse.content);

console.log("parsedResponse is:", parsedResponse);

return parsedResponse;

}



