const express = require("express");
const fetch = require("node-fetch");
const {
  CloudAdapter,
  ConfigurationBotFrameworkAuthentication
} = require("botbuilder");

const app = express();

const botFrameworkAuthentication =
  new ConfigurationBotFrameworkAuthentication(process.env);

const adapter = new CloudAdapter(botFrameworkAuthentication);

adapter.onTurnError = async (context, error) => {
  console.error("onTurnError:", error);
  try {
    await context.sendActivity("Bot error.");
  } catch (e) {
    console.error("Failed sending error activity:", e);
  }
};

app.get("/", (req, res) => {
  res.send("MTG Teams bot is running.");
});

app.post("/api/messages", async (req, res) => {
  console.log("POST /api/messages hit");

  try {
    await adapter.process(req, res, async (context) => {
      console.log("Activity type:", context.activity.type);
      console.log("Incoming text:", context.activity.text);

      if (context.activity.type !== "message") return;

      const text = context.activity.text || "";
      const match = text.match(/\[\[(.*?)\]\]/);

      if (!match) {
        console.log("No [[card]] pattern found");
        return;
      }

      const cardName = match[1].trim();
      console.log("Card requested:", cardName);

      const url = `https://api.scryfall.com/cards/named?fuzzy=${encodeURIComponent(cardName)}`;
      const response = await fetch(url);
      const card = await response.json();

      if (!response.ok || card.object === "error") {
        await context.sendActivity(`Couldn't find "${cardName}".`);
        return;
      }

      const imageUrl =
        card.image_uris?.normal ||
        card.card_faces?.[0]?.image_uris?.normal;

      if (!imageUrl) {
        await context.sendActivity(`Found "${card.name}", but no image was available.`);
        return;
      }

      await context.sendActivity({
        attachments: [
          {
            contentType: "application/vnd.microsoft.card.thumbnail",
            content: {
              images: [{ url: imageUrl }]
            }
          }
        ]
      });

      console.log("Reply sent");
    });
  } catch (err) {
    console.error("process error:", err);
    if (!res.headersSent) {
      res.status(500).send("Bot error");
    }
  }
});

const port = process.env.PORT || 3978;
app.listen(port, () => {
  console.log(`Bot listening on port ${port}`);
});
