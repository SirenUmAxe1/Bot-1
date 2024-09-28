const { Client, IntentsBitField } = require('discord.js');
const config = require('./config.json');

const client = new Client({
    intents: [
        IntentsBitField.Flags.Guilds,
        IntentsBitField.Flags.GuildMessages,
        IntentsBitField.Flags.MessageContent
    ]
});

// Accessing the guild ID from config
const guildId = config.guildId;

client.once('ready', () => {
    console.log(`Logged in as ${client.user.tag} in guild: ${guildId}`);
});

client.login(config.token);
    