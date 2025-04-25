const fs = require('fs');
const fetch = require('node-fetch');

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

// Call the function
downloadFileFromGoogleDrive(fileId, dest);