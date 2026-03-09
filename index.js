// ============================================================
//  BOT DISCORD — Sistema de Patentes por Username Roblox
//  Comando: !verificar NomeRoblox
//  O bot busca os cargos do autor no Discord e envia pro jogo
// ============================================================
//  npm install discord.js express axios dotenv
// ============================================================

require("dotenv").config();
const { Client, GatewayIntentBits } = require("discord.js");
const express = require("express");
const axios   = require("axios");
const app     = express();
app.use(express.json());

const BOT_TOKEN = process.env.DISCORD_BOT_TOKEN;
const GUILD_ID  = process.env.DISCORD_GUILD_ID;
const CANAL_ID  = process.env.CANAL_ID;
const PORT      = process.env.PORT || 3000;

// Mapa: roblox_id → { roles, discord_name, roblox_name, timestamp }
const patentesPendentes = new Map();

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMembers,
  ],
});

client.once("ready", () => {
  console.log(`✅ Bot online como ${client.user.tag}`);
});

// Busca o ID Roblox pelo username
async function getRobloxId(username) {
  try {
    const res = await axios.post(
      "https://users.roblox.com/v1/usernames/users",
      { usernames: [username], excludeBannedUsers: false }
    );
    const user = res.data?.data?.[0];
    return user ? { id: user.id, name: user.name } : null;
  } catch {
    return null;
  }
}

// !verificar NomeRoblox
client.on("messageCreate", async (msg) => {
  if (msg.author.bot) return;
  if (msg.guildId !== GUILD_ID) return;
  if (CANAL_ID && msg.channelId !== CANAL_ID) return;
  if (!msg.content.startsWith("!verificar ")) return;

  const usernameRoblox = msg.content.split(" ")[1]?.trim();
  if (!usernameRoblox) {
    return msg.reply("❌ Use: `!verificar NomeNoRoblox`");
  }

  const guild  = client.guilds.cache.get(GUILD_ID);
  const member = await guild.members.fetch(msg.author.id).catch(() => null);
  if (!member) {
    return msg.reply("❌ Não foi possível encontrar você no servidor Discord.");
  }

  await msg.react("⏳").catch(() => {});

  const robloxUser = await getRobloxId(usernameRoblox);
  if (!robloxUser) {
    return msg.reply(`❌ Usuário Roblox \`${usernameRoblox}\` não encontrado!`);
  }

  const roles = member.roles.cache
    .filter(r => r.id !== guild.id)
    .map(r => r.id);

  const nomeCargos = member.roles.cache
    .filter(r => r.id !== guild.id)
    .map(r => r.name)
    .join(", ") || "nenhum";

  patentesPendentes.set(robloxUser.id.toString(), {
    roblox_id:    robloxUser.id,
    roblox_name:  robloxUser.name,
    discord_name: msg.author.username,
    roles:        roles,
    timestamp:    Date.now(),
  });

  console.log(`✅ ${msg.author.username} → Roblox: ${robloxUser.name} (${robloxUser.id}) | Cargos: ${roles.join(", ")}`);

  await msg.reply(
    `✅ **Patente aplicada!**\n` +
    `👤 Roblox: \`${robloxUser.name}\`\n` +
    `🏅 Cargos: ${nomeCargos}\n` +
    `⚡ A patente atualiza quando o jogador entrar no jogo!`
  );
});

// GET /patente?roblox_id=123&guild_id=456
app.get("/patente", async (req, res) => {
  const { roblox_id, guild_id } = req.query;
  if (!roblox_id || !guild_id) {
    return res.status(400).json({ error: "Parâmetros faltando" });
  }
  const pendente = patentesPendentes.get(roblox_id.toString());
  if (pendente) {
    console.log(`📋 Entregando patente para ${roblox_id}: ${pendente.roles.join(", ")}`);
    return res.json({ roles: pendente.roles, found: true });
  }
  return res.json({ roles: [], found: false });
});

// POST /confirmar — Roblox chama após aplicar a patente
app.post("/confirmar", (req, res) => {
  const { roblox_id } = req.body;
  if (roblox_id) patentesPendentes.delete(roblox_id.toString());
  return res.json({ ok: true });
});

app.get("/", (req, res) => {
  res.json({ status: "online", bot: client.user?.tag, pendentes: patentesPendentes.size });
});

app.listen(PORT, () => console.log(`🌐 Servidor rodando na porta ${PORT}`));
client.login(BOT_TOKEN);
