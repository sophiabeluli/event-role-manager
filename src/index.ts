/*
 * Copyright (C) 2024  Sophia Beluli
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Affero General Public License as published
 * by the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU Affero General Public License for more details.
 *
 * You should have received a copy of the GNU Affero General Public License
 * along with this program.  If not, see <https://www.gnu.org/licenses/>.
 *
 * Contact details for information regarding this program and its license
 * can be found on sophiabeluli.ca
 */

// Require the necessary discord.js classes
import {
    Collection,
    Events,
    GatewayIntentBits,
    GuildMember,
    GuildScheduledEvent,
    GuildScheduledEventStatus,
    PartialGuildScheduledEvent,
    RepliableInteraction,
    User,
} from "discord.js";
import "dotenv/config";
import CustomClient from "./CustomClient";
import allCommands from "./commands";
import fs from "node:fs";
import { fileURLToPath } from "url";
import { dirname } from "path";
import pubsub from "pubsub-js";
import { listPreviousEvents, saveFinishedEvent } from "./lib";

export interface eventsRolesInfo {
    // for lookup
    role: string;
    guild: string;

    // for future slash commands
    name: string;
    description: string;
    scheduledStartAt: Date;
}

export interface EventDetails {
    title: string;
    description: string;
    scheduledStartAt: Date;
    scheduledEndAt: Date;
    subscriberNum: number;
    location: string;
    imageURL: string;
}

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const fileName = "saved.json";
const file = __dirname + "/" + fileName;
const token = process.env.TOKEN;
let eventsRoles = new Map<string, eventsRolesInfo>();
let isReady = true; // flag to determine

const saveFile = () => {
    fs.writeFileSync(
        file,
        JSON.stringify(Object.fromEntries(eventsRoles)),
        "utf8"
    );
    console.log("file updated");
};

const updateEventsRoles = async () => {
    let allEvents: string[] = [];
    isReady = false;
    console.log("start initial routine");
    // checks events in registered guilds and sees if they are in the saved file
    // adds them to the file if not
    await addMissedEvents(allEvents)
        // checks events in file and sees if they exist in any guild
        // deletes them from file if not
        .then((allEvents) => {
            deleteMissedEvents(allEvents).then(() => {
                saveFile();
                console.log("end initial routine");
                isReady = true;
            });
        });
};

const addMissedEvents = async (allEvents: string[]): Promise<string[]> => {
    const guilds = await client.guilds.fetch();
    for (const guildInfo of guilds) {
        try {
            const guild = await guildInfo[1].fetch();
            const allMembers = await guild.members.fetch();
            const events = await guild.scheduledEvents.fetch();
            for (const [id, event] of events) {
                let role: string;
                if (!eventsRoles.get(id)) {
                    // make role if it doesn't exist
                    console.log("role doesnt exist; creating");
                    role = await onCreateEvent(event);
                } else {
                    console.log("role exists");
                    role = eventsRoles.get(id).role;
                }

                if (!role) {
                    // exit if role null
                    console.log("role null; exiting");
                    return;
                }

                try {
                    const subscribers = await event.fetchSubscribers();
                    let unsubscribedMembers = new Collection<
                        string,
                        GuildMember
                    >(allMembers);
                    // add role to subscribers
                    for (const [id, user] of subscribers) {
                        unsubscribedMembers.delete(id);
                        // add roles only to those who have don't have them and should
                        const member = guild.members.cache.find(
                            (member) => member.user.id === id
                        );
                        if (!member.roles.resolve(role)) {
                            try {
                                let res = await guild.members.addRole({
                                    role: role,
                                    user: id,
                                });
                                if (res) {
                                    console.log(
                                        `added missing role (${role}) to ${user.user.username}`
                                    );
                                }
                            } catch (err) {
                                console.error(err);
                            }
                        }
                    }
                    // remove role for unsubscribers
                    for (const [id, member] of unsubscribedMembers) {
                        // remove roles only from those who have them and shouldn't
                        if (member.roles.resolve(role)) {
                            try {
                                let res = await guild.members.removeRole({
                                    role: role,
                                    user: id,
                                });
                                if (res) {
                                    console.log(
                                        `removed incorrect role (${role}) from ${member.user.username}`
                                    );
                                }
                            } catch (err) {
                                console.error(err);
                            }
                        }
                    }
                    allEvents.push(id);
                } catch (err) {
                    console.error(err);
                }
            }
        } catch (err) {
            console.error(err);
        }
    }
    return allEvents;
};

