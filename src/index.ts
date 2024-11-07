// Require the necessary discord.js classes
import {
    Events,
    GatewayIntentBits,
    GuildScheduledEvent,
    GuildScheduledEventStatus,
    PartialGuildScheduledEvent,
} from "discord.js";
import "dotenv/config";
import CustomClient from "./CustomClient";
import allCommands from "./commands";

const token = process.env.TOKEN;

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

    const command = (
        interaction.client as CustomClient
    ).commands.get(interaction.commandName);
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
                content:
                    "There was an error while executing this command!",
                ephemeral: true,
            });
        } else {
            await interaction.reply({
                content:
                    "There was an error while executing this command!",
                ephemeral: true,
            });
        }
    }
});

// When the client is ready, run this code (only once).
// The distinction between `client: Client<boolean>` and `readyClient: Client<true>` is important for TypeScript developers.
// It makes some properties non-nullable.
client.once(Events.ClientReady, (readyClient) => {
    console.log(
        `Ready! Logged in as ${readyClient.user.tag}`
    );
});

// Log in to Discord with your client's token
client.login(token);

client.on(
    Events.GuildScheduledEventCreate,
    async (
        guildScheduledEvent: GuildScheduledEvent<GuildScheduledEventStatus>
    ): Promise<void> => {
        let subscribers =
            await guildScheduledEvent.fetchSubscribers();
        console.log(subscribers);
        // const interestedUsers = res;
        // console.log(interestedUsers);
    }
);

client.on(
    Events.GuildScheduledEventUpdate,
    async (
        _oldGuildScheduledEvent:
            | GuildScheduledEvent<GuildScheduledEventStatus>
            | PartialGuildScheduledEvent
            | null,
        newGuildScheduledEvent: GuildScheduledEvent<GuildScheduledEventStatus>
    ): Promise<void> => {
        let subscribers =
            await newGuildScheduledEvent.fetchSubscribers();
        console.log(subscribers);
        // const interestedUsers = res;
        // console.log(interestedUsers);
    }
);
