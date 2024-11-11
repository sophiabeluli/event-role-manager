import { RepliableInteraction, SlashCommandBuilder } from "discord.js";
import { Command } from "../../definitions";

const ShipMe: Command = {
    data: new SlashCommandBuilder().setName("shipme").setDescription("owo"),
    async execute(interaction: RepliableInteraction) {
        // interaction.user is the object representing the User who ran the command
        // interaction.member is the GuildMember object, which represents the user in the specific guild
        let members = await interaction.guild.members.fetch();
        members.delete(interaction.client.user.id); // delete the bot
        members.delete(interaction.user.id); // delete the user using the command
        const bottom = members.at(Math.floor(Math.random() * members.size));
        await interaction.reply(
            `I ship ${interaction.user.username} with ${bottom.user.username}!`
        );
    },
};
export default ShipMe;
