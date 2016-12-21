# amqp-notifier

This bot will send messages to Telegram and Slack when a rabbitmq event is triggered, it uses
nunjucks template defined in exchange configuration to show a comprehensive message to the receiver.

## Installation

Using native node.js:

```bash
npm install
```

Using docker:

```bash
docker run -e NODE_CONFIG='{}' -ti gtrias/amqp-notifier
```

## Configuration

Check out `config/default.json` file to see all configurable fields


Exchanges configuration example:

```javascript
        "exchanges": [
            {
                "name": "whatever.created",
                "template": "your exchange nunjucks template {{ some.amqp.msg.field }}"
            }
        ]
```
