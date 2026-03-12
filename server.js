const express = require("express");
const { BotFrameworkAdapter } = require("botbuilder");
const fetch = require("node-fetch");

const app = express();

const adapter = new BotFrameworkAdapter({
  appId: process.env.MicrosoftAppId,
  appPassword: process.env.MicrosoftAppPassword
});

adapter.onTurnError = async (context, error) => {
  console.error("Bot error:", error);
  await context.sendActivity("Bot had a meltdown.");
};

app.post("/api/messages", (req, res) => {
  adapter.processActivity(req, res, async (context) => {
    if (context.activity.type !== "message") return;

    const text = context.activity.text || "";
    const match = text.match(/\[\[(.*?)\]\]/);

    if (!match) {
      return;
    }

    const cardName = match[1].trim();
    const url = `https://api.scryfall.com/cards/named?fuzzy=${encodeURIComponent(cardName)}`;

    try {
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
    } catch (err) {
      console.error(err);
      await context.sendActivity("Error looking up that card.");
    }
  });
});

const port = process.env.PORT || 3978;
app.listen(port, () => {
  console.log(`Bot listening on port ${port}`);
});
