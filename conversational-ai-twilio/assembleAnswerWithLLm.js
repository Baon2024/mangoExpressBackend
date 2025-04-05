import OpenAI from 'openai';
import dotenv from 'dotenv';
dotenv.config();

 //const parsedResponse = await assembleAnswerWithLLm(messages);

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

const correctResponse = response.choices[0].message;
console.log("correctResponse is:", correctResponse.content);
const parsedResponse = JSON.parse(correctResponse.content);

console.log("parsedResponse is:", parsedResponse);

return parsedResponse;

}



