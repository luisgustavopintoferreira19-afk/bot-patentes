require("dotenv").config();
const { Client, GatewayIntentBits } = require("discord.js");
const express = require("express");
const app = express();
app.use(express.json());

const BOT_TOKEN = process.env.DISCORD_BOT_TOKEN;
const GUILD_ID  = process.env.DISCORD_GUILD_ID;
const CANAL_ID  = process.env.CANAL_ID;
const PORT      = process.env.PORT || 3000;

const codigosTemp = new Map();

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMembers,
  ],
});

client.once("ready", () => {
  console.log(`Bot online: ${client.user.tag}`);
});

client.on("messageCreate", async (msg) => {
  if (msg.author.bot) return;
  if (msg.guildId !== GUILD_ID) return;
  if (CANAL_ID && msg.channelId !== CANAL_ID) return;
  if (!msg.content.startsWith("!verificar ")) return;

  const codigo = msg.content.split(" ")[1]?.toUpperCase().trim();
  if (!codigo) return msg.reply("❌ Use: `!verificar SEU_CODIGO`");

  const entrada = codigosTemp.get(codigo);
  if (!entrada) return msg.reply("❌ Código inválido ou expirado.");
  if (Date.now() > entrada.expira) {
    codigosTemp.delete(codigo);
    return msg.reply("⏰ Código expirado! Gere um novo no jogo.");
  }

  const guild  = client.guilds.cache.get(GUILD_ID);
  const member = await guild.members.fetch(msg.author.id).catch(() => null);
  if (!member) return msg.reply("❌ Você não está no servidor.");

  codigosTemp.delete(codigo);

  const nomes = member.roles.cache
    .filter(r => r.id !== guild.id)
    .map(r => r.name).join(", ") || "nenhum";

  await msg.reply(`✅ **Verificado!**\nCargos: ${nomes}\nSua patente será atualizada no jogo!`);
});

app.get("/cargos", async (req, res) => {
  const { discord_id, guild_id } = req.query;
  if (!discord_id || !guild_id) return res.status(400).json({ error: "Parâmetros faltando" });

  try {
    const guild  = client.guilds.cache.get(guild_id);
    if (!guild) return res.status(404).json({ error: "Guild não encontrada" });

    const member = await guild.members.fetch(discord_id).catch(() => null);
    if (!member) return res.json({ roles: [] });

    const roles = member.roles.cache
      .filter(r => r.id !== guild.id)
      .map(r => r.id);

    return res.json({ roles });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

app.post("/registrar-codigo", (req, res) => {
  const { roblox_id, codigo } = req.body;
  if (!roblox_id || !codigo) return res.status(400).json({ error: "Parâmetros faltando" });
  codigosTemp.set(codigo.toUpperCase(), { robloxId: roblox_id, expira: Date.now() + 600000 });
  return res.json({ ok: true });
});

app.get("/", (req, res) => res.json({ status: "online", bot: client.user?.tag }));

app.listen(PORT, () => console.log(`Servidor rodando na porta ${PORT}`));
client.login(BOT_TOKEN);
