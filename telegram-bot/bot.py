import asyncio
import logging
import os
from aiogram import Bot, Dispatcher
from aiogram.client.default import DefaultBotProperties
from aiogram.enums import ParseMode
from aiogram.fsm.storage.memory import MemoryStorage

from config import settings
from database.models import db
from handlers import start, escrow
from keyboards.inline import BOT_COMMANDS
from services.userbot import close_userbot

logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(levelname)s - %(message)s")
logger = logging.getLogger(__name__)


async def on_startup(bot: Bot):
    os.makedirs(os.path.dirname(settings.DATABASE_PATH) or ".", exist_ok=True)
    await db.connect()
    await bot.set_my_commands(BOT_COMMANDS)
    me = await bot.get_me()
    logger.info(f"Bot started as @{me.username} (ID: {me.id})")
    logger.info(f"Brand: {settings.BRAND_NAME}")
    if settings.SIMULATION_MODE:
        logger.warning("SIMULATION MODE active")
    if settings.userbot_enabled:
        logger.info("Userbot credentials present — automatic group creation enabled")
    else:
        logger.warning("Userbot NOT configured (API_ID/API_HASH empty) — /create will use manual fallback")


async def on_shutdown(bot: Bot):
    await close_userbot()
    await db.close()
    logger.info("Bot stopped")


async def main():
    if not settings.BOT_TOKEN:
        logger.error("BOT_TOKEN missing")
        return

    bot = Bot(token=settings.BOT_TOKEN, default=DefaultBotProperties(parse_mode=ParseMode.HTML))
    dp = Dispatcher(storage=MemoryStorage())
    dp.include_router(start.router)
    dp.include_router(escrow.router)
    dp.startup.register(on_startup)
    dp.shutdown.register(on_shutdown)

    await bot.delete_webhook(drop_pending_updates=True)
    logger.info("Starting polling...")
    await dp.start_polling(bot)


if __name__ == "__main__":
    asyncio.run(main())
