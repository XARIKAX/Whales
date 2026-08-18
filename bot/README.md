# The town crier

Watches the chain and posts to Telegram, in real time:

- **⚡ Activations** — a whale woke up, 1M $WHALE burned, running totals and
  the burn percentage
- **🌊 Hauls** — the pot split across the pod, in ETH and dollars, with the
  keeper's tip
- **📬 Deliveries** — ETH landing in whale wallets, one line per batch
- **💸 Sales** — a whale sold on OpenSea, with the price and the buyer; a
  sweep of several in one order is one message. A sale is a Transfer whose
  transaction also fulfilled a Seaport order — plain wallet-to-wallet moves
  carry no order and are kept quiet.

It reads the chain and posts messages. It holds no keys and sends no
transactions.

## Setup, once

1. **Make the bot.** Message [@BotFather](https://t.me/BotFather) on Telegram,
   send `/newbot`, pick a name (e.g. `Whales Sonar`) and a username (e.g.
   `WhalesSonarBot`). It hands back a token like `123456:ABC-DEF...` — that is
   `TELEGRAM_BOT_TOKEN`.

2. **Put it in the group.** Add the bot to your Telegram group and make it an
   admin (it only needs to send messages).

3. **Find the chat id.** Send any message in the group, then open
   `https://api.telegram.org/bot<TOKEN>/getUpdates` in a browser and read
   `"chat":{"id":-100...}` out of the response. That negative number is
   `TELEGRAM_CHAT_ID`. (For a channel it also starts with `-100`.)

4. **Install and run:**

   ```bash
   cd bot && npm install

   RPC_URL=https://rpc.mainnet.chain.robinhood.com \
   TELEGRAM_BOT_TOKEN=123456:ABC... \
   TELEGRAM_CHAT_ID=-100123456789 \
   node bot.js
   ```

   Addresses come from `../contracts/deployments/robinhood.json` automatically.
   Without that file, set `WHALES_ADDRESS` and `TRENCH_ADDRESS` instead.

Try it first with `--dry-run` — it prints what it would post and sends
nothing. `--from <block>` replays from a specific block if you want to test
against events that already happened.

## Keeping it alive

The bot has to run on a machine that stays up — the same box as the keeper is
the natural home. Two options:

```bash
# pm2 (restarts on crash and on reboot)
pm2 start bot.js --name whales-bot
pm2 save

# or plain nohup
nohup node bot.js >> bot.log 2>&1 &
```

It remembers the last block it posted (in `state.json`), so restarts neither
repost old news nor skip what happened while it was down. On its very first
run it starts from the current block rather than replaying history into a
live group.

## Tuning

| Env | Default | What it does |
| --- | --- | --- |
| `POLL_MS` | `15000` | How often to look for new blocks |
| `MAX_RANGE` | `5000` | Blocks per `getLogs` call (lower it if the RPC complains) |
| `SITE_URL` | `https://whalenft.fun` | The links in the messages |
| `EXPLORER_URL` | Blockscout | Where the `tx` links point |
| `DEPLOYMENT` | `../contracts/deployments/robinhood.json` | Address file |

Dollar figures come from CoinGecko's free endpoint; if it is down the
messages simply show ETH only.
