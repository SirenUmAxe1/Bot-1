const { Client, IntentsBitField } = require('discord.js');
const fs = require('fs');
const path = require('path');

// Load configuration
const configPath = path.join(__dirname, 'config.json');
if (!fs.existsSync(configPath)) {
    console.error('Config file not found!');
    process.exit(1);
}
const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));

const client = new Client({
    intents: [
        IntentsBitField.Flags.Guilds,
        IntentsBitField.Flags.GuildMessages,
        IntentsBitField.Flags.MessageContent,
    ]
});

const roleCachePath = './roleCache.json';

// Load or initialize role cache
let roleCache = {};
if (fs.existsSync(roleCachePath)) {
    roleCache = JSON.parse(fs.readFileSync(roleCachePath, 'utf8'));
}

function saveRoleCache() {
    fs.writeFileSync(roleCachePath, JSON.stringify(roleCache, null, 2));
}

client.once('ready', () => {
    console.log('Bot is online!');
});

// Helper function to parse arguments, allowing quotes for role names
function parseArguments(message) {
    const regex = /"([^"]+)"|(\S+)/g;
    const args = [];
    let match;
    while ((match = regex.exec(message)) !== null) {
        args.push(match[1] || match[2]);
    }
    return args;
}

// Function to send pretty help message
function sendPrettyHelpMessage(channel) {
    const helpMessage = `
# Help!
*Mrow! Here’s all the commands I can help you with:*
## Pretty Commands
\`meow!pretty "role name" <hexcode or "default"> <number>\` - Create or update the original role with a name and color. Add a number for additional roles.
\`meow!delete\` - Undo the last role creation or edit.
## Utilities
\`meow!obliterate\` - Delete every single message and thread in the current channel (admin only).
\`meow!junk <number>\` - Delete a number of messages after confirmation (admin only).
    `;
    channel.send(helpMessage);
}

// Function to send general help message
function sendHelpMessage(channel) {
    const helpMessage = `
**Mrow! Here’s all the commands I can help you with:**
\`meow!help pretty\` - Displays the guide for pretty commands.
\`meow!pretty "role name" <hexcode or "default">\` - Create or update the original role with a name and color.
\`meow!pretty "role name" <hexcode> <role#>\` - Create or update an additional role with the given number.
\`meow!pretty delete\` - Delete the last created or updated role.
\`meow!obliterate\` - Delete all messages and threads in the channel (restricted).
\`meow!disintigrate <number>\` - Delete a number of messages (restricted).
    `;
    channel.send(helpMessage);
}

