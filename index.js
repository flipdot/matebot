const path = require("path");
const Telegraf = require("telegraf");
const { Extra } = require("telegraf");
const flatCache = require("flat-cache");

const config = require("./config");

const users = flatCache.load("users", path.resolve("./data"));

function info(message, meta = {}) {
  log("info", message, meta);
}

function error(message, meta = {}) {
  log("error", message, meta);
}

function debug(message, meta = {}) {
  log("debug", message, meta);
}

function log(level, message, meta = {}) {
  console.log(
    JSON.stringify(
      { ...meta, time: new Date().toISOString(), level, message },
      null,
      null
    )
  );
}

const usageText =
  "/drink [username] - Drink a bottle\n/stats [username] - Show user's stats or all\n/log username - Show log of user";

const bot = new Telegraf(config.token);
bot.start(ctx => ctx.reply(usageText));
bot.help(ctx => ctx.reply(usageText));

bot.command("drink", ctx => {
  const params = ctx.message.text.split(" ");

  const username = params[1] || ctx.from.username;
  if (!username) {
    ctx.reply(`😵 Internal Error: Username missing.`);
    error("Username missing", { ctx });
    return;
  }

  ctx.reply(
    `❓ What did ${username} drink?`,
    Extra.markup(markup => {
      return markup.inlineKeyboard([
        markup.callbackButton("🥤 Mate", `drink mate ${username}`),
        markup.callbackButton("🍹 Tschunk", `drink tschunk ${username}`)
      ]);
    })
  );
});

bot.action(/drink (.+) (.+)/, ctx => {
  const drink = ctx.match[1];
  const username = ctx.match[2];

  if (ctx.callbackQuery.from.id !== ctx.from.id) {
    ctx.reply(`You can only reply to your own /drink.`);
    return;
  }

  const by = ctx.from.username;
  if (!by) {
    ctx.reply(`😵 Internal Error: Logging user missing.`);
    error("Logging user missing", { ctx });
    return;
  }

  const user = users.getKey(username) || {};

  // legacy
  if (user.count == null) {
    user.count = 0;
  }

  if (user.counts == null) {
    if (user.count > 0) {
      // handle legacy
      user.counts = {
        // fill mate with legacy count, since this was the only option before
        mate: user.count
      };
    } else {
      user.counts = {};
    }
  }

  if (user.log == null) {
    user.log = [];
  }

  user.log.push({
    time: new Date().toISOString(),
    by,
    drink
  });

  info("Bottle drunk", {
    by,
    username,
    time: new Date().toISOString(),
    drink
  });

  if (user.counts[drink] == null) {
    user.counts[drink] = 0;
  }

  user.counts[drink] += 1;

  users.setKey(username, user);
  users.save(true);

  if (by === username) {
    ctx.reply(`🍺 ${username} drank a ${drink}. Total: ${userStats(user)}`);
  } else {
    ctx.reply(
      `🍺 ${by} says ${username} drank a ${drink}. Total: ${userStats(user)}`
    );
  }
});

bot.command("stats", ctx => {
  const params = ctx.message.text.split(" ");

  const username = params[1];
  if (username) {
    const user = users.getKey(username);

    if (user) {
      ctx.reply(`📈 ${username} drank: ${userStats(user)}`);
    } else {
      ctx.reply(`😕 User not found: ${username}`);
      debug("User not found.", { username, ctx });
    }
  } else {
    const allUsers = users.all();
    const reply = Object.keys(allUsers).map(key => {
      const user = allUsers[key];
      return `${key}: ${userStats(user)}`;
    });

    ctx.reply(`📈 STATS\n${reply.join("\n")}`);
  }
});

function userStats(user) {
  // handle legacy stuff
  const counts = user.counts || { mate: user.count };

  return Object.keys(counts)
    .map(key => {
      const value = counts[key];
      return `${value} ${key}`;
    })
    .join(", ");
}

bot.command("log", ctx => {
  const params = ctx.message.text.split(" ");

  const username = params[1] || ctx.from.username;

  if (!username) {
    ctx.reply(`😵 Internal Error: Username missing.`);
    error("Username missing", { ctx });
    return;
  }

  const user = users.getKey(username);

  if (user) {
    const logText = user.log
      .map(log => `${log.drink || "mate"} - ${log.time} by ${log.by}`)
      .join("\n");
    ctx.reply(`📋 LOG OF ${username.toUpperCase()}\n${logText}`);
  } else {
    ctx.reply(`😕 User not found: ${username}`);
    debug("User not found.", { username, ctx });
  }
});

bot.launch();
