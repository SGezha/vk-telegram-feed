const express = require("express"),
  app = express(),
  axios = require("axios"),
  TelegramBot = require('node-telegram-bot-api'),
  bot = new TelegramBot(`[TELEGRAM-token]`, { polling: true }),
  lowdb = require('lowdb'),
  FileSync = require('lowdb/adapters/FileSync'),
  adapter = new FileSync("database.json"),
  db = lowdb(adapter),
  { VK } = require('vk-io'),
  vk = new VK({ token: `[VK-TOKEN]` }),
  listener = app.listen(process.env.PORT, function () { console.log("Your app is listening on port " + listener.address().port); });

bot.on('message', (msg) => {
  let m = msg.text.split(" ");
  if (m[0] == "+") {
    vk.api.call(`groups.getById`, { group_ids: m[1] }).then(res => {
      if (db.get("subs").find({ id: res[0].id }).value() == undefined) {
        db.get("subs").push({ id: res[0].id, title: res[0].name, name: res[0].screen_name }).write();
        bot.sendPhoto(msg.chat.id, res[0].photo_200, {
          caption: `Группа ${res[0].name} добавлена в бд!`
        });
        check();
      } else {
        bot.sendMessage(msg.chat.id, `Группа ${res[0].name} уже есть в бд!`);
      }
    }).catch(er => {
      bot.sendMessage(msg.chat.id, `Ошибка!`);
    })
  }
  if (m[0] == "-") {
    vk.api.call(`groups.getById`, { group_ids: m[1] }).then(res => {
      if (db.get("subs").find({ id: res[0].id }).value() != undefined) {
        db.get("subs").remove({ id: res[0].id }).write();
        bot.sendPhoto(msg.chat.id, res[0].photo_200, {
          caption: `Группа ${res[0].name} убрана из бд!`
        });
      }
    }).catch(er => {
      bot.sendMessage(msg.chat.id, `Ошибка!`);
    })
  }
  if (m[0] == "!subs") {
    let text = "Подписки: \n";
    db.get("subs").value().forEach((s, ind) => {
      text += `${ind + 1}) ${s.title} (${s.id}) \n`;
    })
    bot.sendMessage(msg.chat.id, text);
  }
});

bot.on('callback_query', async function (msg) {
  let d = msg.data.split("|");
  if (d[0] == "like") {
    vk.api.call(`likes.add`, { type: "post", owner_id: d[1], item_id: d[2] }).then(res => {
      refreshPost("💘 Like");
    })
  }
  if (d[0] == "dislike") {
    vk.api.call(`likes.delete`, { type: "post", owner_id: d[1], item_id: d[2] }).then(res => {
      refreshPost("💔 Dislike");
    })
  }
  if(d[0] == "refresh") {
    refreshPost("🔄 Refresh");
  }

  function refreshPost(ale) {
    vk.api.call(`wall.getById`, {posts: `${d[1]}_${d[2]}`}).then(p => {
      p = p[0];
      let g = db.get("subs").find({id: parseInt(d[1].toString().split("-").join("")) }).value();
      bot.editMessageReplyMarkup({
        inline_keyboard: [
          [{ text: p.likes.user_likes == 1 ? `💘 ${p.likes.count}` : `💜 ${p.likes.count}`, callback_data: p.likes.user_likes == 1 ? `dislike|-${g.id}|${p.id}` : `like|-${g.id}|${p.id}` }, { text: `💬 ${p.comments.count}`, url: `https://vk.com/${g.name}?w=wall-${g.id}_${p.id}` }, { text: `🔄`, callback_data: `refresh|-${g.id}|${p.id}` }]
        ]
      }, {chat_id: `@vk4fun`, message_id: msg.message.message_id,}).then(a => {
        bot.answerCallbackQuery(msg.id, ale, false);
      });
    })
  }
})

async function run() {
  check();
  setInterval(() => { check(); }, 60000*10);
}

function check() {
  db.get("subs").value().forEach((p, ind) => {
    setTimeout(() => {
      console.log(`UPDATE ${p.title}`);
      vk.api.call(`wall.get`, { owner_id: `-${p.id}`, count: 10 }).then(res => {
        res.items.forEach(r => {
          if (db.get("data").find({ id: r.id, group: r.owner_id }).value() != undefined) return;
          if (r.attachments) {
            r.attachments.forEach(async i => {
              if (i.type == "photo") {
                let img = i.photo.sizes[i.photo.sizes.length - 1].url;
                bot.sendPhoto(`@vk4fun`, img, {
                  caption: r.text,
                  reply_markup: JSON.stringify({
                    inline_keyboard: [
                      [{ text: r.likes.user_likes == 1 ? `💘 ${r.likes.count}` : `💜 ${r.likes.count}`, callback_data: `like|-${p.id}|${r.id}` }, { text: `💬 ${r.comments.count}`, url: `https://vk.com/${p.name}?w=wall-${p.id}_${r.id}` }, { text: `🔄`, callback_data: `refresh|-${p.id}|${r.id}` }]
                    ]
                  })
                })
              }
              if (i.type == "video") {
                let img = i.video.image[i.video.image.length - 1].url;
                bot.sendPhoto(`@vk4fun`, img, {
                  caption: `▷ ${i.video.title} (${Math.floor(i.video.duration / 60) + ':' + i.video.duration % 60}) \n${r.text}`,
                  reply_markup: JSON.stringify({
                    inline_keyboard: [
                      [{ text: r.likes.user_likes == 1 ? `💘 ${r.likes.count}` : `💜 ${r.likes.count}`, callback_data: `like|-${p.id}|${r.id}` }, { text: `💬 ${r.comments.count}`, url: `https://vk.com/${p.name}?w=wall-${p.id}_${r.id}` }, { text: `🔄`, callback_data: `refresh|-${p.id}|${r.id}` }]
                    ]
                  })
                })
              }
            })
          } else {
            vk.api.call(`utils.getShortLink`, { url: `https://vk.com/${p.name}?w=wall-${p.id}_${r.id}` }).then(link => {
              bot.sendMessage("@vk4fun", r.text, {reply_markup: JSON.stringify({inline_keyboard: [ [{ text: r.likes.user_likes == 1 ? `💘 ${r.likes.count}` : `💜 ${r.likes.count}`, callback_data: `like|-${p.id}|${r.id}` }, { text: `💬 ${r.comments.count}`, url: `https://vk.com/${p.name}?w=wall-${p.id}_${r.id}` }, { text: `🔄`, callback_data: `refresh|-${p.id}|${r.id}` }]]})});
            })
          }
          db.get("data").push({ id: r.id, group: r.owner_id }).write();
        })
      })
    }, 20000 * ind)
  })
}

run().catch(console.log);

app.get("/", function (request, response) { response.send("Работает"); });