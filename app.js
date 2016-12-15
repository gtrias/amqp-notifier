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

var rabbitClient = {
    connect: function () {
        console.log('[amqp-notifier] Starting rabbitmq worker in server %s', rabbitHost);
        amqp.connect('amqp://' + rabbitUser + ':' + rabbitPass + '@' + rabbitHost).then(function(conn) {
            process.once('SIGINT', function() { conn.close(); });

            for (var i = 0; i < exchanges.length; i++) {
                var exchangeName = exchanges[i];

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
                        return ch.consume(queue, notify, {noAck: true});
                    });
                    return ok.then(function() {
                        console.log('[amqp-notifier] [*] Waiting for events. To exit press CTRL+C');
                    });

                    function notify(msg) {
                        for (var i = 0; i < tgNotifyUsers.length; i++) {
                            var message = vsprintf("New event received ```javascript %s ```", [msg.content.toString()]);
                            tgBot.sendMessage(tgNotifyUsers[i], message, {"parse_mode": "Markdown"});
                        }
                    }
                });
            }

        }).catch(console.warn);
    }
};

rabbitClient.connect();
