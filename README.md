# mangoExpressBackend


// This is the backend server for the working version of Mango, a automatic data gathering spreadsheet via AI voice phonecalls,
//built in the March 2025 Sequel x Inaugural Ai hackathon

//atm, this is very much a work in progress - the core functionality of being able to automate data gathering via phone calls is working
//the server implementation is quite workmanlike - the answers from each call are retrieved in a seperate, second API call after a waiting period
//which is the least worse way i could implement it so far - some problem with the fastify server is preventing me from delaying the reply.send()
//and sending back the answers from the call in the original server response