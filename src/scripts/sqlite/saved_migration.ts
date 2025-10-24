import sqlite3 from "sqlite3";
import fs from "node:fs";
import { eventsRolesInfo } from "../..";
import { runWithParams } from "./sqlite_lib";
import { fileURLToPath } from "url";
import { dirname } from "path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const fileName = "saved.json";
const file = __dirname + "/" + fileName;

const readFile = () => {
    // Load Data
    if (!fs.existsSync(file)) {
        console.warn("File doesnt exist");
        const content = JSON.stringify({});
        fs.writeFileSync(file, content, "utf8");
    }
    let eventRolesString = JSON.parse(fs.readFileSync(file, "utf8"));
    let eventsRoles = new Map<string, eventsRolesInfo>(
        Object.entries(eventRolesString)
    );

    return eventsRoles;
};

const migrateSaved = async () => {
    const db = new sqlite3.Database("soapbot.db");
    const eventsRoles = readFile();

    for (const eventRole of eventsRoles) {
        const eventId = eventRole[0];
        const { role, guild, name, description, scheduledStartAt } =
            eventRole[1];
        try {
            await runWithParams(
                db,
                "INSERT INTO events (id, guild_id, role_id, name, description, scheduled_start_at) " +
                    `VALUES (?, ?, ?, ?, ?, ?)`,
                [eventId, guild, role, name, description, scheduledStartAt]
            );
        } catch (error) {
            console.log(error);
        }
    }

    console.log("Saved file imported to db.");
    db.close();
};

migrateSaved();
