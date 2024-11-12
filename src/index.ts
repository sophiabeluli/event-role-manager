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
    User,
} from "discord.js";
import "dotenv/config";
import CustomClient from "./CustomClient";
import allCommands from "./commands";
import fs from "node:fs";
import { fileURLToPath } from "url";
import { dirname } from "path";

export interface eventsRolesInfo {
    // for lookup
    role: string;
    guild: string;

    // for future slash commands
    name: string;
    description: string;
    scheduledStartAt: Date;
}

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const fileName = "saved.json";
const file = __dirname + "/" + fileName;
const token = process.env.TOKEN;
let eventsRoles = new Map<string, eventsRolesInfo>();

const saveFile = () => {
    console.log(JSON.stringify(Object.fromEntries(eventsRoles)));
    fs.writeFileSync(
        file,
        JSON.stringify(Object.fromEntries(eventsRoles)),
        "utf8"
    );
    console.log("file updated");
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

// When the client is ready, run this code (only once).
// The distinction between `client: Client<boolean>` and `readyClient: Client<true>` is important for TypeScript developers.
// It makes some properties non-nullable.
client.once(Events.ClientReady, (readyClient) => {
    console.log(`Ready! Logged in as ${readyClient.user.tag}`);

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

const updateEventsRoles = async () => {
    let allEvents: string[] = [];
    // checks events in registered guilds and sees if they are in the saved file
    // adds them to the file if not
    await addMissedEvents(allEvents)
        // checks events in file and sees if they exist in any guild
        // deletes them from file if not
        .then((allEvents) => {
            deleteMissedEvents(allEvents);
        })
        .then(() => saveFile());
};

const addMissedEvents = async (allEvents: string[]): Promise<string[]> => {
    const guilds = await client.guilds.fetch();
    for (const guildInfo of guilds) {
        const guild = await guildInfo[1].fetch();
        const allMembers = await guild.members.fetch();
        const events = await guild.scheduledEvents.fetch();
        for (const [id, event] of events) {
            if (!eventsRoles.get(id)) {
                onCreateEvent(event);
            } else {
                const role = eventsRoles.get(id).role;
                const subscribers = await event.fetchSubscribers();
                let unsubscribedMembers = new Collection<string, GuildMember>(
                    allMembers
                );
                for (const [id, _user] of subscribers) {
                    unsubscribedMembers.delete(id);
                    guild.members
                        .addRole({
                            role: role,
                            user: id,
                        })
                        .then(() => {
                            console.log("added missing role to " + id);
                        });
                }
                for (const [id, member] of unsubscribedMembers) {
                    if (member.roles.resolve(role)) {
                        guild.members
                            .removeRole({
                                role: role,
                                user: id,
                            })
                            .then(() => {
                                console.log(
                                    "removed incorrect role from " + id
                                );
                            });
                    }
                }
            }
            allEvents.push(id);
        }
    }
    return allEvents;
};

const deleteMissedEvents = async (allEvents: string[]): Promise<string[]> => {
    for (const eventInfo of eventsRoles) {
        if (!allEvents.includes(eventInfo[0])) {
            const targetGuild = await client.guilds.fetch(eventInfo[1].guild);
            targetGuild.roles.delete(eventInfo[1].role).then(() => {
                console.log("role deleted: " + eventInfo[1].role);
                eventsRoles.delete(eventInfo[0]);
            });
        }
    }
    return allEvents;
};

const onCreateEvent = (
    guildScheduledEvent: GuildScheduledEvent<GuildScheduledEventStatus>
) => {
    guildScheduledEvent.guild.roles
        .create({
            name: guildScheduledEvent.name,
            mentionable: true,
            reason: "for event",
        })
        .then((role) => {
            console.log("role created: " + role.id);
            eventsRoles.set(guildScheduledEvent.id, {
                role: role.id,
                guild: guildScheduledEvent.guild.id,
                name: guildScheduledEvent.name,
                description: guildScheduledEvent.description,
                scheduledStartAt: guildScheduledEvent.scheduledStartAt,
            });
            // add role to creator
            guildScheduledEvent.guild.members.addRole({
                role: role,
                user: guildScheduledEvent.creatorId,
            });
            console.log(
                "added role to creator: " + guildScheduledEvent.creatorId
            );
            saveFile();
        })
        .catch(console.error);
};

// Log in to Discord with your client's token
client.login(token);

client.on(
    Events.GuildScheduledEventCreate,
    async (
        guildScheduledEvent: GuildScheduledEvent<GuildScheduledEventStatus>
    ): Promise<void> => {
        console.log("event created");
        onCreateEvent(guildScheduledEvent);
    }
);

client.on(
    Events.GuildScheduledEventDelete,
    async (
        guildScheduledEvent:
            | GuildScheduledEvent<GuildScheduledEventStatus>
            | PartialGuildScheduledEvent
    ): Promise<void> => {
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
                });
        }
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
        if (
            (newGuildScheduledEvent.status === 3 ||
                newGuildScheduledEvent.status === 4) &&
            eventsRoles.get(newGuildScheduledEvent.id)
        ) {
            console.log("event deleted");
            // complete or canceled
            newGuildScheduledEvent.guild.roles
                .delete(eventsRoles.get(newGuildScheduledEvent.id).role)
                .then(() => {
                    console.log(
                        "role deleted: " +
                            eventsRoles.get(newGuildScheduledEvent.id).role
                    );
                    eventsRoles.delete(newGuildScheduledEvent.id);
                    saveFile();
                });
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
        if (eventsRoles.get(guildScheduledEvent.id)) {
            guildScheduledEvent.guild.members.addRole({
                role: eventsRoles.get(guildScheduledEvent.id).role,
                user: user,
            });
            console.log(
                "user subscribed: " + user + " - " + guildScheduledEvent.id
            );
        }
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
        if (eventsRoles.get(guildScheduledEvent.id)) {
            guildScheduledEvent.guild.members.removeRole({
                role: eventsRoles.get(guildScheduledEvent.id).role,
                user: user,
            });
            console.log(
                "user unsubscribed: " + user + " - " + guildScheduledEvent.id
            );
        }
    }
);