const deleteMissedEvents = async (
    allEvents: string[]
): Promise<Map<string, eventsRolesInfo>> => {
    for (const eventInfo of eventsRoles) {
        if (!allEvents.includes(eventInfo[0])) {
            try {
                const targetGuild = await client.guilds.fetch(
                    eventInfo[1].guild
                );
                try {
                    await targetGuild.roles.delete(eventInfo[1].role);
                    console.log("incorrect role deleted: " + eventInfo[1].role);
                    eventsRoles.delete(eventInfo[0]);
                } catch (err) {
                    console.error(err);
                }
            } catch (err) {
                console.error(err);
            }
        }
    }
    return eventsRoles;
};

const onCreateEvent = async (
    guildScheduledEvent: GuildScheduledEvent<GuildScheduledEventStatus>
): Promise<string> => {
    return guildScheduledEvent.guild.roles
        .create({
            name: guildScheduledEvent.name,
            mentionable: true,
            reason: "for event",
        })
        .then((role) => {
            console.log("role created: " + role.name);
            eventsRoles.set(guildScheduledEvent.id, {
                role: role.id,
                guild: guildScheduledEvent.guild.id,
                name: guildScheduledEvent.name,
                description: guildScheduledEvent.description,
                scheduledStartAt: guildScheduledEvent.scheduledStartAt,
            });
            // add role to creator
            guildScheduledEvent.guild.members
                .addRole({
                    role: role,
                    user: guildScheduledEvent.creatorId,
                })
                .then(() =>
                    console.log(
                        "added role to creator: " +
                            guildScheduledEvent.creatorId
                    )
                )
                .catch(console.error);
            saveFile();
            return role.id;
        })
        .catch((err): Promise<string> => {
            console.error(err);
            return null;
        });
};

// Pubsub

const subscribe = () => {
    pubsub.subscribe(
        "pastevents",
        (_msg, interaction: RepliableInteraction) => {
            listPreviousEvents(interaction);
        }
    );
};

// Create a new client instance
const client = new CustomClient({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildScheduledEvents,
    ],
});

for (const command of allCommands) {
    // Set a new item in the Collection with the key as the command name and the value as the exported module
    client.commands.set(command.data.name, command);
}

// When the client is ready, run this code (only once).
// The distinction between `client: Client<boolean>` and `readyClient: Client<true>` is important for TypeScript developers.
// It makes some properties non-nullable.
client.once(Events.ClientReady, (readyClient) => {
    console.log(`Ready! Logged in as ${readyClient.user.tag}`);

    subscribe();

    // Load Data
    if (!fs.existsSync(file)) {
        console.warn("File doesnt exist");
        const content = JSON.stringify({});
        fs.writeFileSync(file, content, "utf8");
    }
    let eventRolesString = JSON.parse(fs.readFileSync(file, "utf8"));
    eventsRoles = new Map(Object.entries(eventRolesString));

    updateEventsRoles();
});

client.on(Events.InteractionCreate, async (interaction) => {
    if (!interaction.isChatInputCommand()) {
        return;
    }

    const command = (interaction.client as CustomClient).commands.get(
        interaction.commandName
    );
    if (!command) {
        console.error(
            `No command matching ${interaction.commandName} was found.`
        );
        return;
    }

    try {
        await command.execute(interaction);
    } catch (err) {
        console.error(err);
        if (interaction.replied || interaction.deferred) {
            await interaction.followUp({
                content: "There was an error while executing this command!",
                ephemeral: true,
            });
        } else {
            await interaction.reply({
                content: "There was an error while executing this command!",
                ephemeral: true,
            });
        }
    }
});

client.on(
    Events.GuildScheduledEventCreate,
    async (
        guildScheduledEvent: GuildScheduledEvent<GuildScheduledEventStatus>
    ): Promise<void> => {
        let count = 0;
        const createEvent = () => {
            if (isReady) {
                console.log("event created");
                onCreateEvent(guildScheduledEvent);
            } else if (count !== 6) {
                count++;
                setTimeout(createEvent, 5000);
            }
        };
        createEvent();
    }
);

