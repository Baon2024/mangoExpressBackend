import { pipeline } from '@huggingface/transformers';

 let transcript = `Hello, I'm a Dubai property agent calling because you expressed interest in new build Dubai property. Would you prefer to s
peak in English or Arabic? English, please. Great. What's your name? Joseph. Thank you, Joseph. What is your budget? £135,000. Thank you, Joseph
. Which area of Dubai do you prefer? Central Dubai. Thank you, Joseph. Where do you currently live? London. What is your address in London? Gosw
ell Road. Thank you, Joseph. How old are you? 24. And when are you looking to move? December. Thank you, Joseph. Have a great day.
Transcript received: Hello, I'm a Dubai property agent calling because you expressed interest in new build Dubai property. Would you prefer to s
peak in English or Arabic? English, please. Great. What's your name? Joseph. Thank you, Joseph. What is your budget? £135,000. Thank you, Joseph
. Which area of Dubai do you prefer? Central Dubai. Thank you, Joseph. Where do you currently live? London. What is your address in London? Gosw
ell Road. Thank you, Joseph. How old are you? 24. And when are you looking to move? December. Thank you, Joseph. Have a great day.`




export default async function getWarmth(callTranscript) {

    //make call to pipeline, provide labels it can choose from. 
    
    let context = `you need to decide on the degree of the customers interest in buying dubai property, based on this call transcript, ${callTranscript}`

// Allocate a pipeline for sentiment-analysis
const pipe = await pipeline('zero-shot-classification');
const out = await pipe(context, ["Warm", "Medium", "Cool"]
    );

//const out = await pipe(callTranscript);
console.log("out is ", out)
// [{'label': 'POSITIVE', 'score': 0.999817686}]
const labels = out.labels;  // The model's predicted labels
    const scores = out.scores;  // The model's confidence for each label

    // Log and return the most probable label and its score
    console.log("Labels:", labels);
    console.log("Scores:", scores);

    const highestScoreIndex = scores.indexOf(Math.max(...scores)); 
    console.log("highestScoreIndex is ", highestScoreIndex)
    const highestLabel = labels[highestScoreIndex] // Get the label corresponding to the highest score

    console.log("Predicted Warmth:", highestLabel); // This is the result you need
    return highestLabel

}

//getWarmth(transcript)