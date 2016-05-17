var Botkit = require('botkit'),
  BeepBoop = require('beepboop-botkit'),
  schedule = require('node-schedule'),
  request = require('request');

// var winsObj = require('./wins.json'); // json object of wins

var controller = Botkit
  .slackbot({
    debug: false,
    json_file_store: ''
  });
var beepboop = BeepBoop.start(controller, {
  debug: true
});

// Get token when team adds bot
var accessToken, teamID;
beepboop.on('add_resource', function(message) {
  console.log('Team added: ', message)

  accessToken = message.resource.SlackBotAccessToken;
  teamID = message.resource.SlackTeamID;
});

// give the bot something to listen for
controller.on('direct_message,direct_mention,mention', function(bot, message) {
  var messageTxt = message.text;

  // if lucy dm's "show me wins", send her a printout of all wins
  if (messageTxt.indexOf('show me wins') >= 0) {
    if (message.user === 'U0G8TL9LJ' /* lucy */ || message.user === 'U0G6LRZ0F' /* robert */ ) {
      console.log('I showed the wins!');

      bot.reply(message, 'Ok!\n' + compileMsg());
    } else {
      bot.reply(message, 'Sorry, but you are not authorized to use that command.')
    }
  } else {
    console.log('Someone sent me a win, but i have not saved it yet');

    saveWin(bot, message);
  }
});

// every friday at 2pm, send message to everybody room with all client wins. erase wins.
var j = schedule.scheduleJob('0 35 18 * * *', function() { // adjusted for GMT time
  console.log('I \'m sending the wins to general!');

  controller.on('create_incoming_webhook', function(bot, webhook_config) {
    bot.sendWebhook({
      text: 'Here are the wins from this week:\n' + compileMsg()
    }, function(err, res) {
      if (err) {
        throw new Error('Could not connect to webhook');
      }
    });
  });

  console.log('Here are the wins from this week:\n' + compileMsg());

  // erase wins
  controller.storage.teams.get(teamID, function(err, team) {
    team.wins = []

    // save new user object
    controller.storage.teams.save(team, function(err) {
      if (!err) {
        console.log("I erased the wins.")
      }
    });
  });
});

function saveWin(bot, message) {
  // send request to get username (whyyyyyy?!)
  request('https://slack.com/api/users.info?token=' + accessToken + '&user=' + message.user, function(error, response, body) {
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

      var timestamp = d.getMonth() + 1 + '-' + d.getDate() + '-' + d.getFullYear() + ' @ ' + (d.getHours() - 7) + ':' + d.getMinutes();

      controller.storage.teams.get(teamID, function(err, team) {
        if (!team.wins) {
          team.wins = []
        }

        // push data to user object
        team.wins.push({
          "timestamp": timestamp,
          "from": userObj.user.name,
          "text": message.text
        });

        // save new user object
        controller.storage.teams.save(team, function(err) {
          if (!err) {
            console.log("I saved the win!")
          }
        });
      });
    }
  });

  // optional reply
  // bot.reply(message, "Thanks for submitting your team win!");
  bot.reply(message, "I'm currently sick and not saving wins. I will let everybody know when I feel better!");
}

// function compileMsg(winsObj) {
function compileMsg() {
  var finalMessage = '';

  controller.storage.teams.get(teamID, function(err, team) {
    console.log(team);
    for (var i = 0; i < team.wins.length; i++) {
      finalMessage += '*From:* ' + team.wins[i].from + '\n' + '*Date:* ' + team.wins[i].timestamp + '\n' + team.wins[i].text + '\n------------\n';
    }
  });

  return finalMessage;
}
