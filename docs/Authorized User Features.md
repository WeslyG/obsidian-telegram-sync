#### Authorized User Features

The bot works without a user session. To enable these features, use **Telegram user → Log in**, enter an API ID and hash from [my.telegram.org](https://my.telegram.org/apps), and confirm the QR login in Telegram. Obsidian stores the credentials and session in per-vault secret storage. **Log out** revokes the session through Telegram and clears the local copy. This optional connection goes directly to Telegram, separately from the Bot API proxy.

Old-message recovery is opt-in and forwards messages within selected, allowed Telegram chats. Downloads through the user session are capped at 128 MiB.

##### Telegram Premium subscribers

✅ voice and video notes transcription using template variable {{voiceTranscript}}<br/>
✅ increased files download speed<br/>
❌ translating messages (_not implemented_)<br/>

##### All Telegram User

✅ available to download files more than 50MB (telegram bot limit) <br/>
✅ reacting with "👍" instead of replying for marking messages as processed<br/>
✅ processing messages older than 24 hours if Obsidian wasn't running<br/>
✅ sending notes from Obsidian to Telegram<br/>
❌ getting messages from other bots in connected group chats (_not implemented_)<br/>
❌ automatically identifying renamed topic without using command /topicName (_not implemented_)<br/>
