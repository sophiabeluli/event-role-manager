import { Client, ClientOptions, Collection } from "discord.js";

class CustomClient extends Client {
    commands: Collection<any, any>;
    constructor(intents: ClientOptions) {
        super(intents);
        this.commands = new Collection();
    }
}

export default CustomClient;