client.on('messageCreate', async message => {
    if (message.author.bot) return; // Ignore bot messages

    const args = parseArguments(message.content.slice(4).trim()); // Adjusted for prefix length

    // Handle help command
    if (message.content.startsWith('meow!help')) {
        if (args[0] && args[0].toLowerCase() === 'pretty') {
            return sendPrettyHelpMessage(message.channel);
        }
        return sendHelpMessage(message.channel);
    }

    const isAuthorized = message.author.id === '556682219171741706';

    // Handle obliterate command (restricted)
    if (message.content.startsWith('meow!obliterate')) {
        if (!isAuthorized) return;
        const fetchedMessages = await message.channel.messages.fetch({ limit: 100 });
        fetchedMessages.forEach(msg => msg.delete());
        message.channel.bulkDelete(100, true).then(() => {
            message.channel.send('Grr, yeeted all messages and threads in this channel! 😾');
        });
        return;
    }

    // Handle disintigrate command (restricted)
    if (message.content.startsWith('meow!disintigrate')) {
        if (!isAuthorized) {
            console.log(`Unauthorized user: ${message.author.id}`);
            return message.channel.send('Grr, you’re not allowed to use this command!');
        }

        const numToDelete = parseInt(args[0], 10);
        console.log(`Parsed number: ${numToDelete}`);

        if (isNaN(numToDelete) || numToDelete <= 0) {
            console.log('Invalid or missing number for deletion.');
            return message.channel.send('Mrow, how many messages do you want to delete? Specify a number, silly!');
        }

        message.channel.bulkDelete(numToDelete, true)
            .then(deletedMessages => {
                console.log(`Deleted ${deletedMessages.size} messages successfully.`);
                message.channel.send(`Mrow, yeeted ${deletedMessages.size} messages into oblivion!`);
            })
            .catch(error => {
                console.error('Error during bulk delete:', error);
                message.channel.send('Grr, there was an error trying to delete messages!');
            });
        return;
    }

    // Handle delete command to delete the last created/updated role or by specific role number
    if (message.content.startsWith('meow!pretty delete')) {
        const userRoles = roleCache[message.author.id];
        if (!userRoles) {
            return message.channel.send('Mrow, you don’t have any roles to delete!');
        }

        const roleNumber = args[1] ? parseInt(args[1]) : Object.keys(userRoles).length; // Get the role number to delete or default to the last one
        const lastRoleId = userRoles[roleNumber]; // Get the specified or last role created
        if (!lastRoleId) {
            return message.channel.send('Mrow, no role to delete!');
        }

        try {
            const roleToDelete = await message.guild.roles.fetch(lastRoleId);
            if (!roleToDelete) return message.channel.send('Grr, couldn’t find the role to delete!');

            await roleToDelete.delete();
            delete userRoles[roleNumber]; // Remove role from cache
            roleCache[message.author.id] = userRoles;
            saveRoleCache();
            message.channel.send(`Meow, the role has been deleted! Meow, meow!`);
        } catch (error) {
            console.error('Error deleting role:', error);
            message.channel.send('Grr, there was an error deleting the role!');
        }
        return;
    }

    // Handle pretty command (role creation/update)
    if (!message.content.startsWith('meow!pretty')) return;

    // Ensure there's at least a role name and color
    if (args.length < 3) {
        return message.channel.send('Please provide a role name in quotes and hex color code or "default".');
    }

    const roleName = args[1];
    const colorHex = args[2].toLowerCase() === 'default' ? null : args[2];
    const roleNumber = args[3]; // Optional role number for additional roles

    // Validate hex code if it's not "default"
    if (colorHex && !/^#[0-9A-Fa-f]{6}$/.test(colorHex)) {
        return message.channel.send('Invalid hex color code. Please use a format like #RRGGBB, or use "default" for no color.');
    }

    try {
        const userRoles = roleCache[message.author.id] || {};
        let roleID;

        // Use the original role if no role number is provided
        if (roleNumber) {
            roleID = userRoles[roleNumber];
        } else {
            roleID = userRoles[1]; // Default to role #1
        }

        let role;

        // Find the "🅥🅐🅝🅘🅣🅨 🅡🅞🅛🅔🅢" role in the server
        const vanityRole = message.guild.roles.cache.find(r => r.name === '🅥🅐🅝🅘🅣🅨 🅡🅞🅛🅔🅢');

        if (!vanityRole) {
            return message.channel.send('Could not find the "🅥🅐🅝🅘🅣🅨 🅡🅞🅛🅔🅢" role.');
        }

        if (roleID) {
            role = await message.guild.roles.fetch(roleID).catch(() => null);
        }

        if (role) {
            // Update existing role name and color
            await role.setName(roleName);
            if (colorHex) {
                await role.setColor(colorHex);
            } else {
                await role.setColor(null); // Set to default color if "default" was used
            }
        } else {
            // Create new role if no existing role was found
            role = await message.guild.roles.create({
                name: roleName,
                color: colorHex || null, // Null color for "default"
                reason: `Role created by meow!pretty command`,
            });
        }

        // Move the role directly under the "🅥🅐🅝🅘🅣🅨 🅡🅞🅛🅔🅢" role
        await role.setPosition(vanityRole.position - 1);

        // Update or add role to cache
        if (roleNumber) {
            userRoles[roleNumber] = role.id;
        } else {
            userRoles[1] = role.id;
        }

        roleCache[message.author.id] = userRoles;
        saveRoleCache();

        message.channel.send(`Meow, your role has been created/updated! Meow, meow!`);
    } catch (error) {
        console.error('Error creating/updating role:', error);
        message.channel.send('Grr, there was an error creating or updating the role!');
    }
});

client.login(config.token);