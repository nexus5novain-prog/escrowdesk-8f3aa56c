"""
One-time Telethon login for automatic escrow group creation.
Run: python login_userbot.py
"""
import asyncio
from dotenv import load_dotenv
import os

load_dotenv()

API_ID = os.getenv("API_ID")
API_HASH = os.getenv("API_HASH")
SESSION = os.getenv("USERBOT_SESSION", "escrowdesk_userbot")

async def main():
    if not API_ID or not API_HASH:
        print("Set API_ID and API_HASH in .env first (from https://my.telegram.org)")
        return
    from telethon import TelegramClient
    client = TelegramClient(SESSION, int(API_ID), API_HASH)
    await client.start()
    me = await client.get_me()
    print(f"Logged in as {me.first_name} (@{me.username}) ID={me.id}")
    print(f"Session saved: {SESSION}.session")
    await client.disconnect()

if __name__ == "__main__":
    asyncio.run(main())
