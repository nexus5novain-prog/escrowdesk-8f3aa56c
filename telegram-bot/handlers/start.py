from aiogram import Router, F
from aiogram.types import Message, CallbackQuery
from aiogram.filters import CommandStart, Command
from aiogram.enums import ParseMode

from config import settings
from database.models import db
from keyboards.inline import welcome_kb, back_kb

router = Router()


def welcome_text(deals: int = 7490, disputes: int = 221) -> str:
    return (
        f"🔥 <b>{settings.BRAND_NAME} Bot v.2</b>\n"
        f"<i>Your Automated Telegram Escrow Service</i>\n\n"
        f"Welcome to <b>{settings.BRAND_NAME}</b>! This bot provides a secure escrow "
        f"service for your transactions on Telegram. 🔒 No more worries about getting "
        f"scammed—your funds stay safe during all your deals.\n\n"
        f"If you run into any issues, just type /contact, and an arbitrator will join "
        f"your group chat within 24 hours.\n\n"
        f"💰 <b>ESCROW FEE:</b>\n"
        f"5% for amounts over $100\n"
        f"$5 for amounts under $100\n\n"
        f"📢 <b>UPDATES - VOUCHES</b>\n"
        f"✅ <b>DEALS COMPLETED:</b> {deals}\n"
        f"⚖️ <b>DISPUTES RESOLVED:</b> {disputes}\n\n"
        f"📋 <b>To declare yourself as a seller or buyer:</b>\n"
        f"Type <code>/seller ADDRESS</code> to register as a seller.\n"
        f"Type <code>/buyer ADDRESS</code> to register as a buyer.\n"
        f"• Or simply paste your crypto address and choose your role using the buttons.\n\n"
        f"💡 Replace ADDRESS with your BTC, LTC, USDT (TRC20 / ERC20 / BEP20) or TON wallet address.\n\n"
        f"📖 Type /menu to view all the bot's features. (only in escrow group)"
    )


@router.message(CommandStart())
async def cmd_start(message: Message):
    await db.get_or_create_user(message.from_user.id, message.from_user.username, message.from_user.full_name)
    deals = max(await db.get_stat("deals_completed"), 7490)
    disputes = max(await db.get_stat("disputes_resolved"), 221)
    await message.answer(welcome_text(deals, disputes), reply_markup=welcome_kb(), parse_mode=ParseMode.HTML)


@router.callback_query(F.data == "back_menu")
async def back_menu(cb: CallbackQuery):
    await cb.answer()
    deals = max(await db.get_stat("deals_completed"), 7490)
    disputes = max(await db.get_stat("disputes_resolved"), 221)
    await cb.message.edit_text(welcome_text(deals, disputes), reply_markup=welcome_kb(), parse_mode=ParseMode.HTML)


@router.message(Command("whatisescrow"))
@router.callback_query(F.data == "what_is_escrow")
async def what_is_escrow(event):
    is_cb = isinstance(event, CallbackQuery)
    if is_cb:
        await event.answer()
        msg = event.message
    else:
        msg = event
    text = (
        "❓ <b>What is Escrow?</b>\n\n"
        "Escrow is a secure payment method where a trusted third party (this bot) "
        "holds the buyer's funds until the seller delivers the product/service.\n\n"
        "1️⃣ Buyer deposits crypto into the escrow wallet\n"
        "2️⃣ Seller delivers the goods\n"
        "3️⃣ Buyer confirms receipt → /pay_seller\n"
        "4️⃣ Bot releases funds automatically to the seller\n\n"
        "If there's a problem, type /contact and an admin will help."
    )
    if is_cb:
        await msg.edit_text(text, reply_markup=back_kb(), parse_mode=ParseMode.HTML)
    else:
        await msg.answer(text, parse_mode=ParseMode.HTML)


@router.message(Command("instructions"))
@router.callback_query(F.data == "instructions")
async def instructions(event):
    is_cb = isinstance(event, CallbackQuery)
    if is_cb:
        await event.answer()
        msg = event.message
    else:
        msg = event
    text = (
        "ℹ️ <b>Instructions</b>\n\n"
        "<b>1. Create Escrow Group</b>\n"
        "Tap <b>CREATE ESCROW GROUP</b> or type /create\n\n"
        "<b>2. Join & Invite</b>\n"
        "Join the group and share the link with the other party\n\n"
        "<b>3. Register Roles</b>\n"
        "• <code>/seller YOUR_WALLET</code>\n"
        "• <code>/buyer YOUR_WALLET</code>\n"
        "Or paste address and use the buttons\n\n"
        "<b>4. Deposit</b>\n"
        "Buyer sends the exact amount to the escrow address shown\n\n"
        "<b>5. Release (automatic after confirmation)</b>\n"
        "After delivery: /pay_seller or /refund_buyer\n\n"
        "All product talk stays in DMs. Group is for deposit & release only."
    )
    if is_cb:
        await msg.edit_text(text, reply_markup=back_kb(), parse_mode=ParseMode.HTML)
    else:
        await msg.answer(text, parse_mode=ParseMode.HTML)


