const path = require('path');
const Telegraf = require('telegraf');
const flatCache = require('flat-cache')

const config = require('./config');

const users = flatCache.load('users', path.resolve('./data'));

function info(message, meta = {}) {
  log('info', message, meta);
}

function error(message, meta = {}) {
  log('error', message, meta);
}

function debug(message, meta = {}) {
  log('debug', message, meta);
}

function log(level, message, meta = {}) {
  console.log(JSON.stringify({ ...meta, time: new Date().toISOString(), level, message}, null, null));
}

const usageText = '/drink [username] - Drink a bottle\n/stats [username] - Show user\'s stats or all\n/log username - Show log of user';

const bot = new Telegraf(config.token)
bot.start((ctx) => ctx.reply(usageText));
bot.help((ctx) => ctx.reply(usageText))

bot.command('drink', (ctx) => {
  const params = ctx.message.text.split(" ");

  const username = params[1] || ctx.from.username;
  if(!username) {
    ctx.reply(`😵 Internal Error: Username missing.`);
    error('Username missing', { ctx });
    return;
  }

  const by = ctx.from.username;
  if (!by) {
    ctx.reply(`😵 Internal Error: Logging user missing.`);
    error('Logging user missing', { ctx });
    return;
  }

  const user = users.getKey(username) || {};

  if (user.count == null) {
    user.count = 0;
  }

  if (user.log == null) {
    user.log = [];
  }

  user.log.push({
    time: new Date().toISOString(),
    by,
  });

  info('Bottle drunk', {
    by,
    username,
    time: new Date().toISOString(),
  });

  user.count += 1;

  users.setKey(username, user);
  users.save(true);

  ctx.reply(`🍺 ${username} drank a bottle. Total: ${user.count}`);
});

bot.command('stats', (ctx) => {
  const params = ctx.message.text.split(" ");

  const username = params[1];
  if(username) {
    const user = users.getKey(username);

    if (user) {
      ctx.reply(`📈 ${username} drank ${user.count} bottles in total.`);
    } else {
      ctx.reply(`😕 User not found: ${username}`);
      debug('User not found.', { username, ctx });
    }
  } else {
    const allUsers = users.all();
    const reply = Object.keys(allUsers).map(key => {
      const user = allUsers[key];
      return `${key} drank ${user.count} bottles.`;
    });

    ctx.reply(`📈 STATS\n${reply.join('\n')}`);
  }
});

bot.command('log', (ctx) => {
  const params = ctx.message.text.split(" ");

  const username = params[1] || ctx.from.username;

  if(!username) {
    ctx.reply(`😵 Internal Error: Username missing.`);
    error('Username missing', { ctx });
    return;
  }

  const user = users.getKey(username);

  if (user) {
    const logText = user.log.map(log => `${log.time} by ${log.by}`).join('\n');
    ctx.reply(`📋 LOG OF ${username.toUpperCase()}\n${logText}`);
  } else {
    ctx.reply(`😕 User not found: ${username}`);
    debug('User not found.', { username, ctx });
  }
});

bot.launch()
