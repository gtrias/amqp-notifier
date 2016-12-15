var amqp             = require('amqplib'),
    config           = require('config'),
    TelegramBot      = require('node-telegram-bot-api'),
    vsprintf         = require("sprintf-js").vsprintf,
    // Slack         = require('slack-node'),
    tgtoken          = config.get('telegram.token'),
    tgNotifyUsers    = config.get('telegram.notifyUsers'),
    // slackWebhooks = config.get('slack.webhooks'),
    rabbitHost       = config.get('rabbitmq.host'),
    rabbitUser       = config.get('rabbitmq.user'),
    rabbitPass       = config.get('rabbitmq.pass'),
    exchanges        = config.get('rabbitmq.exchanges')
;

var tgBot = new TelegramBot(tgtoken, { polling: true });

/* tgBot.on("message", function(msg) {
    console.log(msg);
}); */

function notify(msg, exchangeMessage, exchangeFields) {
    var payload = {};
    var object = JSON.parse(msg.content.toString());

    for ( var prop in object) {
        for (var i = 0; i < exchangeFields.length; i++) {
            if (prop == exchangeFields[i].key) {
                payload[prop] = object[prop];
            }
        }
    }

    for (var i = 0; i < tgNotifyUsers.length; i++) {
        tgBot.sendMessage(tgNotifyUsers[i], exchangeMessage);
        tgBot.sendMessage(tgNotifyUsers[i], '```javascript ' + JSON.stringify(payload) + ' ```', {"parse_mode": "Markdown"});
    }
}


function openExchange(conn, exchange) {
    var exchangeName = exchange.name;
    var exchangeMessage = exchange.message;
    var exchangeFields = exchange.fields;

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
                notify(msg, exchangeMessage, exchangeFields);
            }, {noAck: true});
        });

        return ok.then(function() {
            console.log('[amqp-notifier] [*] Waiting for events on %s', exchangeName);
        });

    });
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

rabbitClient.connect();
