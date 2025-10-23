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

import {
    APIEmbed,
    ChannelType,
    ChatInputCommandInteraction,
    GuildTextBasedChannel,
    SlashCommandBuilder,
} from "discord.js";
import { Command, RemindMeData } from "../definitions";
import pubsub from "pubsub-js";

const RemindMe: Command = {
    data: new SlashCommandBuilder()
        .setName("remindme")
        .setDescription("Set up a one time ping as a reminder.")
        .addStringOption((option) =>
            option
                .setName("message")
                .setDescription("The message to send")
                .setRequired(true)
        )
        .addNumberOption((option) =>
            option
                .setName("hours")
                .setDescription(
                    "How many hours in the future you want to be reminded. Default: 1"
                )
        )
        .addChannelOption((option) =>
            option
                .setName("channel")
                .setDescription(
                    "The channel to ping in. Default: Current Channel"
                )
                // Ensure the user can only select a TextChannel for output
                .addChannelTypes(ChannelType.GuildText)
        ),
    async execute(interaction: ChatInputCommandInteraction) {
        const userId = interaction.user.id;
        const message = interaction.options.getString("message");
        const hours = interaction.options.getNumber("hours") ?? 1;
        let channelInput = interaction.options.getChannel(
            "channel"
        ) as GuildTextBasedChannel;
        const channel = channelInput ?? interaction.channel;

        // console.log(channelInput.isSendable());
        // interaction.guild.channels
        //     .fetch()
        //     .then((allchannels) => {
        //         allchannels.forEach((channel) => {
        //             console.log(channel.name);
        //             console.log(channel.isSendable());
        //         });
        //     })
        //     .catch(console.error);

        const data: RemindMeData = { userId, message, hours, channel };
        const page: APIEmbed = {
            title: "Reminder Set",
            fields: [
                {
                    name: "User",
                    value: `<@${userId}>`,
                },
                {
                    name: "Message",
                    value: message,
                },
                {
                    name: "Time",
                    value: `${hours} hours`,
                },
                {
                    name: "Channel",
                    value: `#${channel.name}`,
                },
            ],
        };

        // if the channel inputted is not accessible to the bot, send error to the user
        if (channelInput) {
            const me = await interaction.guild.members.fetchMe();
            if (
                channelInput
                    .permissionsFor(me)
                    .has(["0x0000000000000800", "0x0000000000000400"]) // send messages, view channel
            ) {
                pubsub.publish("remindme", data);
                await interaction.reply({
                    embeds: [page],
                });
            } else {
                await interaction.reply({
                    content: "I don't have access to that channel. Sorry :(",
                    ephemeral: true,
                });
                return;
            }
        } else {
            pubsub.publish("remindme", data);
            await interaction.reply({
                embeds: [page],
            });
        }
    },
};
export default RemindMe;
