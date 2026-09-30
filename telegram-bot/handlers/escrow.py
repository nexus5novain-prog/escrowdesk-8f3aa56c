import time
from aiogram import Router, F, Bot
from aiogram.types import Message, CallbackQuery
from aiogram.filters import Command
from aiogram.enums import ParseMode, ChatType
from aiogram.exceptions import TelegramBadRequest

from config import settings, DealStatus
from database.models import db
from keyboards.inline import role_kb, network_kb, deal_actions_kb
from services.userbot import create_escrow_group

router = Router()


# ---------- /create + button ----------
@router.callback_query(F.data == "create_escrow")
@router.message(Command("create"))
async def create_escrow(event: Message | CallbackQuery, bot: Bot):
    is_cb = isinstance(event, CallbackQuery)
    if is_cb:
        await event.answer()
        message = event.message
        user = event.from_user
    else:
        message = event
        user = event.from_user

    await message.answer("⚡ <b>Creating Escrow Group. Please Wait...</b>", parse_mode=ParseMode.HTML)

    deal = await db.create_deal(user.id)
    deal_id = deal["deal_id"]

    # Try automatic group creation via userbot
    result = await create_escrow_group(deal_id, settings.BOT_USERNAME)

    if result:
        group_id, invite_link = result
        # Telethon returns positive channel id; Telegram bot API uses -100 prefix for supergroups
        bot_group_id = int(f"-100{group_id}")
        await db.update_deal(deal_id, group_id=bot_group_id, group_link=invite_link, status=DealStatus.WAITING_ROLES)

        text = (
            f"✅ <b>Created Escrow Group #{deal_id}</b>\n\n"
            f"Group Link: {invite_link}\n\n"
            f"Now Join this escrow group & Forward this message to buyer/seller.\n\n"
            f"Enjoy Safe Escrow 🎉"
        )
        await message.answer(text, parse_mode=ParseMode.HTML)

        # Also try to send welcome inside the group
        try:
            await bot.send_message(
                bot_group_id,
                f"🔥 <b>{settings.BRAND_NAME} Bot</b>\n"
                f"Escrow <b>#{deal_id}</b> is active.\n\n"
                f"Both parties: register with\n"
                f"<code>/seller YOUR_WALLET</code>\n"
                f"<code>/buyer YOUR_WALLET</code>\n"
                f"or use the buttons below.",
                reply_markup=role_kb(),
                parse_mode=ParseMode.HTML
            )
        except Exception:
            pass
    else:
        # Fallback when userbot is not configured
        text = (
            f"⚡ <b>Escrow Deal Created</b>\n\n"
            f"Deal ID: <code>{deal_id}</code>\n\n"
            f"<b>Automatic group creation requires the userbot.</b>\n\n"
            f"<b>Manual steps (same result):</b>\n"
            f"1. Create a new <b>Private Group</b>\n"
            f"2. Add <b>@{settings.BOT_USERNAME}</b> as Administrator\n"
            f"3. In the group send:\n"
            f"<code>/start_deal {deal_id}</code>\n\n"
            f"Then share the group with the other party.\n\n"
            f"<i>To enable fully automatic /create, add API_ID + API_HASH "
            f"from my.telegram.org to the bot config.</i>"
        )
        await message.answer(text, parse_mode=ParseMode.HTML)


@router.message(Command("start_deal"))
async def start_deal(message: Message):
    if message.chat.type not in (ChatType.GROUP, ChatType.SUPERGROUP):
        await message.reply("This command only works inside a group.")
        return
    args = message.text.split(maxsplit=1)
    if len(args) < 2:
        await message.reply("Usage: <code>/start_deal DEAL_ID</code>", parse_mode=ParseMode.HTML)
        return
    deal_id = args[1].strip().lower()
    deal = await db.get_deal(deal_id)
    if not deal:
        await message.reply("❌ Deal ID not found. Use /create first.")
        return

    await db.update_deal(deal_id, group_id=message.chat.id, status=DealStatus.WAITING_ROLES)

    text = (
        f"🔥 <b>{settings.BRAND_NAME} Bot v.2</b>\n"
        f"<i>Your Automated Telegram Escrow Service</i>\n\n"
        f"✅ Escrow Group <b>#{deal_id}</b> is now active!\n\n"
        f"📋 <b>To declare yourself as a seller or buyer:</b>\n"
        f"Type <code>/seller ADDRESS</code> to register as a seller.\n"
        f"Type <code>/buyer ADDRESS</code> to register as a buyer.\n"
        f"• Or paste your crypto address and choose your role using the buttons.\n\n"
        f"💡 BTC · LTC · USDT (TRC20/ERC20/BEP20) · TON"
    )
    await message.answer(text, reply_markup=role_kb(), parse_mode=ParseMode.HTML)


