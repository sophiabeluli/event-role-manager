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

import { REST, Routes } from "discord.js";
import "dotenv/config";
import allCommands from "../commands";

const commands = [];

// Grab the SlashCommandBuilder#toJSON() output of each command's data for deployment
for (const command of allCommands) {
    commands.push(command.data.toJSON());
}

// Construct and prepare an instance of the REST module
const rest = new REST().setToken(process.env.TOKEN);

// and deploy your commands!
(async () => {
    try {
        console.log(
            `Started refreshing ${commands.length} application (/) commands.`
        );

        // The put method is used to fully refresh all commands in every guild
        const data = await rest.put(
            Routes.applicationCommands(process.env.CLIENT_ID),
            {
                body: commands,
            }
        );

        console.log(
            `Successfully reloaded ${data.length} application (/) commands.`
        );
    } catch (error) {
        // And of course, make sure you catch and log any errors!
        console.error(error);
    }
})();
