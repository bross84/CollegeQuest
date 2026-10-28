const { loadConfig } = require('./config');
const { createApp } = require('./app');

const cfg = loadConfig();
const { app } = createApp(cfg);
const ai = Object.entries(cfg.ai.providers).filter(([, p]) => p.key).map(([n]) => n);

app.listen(cfg.port, () => {
  console.log(`CollegeQuest listening on :${cfg.port} (data: ${cfg.dataDir})`);
  console.log(ai.length ? `AI providers: ${cfg.ai.order.filter((n) => ai.includes(n)).join(' -> ')}` : 'AI: no API keys set. Practice works; checking, explaining and the tutor do not.');
  if (!cfg.password) console.warn('WARNING: APP_PASSWORD is not set, so anyone who can reach this server can use it (and spend your AI quota).');
});
