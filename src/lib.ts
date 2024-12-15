import fs from "node:fs";
import { fileURLToPath } from "url";
import { dirname } from "path";
import {
    ActionRowBuilder,
    APIEmbed,
    ButtonBuilder,
    ComponentType,
    GuildScheduledEvent,
    RepliableInteraction,
} from "discord.js";
import { EventDetails } from ".";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const backId = "back";
const forwardId = "forward";
const backButton = new ButtonBuilder({
    style: 2,
    label: "🡸",
    customId: backId,
});
const forwardButton = new ButtonBuilder({
    style: 2,
    label: "🡺",
    customId: forwardId,
});

// Time

export const convertDateObjectToDateTime = (date: Date) => {
    const day = date.toLocaleString("default", { day: "numeric" });
    const month = date.toLocaleString("default", { month: "long" });
    const year = date.toLocaleString("default", { year: "numeric" });
    const time = date.toLocaleTimeString();

    return month + " " + day + ", " + year + " at " + time;
};

// Previous Events

export const saveFinishedEvent = (event: GuildScheduledEvent) => {
    console.log("saving finished event from " + event.guild.name);
    const guildId = event.guild.id;
    const savedEvents = loadPreviousEvents(guildId);
    if (savedEvents.length === 5) {
        savedEvents.shift();
    }
    try {
        savedEvents.push({
            title: event.name,
            description: event.description,
            scheduledStartAt: event.scheduledStartAt,
            scheduledEndAt: event.scheduledEndAt,
            subscriberNum: event.userCount || 1,
            location: event.entityMetadata?.location,
            imageURL: event.coverImageURL({ extension: "png", size: 4096 }),
        });
    } catch (err) {
        console.error(err);
    }

    writePreviousEvents(guildId, savedEvents);
};

export const loadPreviousEvents = (guildId: string): Array<EventDetails> => {
    const fileName = "secret-" + guildId + ".json";
    const file = __dirname + "/" + fileName;

    // Load Data
    if (!fs.existsSync(file)) {
        console.warn("Event secret file doesnt exist");
        const content = JSON.stringify([]);
        try {
            fs.writeFileSync(file, content, "utf8");
        } catch (err) {
            console.error(err);
        }
    }
    try {
        let previousEvents: Array<EventDetails> = JSON.parse(
            fs.readFileSync(file, "utf8")
        );

        previousEvents.forEach((event, _index) => {
            if (event.scheduledStartAt !== null) {
                event.scheduledStartAt = new Date(event.scheduledStartAt);
            }
            if (event.scheduledEndAt !== null) {
                event.scheduledEndAt = new Date(event.scheduledEndAt);
            }
        });

        return previousEvents;
    } catch (err) {
        console.error(err);
        return [];
    }
};

export const writePreviousEvents = (
    guildId: string,
    savedEvents: Array<EventDetails>
) => {
    const fileName = "secret-" + guildId + ".json";
    const file = __dirname + "/" + fileName;
    try {
        fs.writeFileSync(file, JSON.stringify(savedEvents), "utf8");
    } catch (err) {
        console.error(err);
    }
    console.log(guildId + "event secret file updated");
};

export const listPreviousEvents = async (interaction: RepliableInteraction) => {
    let pageArray: APIEmbed[] = [];
    const events = loadPreviousEvents(interaction.guildId);

    if (events.length === 0) {
        try {
            interaction.editReply({
                content: "There are no logged previous events.",
                components: [],
            });
            return;
        } catch (err) {
            console.error(err);
        }
    }
    events.forEach((event, _index) => {
        let page: APIEmbed = {
            title: event.title,
            // description: event.description,
            // .setThumbnail(event.imageURL)
            fields: [
                {
                    name: "Description",
                    value: event.description,
                },
                {
                    name: "Location",
                    value: event.location?.toString() || "N/A",
                },
                {
                    name: "Number of Subscribers",
                    value: event.subscriberNum?.toString() || "N/A",
                },
                {
                    name: "Scheduled Start Date",
                    value: event.scheduledStartAt
                        ? convertDateObjectToDateTime(event.scheduledStartAt)
                        : "N/A",
                    inline: true,
                },
                {
                    name: "Scheduled End Date",
                    value: event.scheduledEndAt
                        ? convertDateObjectToDateTime(event.scheduledEndAt)
                        : "N/A",
                    inline: true,
                },
            ],
            image: { url: event.imageURL },
        };

        pageArray.push(page);
    });

    try {
        const response = await interaction.editReply({
            embeds: [pageArray[0]],
            components: [
                new ActionRowBuilder<ButtonBuilder>().addComponents([
                    forwardButton,
                ]),
            ],
        });

        try {
            let currentIndex = 0;
            const collector = response.createMessageComponentCollector({
                componentType: ComponentType.Button,
                time: 3_600_000,
            });

            collector.on("collect", async (i) => {
                i.customId === backId ? currentIndex-- : currentIndex++;
                await i
                    .update({
                        embeds: [pageArray[currentIndex]],
                        components: [
                            new ActionRowBuilder<ButtonBuilder>()
                                .addComponents(currentIndex ? [backButton] : [])
                                .addComponents(
                                    currentIndex < pageArray.length - 1
                                        ? [forwardButton]
                                        : []
                                ),
                        ],
                    })
                    .catch((err) => {
                        console.error(err);
                    });
            });
        } catch (e) {
            await interaction.editReply({
                content: "Confirmation not received within 1 hour, cancelling",
                components: [],
            });
        }
    } catch (err) {
        console.error(err);
    }
};
