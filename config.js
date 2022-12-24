const dotenv = require("dotenv");
const assert = require("assert");

dotenv.config();

// Getting .env constants value
const {
    PORT,
    HOST,
    HOST_URL,
    ASSEMBLYAI_API_KEY
} = process.env;

// adding init assertions
assert(PORT, "Application port is required");
assert(HOST_URL, "Service endpoint is required");
assert(ASSEMBLYAI_API_KEY, "AssemblyAI API key is required");

// Exporting constants
module.exports = {
    port: PORT,
    host: HOST,
    url: HOST_URL,
    assemblyAIConfig: {
        apiKey: ASSEMBLYAI_API_KEY
    }
};