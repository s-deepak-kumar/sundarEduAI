const express = require("express");
const config = require("../config");
const getAbsolutePath = require('../utils')
const examples = require('../constants')
const path = require("path");
const axios = require("axios");
const fs = require("fs");
var multer = require('multer');
const download = require('download');

const router = express.Router();

var storage = multer.diskStorage({
    destination: function(req, file, callback) {
        callback(null, './assets/uploads');
    },
    filename: function(req, file, callback) {
        uniqueFileName = Date.now() + '-' + Math.round(Math.random() * 1E9);
        type = file.originalname.split('.').pop();
        callback(null, uniqueFileName + "." + type);
    }
});

var upload = multer({ storage: storage }).single('file');

var uniqueFileName = "";
var type = "";

// Method for saving file into folder ('/assets/uploads/')
router.post("/upload", async(req, res) => {
    await upload(req, res, async function(err) {
        // check for error
        if (err || req.file === undefined) {
            console.log(err)
            res.send("Error occured!")
        } else {
            res.send({ status: 200, message: "File Uploaded!", type: type, id: uniqueFileName })
        }
    });
});

// Method for upoloading file to AssemblyAI
router.post("/upload_file", async(req, res) => {
    const assembly = axios.create({
        baseURL: "https://api.assemblyai.com/v2",
        headers: {
            authorization: config.assemblyAIConfig.apiKey,
            "content-type": "application/json",
            "transfer-encoding": "chunked",
        },
    });
    const file = getAbsolutePath() + "/assets/uploads/" + req.body.id + "." + req.body.type;
    fs.readFile(file, (err, data) => {
        if (err) return console.error(err);

        assembly
            .post("/upload", data)
            .then(async(resp) => {
                res.send({ status: 200, message: "File Uploaded!", upload_url: resp.data.upload_url })
            })
            .catch((err) => console.error(err));
    });
});

// Method for summarizing, Sentiment Analysing using Co:here
router.post("/transcript", async(req, res) => {

    const assembly = axios.create({
        baseURL: "https://api.assemblyai.com/v2",
        headers: {
            authorization: config.assemblyAIConfig.apiKey,
            "content-type": "application/json",
            "transfer-encoding": "chunked",
        },
    });

    const response = await assembly.post("/transcript", {
        audio_url: req.body.upload_url.toString()
    })

    // Interval for checking transcript completion
    const checkCompletionInterval = setInterval(async() => {
        const transcript = await assembly.get(`/transcript/${response.data.id}`)
        const transcriptStatus = transcript.data.status

        if (transcriptStatus !== "completed") {
            console.log(`Transcript Status: ${transcriptStatus}`)
        } else if (transcriptStatus === "completed") {
            let transcriptText = transcript.data.text
            clearInterval(checkCompletionInterval)

            res.send({
                status: 200,
                transcript: transcriptText
            })
        }
    }, 2000)
});

// GET method for homepage
router.get("/", (req, res) => {
    res.setHeader('Content-Type', 'text/html');
    res.render(getAbsolutePath() + '/views/index.html', { user: "Hello" });
});

//GET method for speech to text page
router.get("/search-questions", (req, res) => {
    res.render(getAbsolutePath() + '/views/search-questions.html');
});

// GET method for showing progress & results of answers & questions page
router.get("/answer-question/:file_name/:file_ext", (req, res) => {
    res.render(getAbsolutePath() + '/views/answer-question.html', { file_name: req.params.file_name, file_ext: req.params.file_ext });
});

// Exporting Routes
module.exports = {
    routes: router
};