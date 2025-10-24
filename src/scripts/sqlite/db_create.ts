import sqlite3 from "sqlite3";
import { execute } from "./sqlite_lib";

const createDB = async () => {
    const db = new sqlite3.Database("soapbot.db");
    try {
        await execute(
            db,
            "CREATE TABLE IF NOT EXISTS events (" +
                "id TEXT PRIMARY KEY, " +
                "guild_id TEXT NOT NULL, " +
                "role_id TEXT, " +
                "name TEXT, " +
                "description TEXT, " +
                "scheduled_start_at TEXT, " +
                "scheduled_end_at TEXT, " +
                "subscriber_num INTEGER, " +
                "location TEXT, " +
                "image_url TEXT" +
                ")"
        );
    } catch (error) {
        console.log(error);
    } finally {
        console.log("Table created successfully!");
        db.close();
    }
};

createDB();
