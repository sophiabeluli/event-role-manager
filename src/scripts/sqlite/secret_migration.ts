import sqlite3 from "sqlite3";
import fs from "node:fs";
import "dotenv/config";
import { EventDetails } from "../..";
import { runWithParams } from "./sqlite_lib";
import { fileURLToPath } from "url";
import { dirname } from "path";

const fileNames = [
    process.env.SECRET_1 + ".json",
    process.env.SECRET_2 + ".json",
    process.env.SECRET_3 + ".json",
    process.env.SECRET_4 + ".json",
    process.env.SECRET_5 + ".json",
    process.env.SECRET_6 + ".json",
    process.env.SECRET_7 + ".json",
];

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const readFile = (file: string) => {
    // Load Data
    if (!fs.existsSync(file)) {
        console.warn("Event secret file doesnt exist: " + file);
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

        return previousEvents;
    } catch (err) {
        console.error(err);
        return [];
    }
};

const migrateSecrets = async () => {
    const db = new sqlite3.Database("soapbot.db");
    let counter = 0;
    console.log(fileNames);

    for (const guild in fileNames) {
        const file = __dirname + "/" + fileNames[guild];
        const previousEvents = readFile(file);

        for (const event of previousEvents) {
            const {
                title,
                description,
                scheduledStartAt,
                scheduledEndAt,
                subscriberNum,
                location,
                imageURL,
            } = event;
            try {
                await runWithParams(
                    db,
                    "INSERT INTO events (id, guild_id, name, description, scheduled_start_at, scheduled_end_at, subscriber_num, location, image_url) " +
                        `VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                    [
                        "OLD_" + counter,
                        fileNames[guild],
                        title,
                        description,
                        scheduledStartAt,
                        scheduledEndAt,
                        subscriberNum,
                        location,
                        imageURL,
                    ]
                );
                counter++;
            } catch (error) {
                console.log(error);
            }
        }
    }

    console.log("Secret files imported to db.");
    db.close();
};

migrateSecrets();
