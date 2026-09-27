from aiogram.types import InlineKeyboardMarkup, InlineKeyboardButton, BotCommand
from aiogram.utils.keyboard import InlineKeyboardBuilder


def welcome_kb() -> InlineKeyboardMarkup:
    b = InlineKeyboardBuilder()
    b.row(InlineKeyboardButton(text="❓ WHAT IS ESCROW", callback_data="what_is_escrow"))
    b.row(InlineKeyboardButton(text="ℹ️ INSTRUCTIONS", callback_data="instructions"))
    b.row(InlineKeyboardButton(text="📜 TERMS", callback_data="terms"))
    b.row(InlineKeyboardButton(text="🎬 VIDEO TUTORIAL", callback_data="video_tutorial"))
    b.row(InlineKeyboardButton(text="⚡ CREATE ESCROW GROUP", callback_data="create_escrow"))
    return b.as_markup()


def role_kb() -> InlineKeyboardMarkup:
    b = InlineKeyboardBuilder()
    b.row(
        InlineKeyboardButton(text="🛒 I am Buyer", callback_data="role_buyer"),
        InlineKeyboardButton(text="💼 I am Seller", callback_data="role_seller"),
    )
    return b.as_markup()


def network_kb() -> InlineKeyboardMarkup:
    b = InlineKeyboardBuilder()
    for name, code in [
        ("USDT TRC-20", "TRC20"), ("USDT ERC-20", "ERC20"),
        ("USDT BEP-20", "BEP20"), ("BTC", "BTC"),
        ("LTC", "LTC"), ("TON", "TON"),
    ]:
        b.button(text=name, callback_data=f"net_{code}")
    b.adjust(2)
    return b.as_markup()


def deal_actions_kb() -> InlineKeyboardMarkup:
    b = InlineKeyboardBuilder()
    b.row(
        InlineKeyboardButton(text="💰 Pay Seller", callback_data="pay_seller"),
        InlineKeyboardButton(text="↩️ Refund Buyer", callback_data="refund_buyer"),
    )
    b.row(
        InlineKeyboardButton(text="📊 Balance", callback_data="balance"),
        InlineKeyboardButton(text="📱 QR", callback_data="qr"),
    )
    b.row(
        InlineKeyboardButton(text="🔗 Blockchain", callback_data="blockchain"),
        InlineKeyboardButton(text="⚠️ Contact Admin", callback_data="contact"),
    )
    return b.as_markup()


def back_kb() -> InlineKeyboardMarkup:
    b = InlineKeyboardBuilder()
    b.row(InlineKeyboardButton(text="🔙 Back to Menu", callback_data="back_menu"))
    return b.as_markup()


# BotFather-style command list for set_my_commands
BOT_COMMANDS = [
    BotCommand(command="start", description="Initialize the bot"),
    BotCommand(command="create", description="Create an Escrow Group"),
    BotCommand(command="terms", description="Show our terms"),
    BotCommand(command="instructions", description="Show instructions"),
    BotCommand(command="whatisescrow", description="Explain escrow"),
    BotCommand(command="video", description="Bot working video"),
    BotCommand(command="balance", description="Show escrow balance"),
    BotCommand(command="pay_seller", description="Release money to the seller"),
    BotCommand(command="refund_buyer", description="Release money to the buyer"),
    BotCommand(command="qr", description="Show address QR"),
    BotCommand(command="blockchain", description="Show blockchain link"),
    BotCommand(command="contact", description="Contact admin in case of dispute"),
    BotCommand(command="real", description="Check if the admin is real"),
    BotCommand(command="review", description="Leave a review"),
    BotCommand(command="userinfo", description="Get detailed escrow stats"),
    BotCommand(command="leaderboard", description="View top users"),
    BotCommand(command="refer", description="Refer users and earn USDT bonuses"),
    BotCommand(command="setpin", description="Set transaction PIN"),
    BotCommand(command="menu", description="Show all commands"),
    BotCommand(command="seller", description="Register as seller + address"),
    BotCommand(command="buyer", description="Register as buyer + address"),
]
