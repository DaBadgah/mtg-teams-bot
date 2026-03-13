const express = require("express");
const fetch = require("node-fetch");
const {
    CloudAdapter,
    ConfigurationBotFrameworkAuthentication,
    TurnContext
} = require("botbuilder");

const app = express();

// Middleware to parse JSON bodies - Essential for the adapter to "see" the activity
app.use(express.json());

const botFrameworkAuthentication = new ConfigurationBotFrameworkAuthentication(process.env);
const adapter = new CloudAdapter(botFrameworkAuthentication);

// Global error handler
adapter.onTurnError = async (context, error) => {
    console.error("onTurnError:", error);
    try {
        await context.sendActivity("The bot encountered an error or timeout.");
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
        // We pass the req and res to the adapter
        await adapter.process(req, res, async (context) => {
            console.log(`Activity received: Type=${context.activity.type}`);

            if (context.activity.type !== "message") return;

            // 1. Clean up the text (removes <at>BotName</at> in Teams channels)
            let text = context.activity.text || "";
            if (context.activity.channelId === 'msteams') {
                text = TurnContext.removeRecipientMention(context.activity);
            }
            text = text.trim();
            console.log("Processed text:", text);

            // 2. Find ALL card matches [[Card Name]]
            const regex = /\[\[(.*?)\]\]/g;
            let match;
            const matches = [];

            while ((match = regex.exec(text)) !== null) {
                matches.push(match[1].trim());
            }

            if (matches.length === 0) {
                console.log("No card pattern found in text.");
                return;
            }

            // 3. Process each found card
            for (const cardName of matches) {
                console.log(`Fetching from Scryfall: ${cardName}`);
                
                try {
                    const url = `https://api.scryfall.com/cards/named?fuzzy=${encodeURIComponent(cardName)}`;
                    const response = await fetch(url, {
                        headers: { 'User-Agent': 'MTGTeamsBot/1.0', 'Accept': '*/*' }
                    });
                    const card = await response.json();

                    if (!response.ok || card.object === "error") {
                        await context.sendActivity(`Couldn't find "${cardName}".`);
                        continue;
                    }

                    // Handle standard and DFC (Double Faced Cards)
                    const imageUrl = card.image_uris?.normal || 
                                   card.card_faces?.[0]?.image_uris?.normal;

                    if (!imageUrl) {
                        await context.sendActivity(`Found "${card.name}", but no image available.`);
                        continue;
                    }

                    // 4. Send the Thumbnail Card
                    await context.sendActivity({
                        attachments: [
                            {
                                contentType: "application/vnd.microsoft.card.thumbnail",
                                content: {
                                    title: card.name,
                                    subtitle: `${card.type_line} | ${card.mana_cost || 'No cost'}`,
                                    images: [{ url: imageUrl }],
                                    buttons: [
                                        {
                                            type: "openUrl",
                                            title: "View on Scryfall",
                                            value: card.scryfall_uri
                                        }
                                    ]
                                }
                            }
                        ]
                    });
                    console.log(`Successfully sent: ${card.name}`);

                } catch (fetchError) {
                    console.error(`Error fetching ${cardName}:`, fetchError);
                }
            }
        });
    } catch (err) {
        console.error("Adapter process error:", err);
        if (!res.headersSent) {
            res.status(500).send("Internal Bot Error");
        }
    }
});

const port = process.env.PORT || 3978;
app.listen(port, () => {
    console.log(`Bot listening on port ${port}`);
    console.log("Ensure your .env file has MicrosoftAppId and MicrosoftAppPassword if testing in Teams.");
});
