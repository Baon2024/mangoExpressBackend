import express from 'express'





const PORT = 8082;

const app = express()

app.use(cors());

app.listen(PORT, () => console.log("server is listening on port ${PORT]"));


app.post('/messageEndpoint', async (req, res) => {
    //need to retrieve message here, and pass to LLM
})