# ---------- ROLES ----------
@router.callback_query(F.data.in_({"role_buyer", "role_seller"}))
async def set_role_btn(cb: CallbackQuery):
    await cb.answer()
    deal = await db.get_deal_by_group(cb.message.chat.id)
    if not deal:
        await cb.message.answer("No active deal. /start_deal DEAL_ID")
        return
    role = "buyer" if cb.data == "role_buyer" else "seller"
    uid = cb.from_user.id
    if role == "buyer":
        if deal["buyer_id"] and deal["buyer_id"] != uid:
            await cb.answer("Buyer already taken.", show_alert=True)
            return
        await db.update_deal(deal["deal_id"], buyer_id=uid)
        await cb.message.answer(f"✅ <b>{cb.from_user.full_name}</b> → <b>Buyer</b> 🛒", parse_mode=ParseMode.HTML)
    else:
        if deal["seller_id"] and deal["seller_id"] != uid:
            await cb.answer("Seller already taken.", show_alert=True)
            return
        await db.update_deal(deal["deal_id"], seller_id=uid)
        await cb.message.answer(f"✅ <b>{cb.from_user.full_name}</b> → <b>Seller</b> 💼", parse_mode=ParseMode.HTML)

    deal = await db.get_deal(deal["deal_id"])
    if deal["buyer_id"] and deal["seller_id"]:
        await cb.message.answer("🎉 Both roles set! Select network:", reply_markup=network_kb())


@router.message(Command("seller"))
@router.message(Command("buyer"))
async def set_role_cmd(message: Message):
    deal = await db.get_deal_by_group(message.chat.id)
    if not deal:
        await message.reply("No active deal. Use /start_deal DEAL_ID first.")
        return
    parts = message.text.split(maxsplit=1)
    role = "seller" if parts[0].lower().startswith("/seller") else "buyer"
    address = parts[1].strip() if len(parts) > 1 else ""

    if role == "seller":
        await db.update_deal(deal["deal_id"], seller_id=message.from_user.id, seller_address=address)
        await message.reply(
            f"✅ You are the <b>Seller</b>" + (f"\nWallet: <code>{address}</code>" if address else ""),
            parse_mode=ParseMode.HTML
        )
    else:
        await db.update_deal(deal["deal_id"], buyer_id=message.from_user.id, buyer_address=address)
        await message.reply(
            f"✅ You are the <b>Buyer</b>" + (f"\nWallet: <code>{address}</code>" if address else ""),
            parse_mode=ParseMode.HTML
        )

    deal = await db.get_deal(deal["deal_id"])
    if deal["buyer_id"] and deal["seller_id"]:
        await message.answer("🎉 Both roles set! Select network:", reply_markup=network_kb())


# ---------- NETWORK + DEPOSIT ----------
def _is_admin(user_id: int) -> bool:
    return user_id in settings.ADMIN_IDS


@router.callback_query(F.data.startswith("net_"))
async def set_network(cb: CallbackQuery):
    await cb.answer()
    network = cb.data.replace("net_", "")
    deal = await db.get_deal_by_group(cb.message.chat.id)
    if not deal:
        return
    escrow = settings.escrow_address(network)
    if not escrow:
        await cb.message.answer(
            f"⛔ <b>{network}</b> deposits are not enabled yet. Choose another network or contact {settings.SUPPORT_CONTACT}.",
            parse_mode=ParseMode.HTML,
        )
        return
    await db.update_deal(deal["deal_id"], network=network, escrow_address=escrow, status=DealStatus.WAITING_DEPOSIT)
    text = (
        f"🌐 Network: <b>{network}</b>\n\n"
        f"🏦 <b>Send funds to the EscrowDesk address:</b>\n"
        f"<code>{escrow}</code>\n\n"
        f"Reference: <b>#{deal['deal_id']}</b>\n"
        f"An admin verifies the payment on-chain and confirms it here."
    )
    await cb.message.answer(text, reply_markup=deal_actions_kb(), parse_mode=ParseMode.HTML)


@router.message(Command("confirm_deposit"))
async def confirm_deposit(message: Message, bot: Bot):
    """Admin only: /confirm_deposit AMOUNT TXID — after verifying on-chain."""
    if not _is_admin(message.from_user.id):
        await message.reply("⛔ Admins only.")
        return
    deal = await db.get_deal_by_group(message.chat.id)
    if not deal or deal["status"] != DealStatus.WAITING_DEPOSIT:
        await message.reply("No deal waiting for a deposit in this group.")
        return
    parts = message.text.split()
    try:
        amount = float(parts[1])
        txid = parts[2]
    except (IndexError, ValueError):
        await message.reply("Usage: <code>/confirm_deposit AMOUNT TXID</code>", parse_mode=ParseMode.HTML)
        return
    await db.update_deal(deal["deal_id"], status=DealStatus.FUNDED, deposited_amount=amount, funded_at=int(time.time()))
    await message.answer(
        f"✅ <b>Deposit confirmed</b>\nAmount: <b>{amount}</b> {deal['network']}\nTX: <code>{txid}</code>\n\n"
        "Buyer confirms delivery with /pay_seller.",
        reply_markup=deal_actions_kb(), parse_mode=ParseMode.HTML
    )
    if settings.DEALS_CHANNEL_ID:
        try:
            await bot.send_message(
                settings.DEALS_CHANNEL_ID,
                f"🔒 <b>New Funded Escrow #{deal['deal_id']}</b>\n"
                f"Network: {deal['network']}\nAmount: {amount}\n"
                f"Wallet: <code>{deal['escrow_address']}</code>\nTX: <code>{txid}</code>",
                parse_mode=ParseMode.HTML,
            )
        except Exception:
            pass