client.on(
    Events.GuildScheduledEventDelete,
    async (
        guildScheduledEvent:
            | GuildScheduledEvent<GuildScheduledEventStatus>
            | PartialGuildScheduledEvent
    ): Promise<void> => {
        let count = 0;
        const deleteEvent = () => {
            console.log(isReady);
            if (isReady) {
                console.log("event deleted");
                if (eventsRoles.get(guildScheduledEvent.id)) {
                    guildScheduledEvent.guild.roles
                        .delete(eventsRoles.get(guildScheduledEvent.id).role)
                        .then(() => {
                            console.log(
                                "role deleted: " +
                                    eventsRoles.get(guildScheduledEvent.id).role
                            );
                            eventsRoles.delete(guildScheduledEvent.id);
                            saveFile();
                        })
                        .catch(console.error);
                }
            } else if (count !== 6) {
                count++;
                setTimeout(deleteEvent, 5000);
            }
        };
        deleteEvent();
    }
);

client.on(
    Events.GuildScheduledEventUpdate,
    async (
        _oldGuildScheduledEvent:
            | GuildScheduledEvent<GuildScheduledEventStatus>
            | PartialGuildScheduledEvent,
        newGuildScheduledEvent: GuildScheduledEvent
    ): Promise<void> => {
        let count = 0;
        const updateEvent = () => {
            if (isReady) {
                if (
                    (newGuildScheduledEvent.status === 3 ||
                        newGuildScheduledEvent.status === 4) &&
                    eventsRoles.get(newGuildScheduledEvent.id)
                ) {
                    console.log("event canceled");
                    // complete or canceled
                    newGuildScheduledEvent.guild.roles
                        .delete(eventsRoles.get(newGuildScheduledEvent.id).role)
                        .then(() => {
                            console.log(
                                "role deleted: " +
                                    eventsRoles.get(newGuildScheduledEvent.id)
                                        .role
                            );
                            eventsRoles.delete(newGuildScheduledEvent.id);
                            saveFile();
                        })
                        .catch(console.error);
                }
            } else if (count !== 6) {
                count++;
                setTimeout(updateEvent, 5000);
            }
        };
        updateEvent();

        if (newGuildScheduledEvent.status === 3) {
            saveFinishedEvent(newGuildScheduledEvent);
        }
    }
);

client.on(
    Events.GuildScheduledEventUserAdd,
    (
        guildScheduledEvent:
            | GuildScheduledEvent<GuildScheduledEventStatus>
            | PartialGuildScheduledEvent,
        user: User
    ): void => {
        let count = 0;
        const userAdd = () => {
            if (isReady) {
                if (eventsRoles.get(guildScheduledEvent.id)) {
                    guildScheduledEvent.guild.members
                        .addRole({
                            role: eventsRoles.get(guildScheduledEvent.id).role,
                            user: user,
                        })
                        .then(() =>
                            console.log(
                                "user subscribed: " +
                                    user.username +
                                    " - " +
                                    guildScheduledEvent.id
                            )
                        )
                        .catch(console.error);
                }
            } else if (count !== 6) {
                count++;
                setTimeout(userAdd, 5000);
            }
        };
        userAdd();
    }
);

client.on(
    Events.GuildScheduledEventUserRemove,
    (
        guildScheduledEvent:
            | GuildScheduledEvent<GuildScheduledEventStatus>
            | PartialGuildScheduledEvent,
        user: User
    ): void => {
        let count = 0;
        const userRemove = () => {
            if (isReady) {
                if (eventsRoles.get(guildScheduledEvent.id)) {
                    guildScheduledEvent.guild.members
                        .removeRole({
                            role: eventsRoles.get(guildScheduledEvent.id).role,
                            user: user,
                        })
                        .then(() =>
                            console.log(
                                "user unsubscribed: " +
                                    user.username +
                                    " - " +
                                    guildScheduledEvent.id
                            )
                        )
                        .catch(console.error);
                }
            } else if (count !== 6) {
                count++;
                setTimeout(userRemove, 5000);
            }
        };
        userRemove();
    }
);

// Log in to Discord with your client's token
client.login(token);
