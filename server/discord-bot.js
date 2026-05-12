import { Client, GatewayIntentBits, EmbedBuilder } from 'discord.js';

const DISCORD_BOT_TOKEN = process.env.DISCORD_BOT_TOKEN;

// wir erstellen den client mit den minimalen intents, da wir nur DMs senden wollen
const client = new Client({ 
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.DirectMessages
  ] 
});

let isReady = false;

if (DISCORD_BOT_TOKEN) {
  client.login(DISCORD_BOT_TOKEN).catch(err => {
    console.error('❌ Discord Bot Login Fehler:', err);
  });
} else {
  console.log('⚠️ DISCORD_BOT_TOKEN fehlt. Discord Bot nicht aktiv.');
}

client.once('ready', () => {
  console.log(`🤖 Discord Bot eingeloggt als ${client.user.tag}`);
  isReady = true;
});

/**
 * Sendet eine Direktnachricht an einen Discord-User anhand seiner ID
 * @param {string} discordUserId 
 * @param {EmbedBuilder|string} messageContent 
 */
export const sendDM = async (discordUserId, messageContent) => {
  if (!isReady || !DISCORD_BOT_TOKEN) return false;
  if (!discordUserId || discordUserId.startsWith('dev_')) return false; // Keine Dev-User

  try {
    const user = await client.users.fetch(discordUserId);
    if (!user) return false;

    const payload = typeof messageContent === 'string' 
      ? { content: messageContent } 
      : { embeds: [messageContent] };

    await user.send(payload);
    return true;
  } catch (error) {
    console.error(`❌ Konnte DM an ${discordUserId} nicht senden:`, error.message);
    return false;
  }
};

export const createEmbed = () => {
  return new EmbedBuilder()
    .setColor('#6b21a8') // primary color
    .setTimestamp()
    .setFooter({ text: "Larry's Marketplace" });
};

export default {
  sendDM,
  createEmbed,
  isReady: () => isReady
};
