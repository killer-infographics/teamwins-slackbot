var Botkit = require('botkit'),
  BeepBoop = require('beepboop-botkit'),
  fs = require('fs'),
  schedule = require('node-schedule'),
  request = require('request');

var winsObj = require('./wins.json'); // json object of wins

var controller = Botkit.slackbot({
  debug: false
});
var beepboop = BeepBoop.start(controller, {
  debug: true
});

// give the bot something to listen for
controller.on('direct_message,direct_mention,mention', function(bot, message) {
  var messageTxt = message.text;
  // if lucy dm's "show me wins", send her a printout of all wins
  if (messageTxt.indexOf('show me wins') >= 0) {
    if (message.user === 'U0G8TL9LJ' /* lucy */ || message.user === 'U0G6LRZ0F' /* robert */ ) {
      console.log('I showed the wins!');
      bot.reply(message, 'Ok!\n' + compileMsg(winsObj));
    } else {
      bot.reply(message, 'Sorry, but you are not authorized to use that command.')
    }
  } else {
    console.log('Someone sent me a win, but i have not saved it yet');
    saveWin(bot, message);
  }
});

// every friday at 2pm, send message to everybody room with all client wins. erase wins.
var j = schedule.scheduleJob('1 1 14 * * 5', function() {
  console.log('I \'m sending the wins to general!')
  bot.sendWebhook({
    text: 'Here are the wins from this week:\n' + compileMsg(winsObj),
    channel: '#general'
  }, function(err, res) {
    if (err) {
      throw new Error('Could not connect to webhook');
    }
  });
  console.log('Here are the wins from this week:\n' + compileMsg(winsObj));
  // erase json file
  winsObj = [];
  fs.writeFile('wins.json', JSON.stringify(winsObj), function(err) {
    if (err) {
      throw new Error(err);
    }
  });
  console.log('Erased wins');
});

function saveWin(bot, message) {
  // send request to get username (whyyyyyy?!)
  request('https://slack.com/api/users.info?token=' + process.env.SLACK_API_TOKEN + '&user=' + message.user, function(error, response, body) {
    if (!error && response.statusCode == 200) {
      var str = body;
      var userObj = JSON.parse(str);
      var hours, minutes;
      var ts = Math.floor(message.ts);
      var d = new Date(ts * 1000);

      if (d.getHours() > 12) {
        hours = d.getHours() - 12;
      } else {
        hours = d.getHours() - 12;
      }

      if (d.getMinutes() < 9) {
        minutes = '0' + d.getMinutes();
      } else {
        minutes = d.getMinutes();
      }

      var timestamp = d.getMonth() + 1 + '-' + d.getDate() + '-' + d.getFullYear() + ' @ ' + d.getHours() + ':' + d.getMinutes();


      // store message in json array
      winsObj.push({
        // "timestamp" : d,
        "timestamp": timestamp,
        "from": userObj.user.name,
        "text": message.text
      });
      console.log(userObj.user.name + ' @ ' + timestamp + ': ' + message.text);
      console.log('I saved the win!');

      // write new json file
      fs.writeFile('wins.json', JSON.stringify(winsObj), function(err) {
        if (err) {
          throw new Error(err);
        }
      });
    }
  });

  // optional reply
  bot.reply(message, "Thanks for submitting your team win!");
}

function compileMsg(winsObj) {
  var finalMessage = '';
  for (var i = 0; i < winsObj.length; i++) {
    finalMessage += '*From:* ' + winsObj[i].from + '\n' + '*Date:* ' + winsObj[i].timestamp + '\n' + winsObj[i].text + '\n------------\n';
  }
  return finalMessage;
}
