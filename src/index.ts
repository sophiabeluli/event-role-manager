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
    Events,
    GatewayIntentBits,
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

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const fileName = "saved.json";
const file = __dirname + "/" + fileName;
const token = process.env.TOKEN;
let eventsRoles = new Map<string, string>();

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
        console.log("file doesnt exist");
        const content = JSON.stringify({});
        fs.writeFileSync(file, content, "utf8");
    }
    let eventRolesString = JSON.parse(fs.readFileSync(file, "utf8"));
    eventsRoles = new Map(Object.entries(eventRolesString));

    // update roles TODO: so much work
    // readyClient.guilds.fetch().then((guilds) => {
    //     guilds.forEach(async (guild) => {
    //         const guildObj = await guild.fetch();
    //         const events = await guildObj.scheduledEvents.fetch();
    //         events.forEach(async (event) => {
    //             event.fetchSubscribers().then((subscribers) => {
    //                 subscribers.forEach((subscriber) => {

    //                 })
    //             });
    //         })
    //     })
    // })
});

// Log in to Discord with your client's token
client.login(token);

client.on(
    Events.GuildScheduledEventCreate,
    async (
        guildScheduledEvent: GuildScheduledEvent<GuildScheduledEventStatus>
    ): Promise<void> => {
        console.log("event created");
        guildScheduledEvent.guild.roles
            .create({
                name: guildScheduledEvent.name,
                mentionable: true,
                reason: "for event",
            })
            .then((role) => {
                console.log("role created: " + role.id);
                eventsRoles.set(guildScheduledEvent.id, role.id);
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
                .delete(eventsRoles.get(guildScheduledEvent.id) || "")
                .then(() => {
                    console.log(
                        "role deleted: " +
                            eventsRoles.get(guildScheduledEvent.id)
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
                .delete(eventsRoles.get(newGuildScheduledEvent.id) || "")
                .then(() => {
                    console.log(
                        "role deleted: " +
                            eventsRoles.get(newGuildScheduledEvent.id)
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
                role: eventsRoles.get(guildScheduledEvent.id),
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
                role: eventsRoles.get(guildScheduledEvent.id),
                user: user,
            });
            console.log(
                "user unsubscribed: " + user + " - " + guildScheduledEvent.id
            );
        }
    }
);
