import OpenAI from 'openai';
import dotenv from 'dotenv';


dotenv.config()

const client = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY, // Securely load API key
});

let example = 'Hello, this is Mark. I’m calling from Luxury Dubai Real Estate. How are you today?'

export async function getArabicVersion(arabicToTranslate) {

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

const questionsEnglish = [
  "What’s your name?",
  "What is your budget?",
  "When are you planning to move?",
  "Have you invested in Dubai real estate before, or would this be your first time?",
  "To guide you better, do you have a specific budget range in mind for your next investment?",
  "Are you more interested in apartments, villas, or townhouses?",
  "Are there any particular features you prefer — such as a larger layout, a private garden, or smart home options?",
  "Which amenities matter most to you — things like a gym, pool, or nearby schools?",
  "Is there a particular community or area you’d prefer to be close to?",
  "Do you also have a set budget in mind for off-plan projects?",
  "Are there any specific projects or developers you’ve already heard about?",
  "Just so I understand, if off-plan projects don’t fit your budget, would you also consider ready properties?",
  "If we found the right project for you, when would you ideally like to invest?",
  "Have you invested in Dubai before, or are you currently working with other agents?",
  "Are you familiar with payment plans, or would you like one of our advisors to explain them to you?",
  "And finally, would you also like support with investment guidance — for example, help with obtaining a residency visa along with your property purchase?",
  "Thank you — this gives me a clear picture of what you’re looking for. One of our investment advisors will call you soon to share tailored opportunities and answer any additional questions. What would be the best time for them to reach you?"
];


export async function getArabicVersionQuestionsArray(input) {

   if (!Array.isArray(input)) throw new Error("Expected an array of strings");
  const items = input.map(x => (x == null ? "" : String(x)));

  

  // 1) Batched request: ask for JSON array only
  const system = [
    "You are a precise translator.",
    "Translate each item of the provided JSON array into natural, clear Arabic.",
    "Preserve order and return ONLY a JSON array of strings of the same length.",
    "Do not add numbering, notes, or extra text."
  ].join(" ");

  const user = `INPUT JSON ARRAY:\n${JSON.stringify(items, null, 2)}`;

  try {
    const resp = await client.responses.create({
      model: "gpt-4.1",
      input: [
        { role: "system", content: system },
        { role: "user", content: user }
      ]
    });

    // Prefer the convenience field if present
    const text = (resp.output_text ?? resp.output?.[0]?.content?.[0]?.text ?? "").trim();

    // Extract a JSON array (be liberal if the model adds whitespace)
    const start = text.indexOf("[");
    const end = text.lastIndexOf("]");
    if (start === -1 || end === -1 || end <= start) throw new Error("No JSON array found in response");
    const out = JSON.parse(text.slice(start, end + 1));

    if (!Array.isArray(out) || out.length !== items.length) {
      throw new Error("Output array length mismatch");
    }

    // Ensure strings and preserve non-Arabic originals if the model changed them
    console.log("returned arabic questions array is, ", out)
    return out.map((s, i) => String(s ?? items[i]));
    

  } catch (e) {
    console.log("error from trying to translate arabic array of questions is, ", e)
}
}

//let result = await getArabicVersionQuestionsArray(questionsEnglish)
//console.log("result is, ", result)

//getArabicVersion(example)