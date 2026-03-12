const express = require("express");
const fetch = require("node-fetch");
const {
  CloudAdapter,
  ConfigurationBotFrameworkAuthentication
} = require("botbuilder");

const app = express();

// 1. ADD THIS: Use built-in express middleware if needed, 
// but usually, we let the adapter handle the request directly.
app.use(express.json()); 

const botFrameworkAuthentication = new ConfigurationBotFrameworkAuthentication(process.env);
const adapter = new CloudAdapter(botFrameworkAuthentication);

// ... (error handler and GET route)

app.post("/api/messages", async (req, res) => {
  console.log("POST /api/messages hit");

  // 2. CHANGE THIS: Use the adapter's built-in Express integration
  // This ensures the body is parsed correctly by the Bot SDK
  await adapter.process(req, res, (context) => botLogic(context));
});

// 3. Move your logic into a separate function for clarity
async function botLogic(context) {
    console.log("Activity type:", context.activity.type);
    console.log("Incoming text:", context.activity.text);

    if (context.activity.type !== "message") return;

    // ... (rest of your Scryfall logic)
}