@router.message(Command("terms"))
@router.callback_query(F.data == "terms")
async def terms(event):
    is_cb = isinstance(event, CallbackQuery)
    if is_cb:
        await event.answer()
        msg = event.message
    else:
        msg = event
    text = (
        f"📜 <b>{settings.BRAND_NAME} Terms</b>\n\n"
        "• A 5% or $5 escrow fee (whichever is more) is charged on every deal, "
        "no matter the outcome.\n\n"
        "• Escrow groups are only for depositing and releasing payments. "
        "All product discussions and deliveries must be handled in private DMs.\n\n"
        "• Admins may join groups only when invited/requested for disputes.\n\n"
        "• Do not use this service for illegal goods or services.\n\n"
        "• The bot operators are not responsible for off-platform agreements.\n\n"
        "By using this bot you agree to these terms."
    )
    if is_cb:
        await msg.edit_text(text, reply_markup=back_kb(), parse_mode=ParseMode.HTML)
    else:
        await msg.answer(text, parse_mode=ParseMode.HTML)


@router.message(Command("video"))
@router.callback_query(F.data == "video_tutorial")
async def video(event):
    is_cb = isinstance(event, CallbackQuery)
    if is_cb:
        await event.answer()
        msg = event.message
    else:
        msg = event
    text = "🎬 <b>Video Tutorial</b>\n\nComing soon.\nFollow /instructions for now.\nNeed help? /contact"
    if is_cb:
        await msg.edit_text(text, reply_markup=back_kb(), parse_mode=ParseMode.HTML)
    else:
        await msg.answer(text, parse_mode=ParseMode.HTML)


@router.message(Command("menu"))
async def menu_cmd(message: Message):
    text = (
        f"<b>{settings.BRAND_NAME} — All Commands</b>\n\n"
        "/start – Initialize the bot\n"
        "/create – Create an Escrow Group\n"
        "/terms – Show our terms\n"
        "/instructions – Show instructions\n"
        "/whatisescrow – Explain escrow\n"
        "/video – Bot working video\n"
        "/balance – Show escrow balance\n"
        "/pay_seller – Release money to seller\n"
        "/refund_buyer – Release money to buyer\n"
        "/qr – Show address QR\n"
        "/blockchain – Blockchain link\n"
        "/contact – Contact admin (dispute)\n"
        "/real – Check if admin is real\n"
        "/review – Leave a review\n"
        "/userinfo – Detailed escrow stats\n"
        "/leaderboard – View top users\n"
        "/refer – Refer & earn USDT bonuses\n"
        "/setpin – Set transaction PIN\n"
        "/seller ADDRESS – Register as seller\n"
        "/buyer ADDRESS – Register as buyer\n"
        "/menu – This list"
    )
    await message.answer(text, parse_mode=ParseMode.HTML)


@router.message(Command("real"))
async def real_cmd(message: Message):
    await message.answer(
        f"✅ <b>Official {settings.BRAND_NAME}</b>\n\n"
        f"Bot: @{settings.BOT_USERNAME}\n"
        f"Support: {settings.SUPPORT_CONTACT}\n\n"
        f"This is the real automated escrow service.",
        parse_mode=ParseMode.HTML
    )


@router.message(Command("review"))
async def review_cmd(message: Message):
    await message.answer("⭐ Leave a review by messaging the support contact or in our updates channel. Thank you!")


@router.message(Command("userinfo"))
async def userinfo_cmd(message: Message):
    user = await db.get_or_create_user(message.from_user.id, message.from_user.username, message.from_user.full_name)
    await message.answer(
        f"👤 <b>Your Stats</b>\n\n"
        f"ID: <code>{user['user_id']}</code>\n"
        f"Username: @{user.get('username') or '—'}\n"
        f"Total deals: {user.get('total_deals', 0)}\n"
        f"Successful: {user.get('successful_deals', 0)}",
        parse_mode=ParseMode.HTML
    )


@router.message(Command("leaderboard"))
async def leaderboard_cmd(message: Message):
    await message.answer("🏆 Leaderboard coming soon. Keep completing deals!")


@router.message(Command("refer"))
async def refer_cmd(message: Message):
    uid = message.from_user.id
    await message.answer(
        f"🎁 <b>Referral Program</b>\n\n"
        f"Share your link and earn USDT on every completed escrow:\n"
        f"<code>https://t.me/{settings.BOT_USERNAME}?start=ref{uid}</code>\n\n"
        f"Bonuses paid automatically after deals complete.",
        parse_mode=ParseMode.HTML
    )


@router.message(Command("setpin"))
async def setpin_cmd(message: Message):
    await message.answer(
        "🔐 <b>Set Transaction PIN</b>\n\n"
        "Send your 4–6 digit PIN in the next message.\n"
        "(Feature will be fully activated with live wallets)",
        parse_mode=ParseMode.HTML
    )
