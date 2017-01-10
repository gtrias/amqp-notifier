var amqp          = require('amqplib');
var nunjucks      = require('nunjucks');
var config        = require('config');
var TelegramBot   = require('node-telegram-bot-api');
var Slack         = require('slack-node');
var tgtoken       = config.get('telegram.token');
var tgNotifyUsers = config.get('telegram.notifyUsers');
var slackTokens = config.get('slack.tokens');
var slackUrl      = config.get('slack.url');
var rabbitHost    = config.get('rabbitmq.host');
var rabbitUser    = config.get('rabbitmq.user');
var rabbitPass    = config.get('rabbitmq.pass');
var exchanges     = config.get('rabbitmq.exchanges');

var tgBot = new TelegramBot(tgtoken, { polling: true });

/* tgBot.on("message", function(msg) {
    console.log(msg);
}); */

function notify(msg, template) {
    var payload = {};
    var object = JSON.parse(msg.content.toString());
    var res = nunjucks.renderString(template, object);

    // Telegram sending
    for (var i = 0; i < tgNotifyUsers.length; i++) {
        tgBot.sendMessage(tgNotifyUsers[i], res);
    }

    // Slack sending
    for (token in slackTokens) {
        var apiToken = token.token;
        var SlackClient = new Slack(apiToken);
        SlackClient.url = slackUrl;

        SlackClient.api('chat.postMessage', {
          text: res,
          channel: token.channel
        }, function(err, response){
          console.log(response);
        });
    }
}

var rabbitClient = {
    connect: function () {
        console.log('[amqp-notifier] Starting rabbitmq worker in server %s', rabbitHost);
        amqp.connect('amqp://' + rabbitUser + ':' + rabbitPass + '@' + rabbitHost).then(function(conn) {
            process.once('SIGINT', function() { conn.close(); });

            for (var i = 0; i < exchanges.length; i++) {
                openExchange(conn, exchanges[i]);
            }

        }).catch(console.warn);
    }
};

function openExchange(conn, exchange) {
    var exchangeName = exchange.name;
    var exchangeTemplate = exchange.template;

    conn.createChannel().then(function(ch) {
        var ok = ch.assertExchange(exchangeName, 'fanout', {durable: true});
        ok = ok.then(function() {
            return ch.assertQueue('', {exclusive: true});
        });
        ok = ok.then(function(qok) {
            return ch.bindQueue(qok.queue, exchangeName, '').then(function() {
                return qok.queue;
            });
        });
        ok = ok.then(function(queue) {
            return ch.consume(queue, function (msg) {
                notify(msg, exchangeTemplate);
            }, {noAck: true});
        });

        return ok.then(function() {
            console.log('[amqp-notifier] [*] Waiting for events on %s', exchangeName);
        });

    });
}

// Start our worker
rabbitClient.connect();
