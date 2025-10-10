import OpenAI from 'openai';
import dotenv from 'dotenv';


dotenv.config()

const client = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY, // Securely load API key
});

let example = 'Hello, this is Mark. I’m calling from Luxury Dubai Real Estate. How are you today?'

export default async function getArabicVersion(arabicToTranslate) {

  const response = await client.responses.create({
  model: "gpt-4.1",
  input: [
    { role: "system", content: "translate the english text you are given into standard Arabic" },
    { role: "user", content: arabicToTranslate }
  ]
});

console.log(response.output[0].content[0].text);
let output = response.output[0].content[0].text.trim()
if (typeof output !== "string") {
    console.log("arabicTranslator did not return a string, so I will now convert to a string")
    output = output.toString()
}

return output

}

//getArabicVersion(example)