# ---------- RELEASE ----------
async def _do_release(message: Message, action: str, user_id: int):
    deal = await db.get_deal_by_group(message.chat.id)
    if not deal or deal["status"] != DealStatus.FUNDED:
        await message.answer("Deal is not funded yet.")
        return
    # Only the buyer can release to seller; only the seller (or admin) can refund buyer.
    if action == "pay" and user_id != deal["buyer_id"] and not _is_admin(user_id):
        await message.answer("⛔ Only the buyer can release funds to the seller.")
        return
    if action == "refund" and user_id != deal["seller_id"] and not _is_admin(user_id):
        await message.answer("⛔ Only the seller or an admin can refund the buyer.")
        return
    if action == "pay":
        await db.update_deal(deal["deal_id"], status=DealStatus.COMPLETED, completed_at=int(time.time()))
        await db.increment_stat("deals_completed")
        await message.answer(
            f"✅ <b>Release approved.</b> Payout to seller wallet <code>{deal['seller_address'] or 'not set'}</code> is being sent by EscrowDesk.",
            parse_mode=ParseMode.HTML)
    else:
        await db.update_deal(deal["deal_id"], status=DealStatus.REFUNDED, completed_at=int(time.time()))
        await message.answer(
            f"↩️ <b>Refund approved.</b> Payout to buyer wallet <code>{deal['buyer_address'] or 'not set'}</code> is being sent by EscrowDesk.",
            parse_mode=ParseMode.HTML)
    for admin in settings.ADMIN_IDS:
        try:
            await message.bot.send_message(
                admin,
                f"💸 Payout needed for #{deal['deal_id']} ({action}) — {deal['deposited_amount']} {deal['network']}")
        except Exception:
            pass


@router.message(Command("pay_seller"))
@router.callback_query(F.data == "pay_seller")
async def pay_seller(event):
    msg = event if isinstance(event, Message) else event.message
    if isinstance(event, CallbackQuery):
        await event.answer()
    await _do_release(msg, "pay", event.from_user.id)


@router.message(Command("refund_buyer"))
@router.callback_query(F.data == "refund_buyer")
async def refund_buyer(event):
    msg = event if isinstance(event, Message) else event.message
    if isinstance(event, CallbackQuery):
        await event.answer()
    await _do_release(msg, "refund", event.from_user.id)


# ---------- UTILS ----------
@router.message(Command("balance"))
@router.callback_query(F.data == "balance")
async def balance(event):
    msg = event if isinstance(event, Message) else event.message
    if isinstance(event, CallbackQuery):
        await event.answer()
    deal = await db.get_deal_by_group(msg.chat.id)
    if not deal:
        await msg.answer("No active deal.")
        return
    await msg.answer(
        f"📊 <b>Escrow Balance</b>\n"
        f"Status: <b>{deal['status'].upper()}</b>\n"
        f"Deposited: <b>${deal['deposited_amount']:.2f}</b>\n"
        f"Network: {deal['network'] or '—'}\n"
        f"Address: <code>{deal['escrow_address'] or 'N/A'}</code>",
        parse_mode=ParseMode.HTML
    )


@router.message(Command("qr"))
@router.callback_query(F.data == "qr")
async def qr(event):
    msg = event if isinstance(event, Message) else event.message
    if isinstance(event, CallbackQuery):
        await event.answer()
    deal = await db.get_deal_by_group(msg.chat.id)
    addr = deal["escrow_address"] if deal else None
    if not addr:
        await msg.answer("No escrow address yet.")
        return
    await msg.answer(f"📱 Escrow Address:\n<code>{addr}</code>", parse_mode=ParseMode.HTML)


@router.message(Command("blockchain"))
@router.callback_query(F.data == "blockchain")
async def blockchain(event):
    msg = event if isinstance(event, Message) else event.message
    if isinstance(event, CallbackQuery):
        await event.answer()
    await msg.answer("🔗 Blockchain explorer links appear after live wallets are connected.")


@router.message(Command("contact"))
@router.callback_query(F.data == "contact")
async def contact(event):
    msg = event if isinstance(event, Message) else event.message
    if isinstance(event, CallbackQuery):
        await event.answer()
    await msg.answer(
        f"⚠️ <b>Contact Support</b>\n\n"
        f"Message {settings.SUPPORT_CONTACT}\n"
        f"or wait for an admin to join this group.\n"
        f"Response within 24 hours.",
        parse_mode=ParseMode.HTML
    )


@router.message(F.forward_date)
async def block_forwards(message: Message):
    deal = await db.get_deal_by_group(message.chat.id)
    if deal:
        try:
            await message.delete()
            await message.answer("🚫 Forwards blocked in escrow groups.")
        except TelegramBadRequest:
            pass
