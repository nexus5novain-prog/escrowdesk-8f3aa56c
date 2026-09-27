"""
Telethon userbot for automatic escrow group creation.
Requires API_ID + API_HASH from https://my.telegram.org
"""
import logging
from typing import Optional, Tuple
from config import settings

logger = logging.getLogger(__name__)

_client = None


async def get_userbot():
    global _client
    if not settings.userbot_enabled:
        return None
    if _client is not None:
        return _client
    try:
        from telethon import TelegramClient
        _client = TelegramClient(
            settings.USERBOT_SESSION,
            int(settings.API_ID),
            settings.API_HASH
        )
        await _client.connect()
        if not await _client.is_user_authorized():
            logger.warning("Userbot not authorized. Run login flow first.")
            await _client.disconnect()
            _client = None
            return None
        me = await _client.get_me()
        logger.info(f"Userbot logged in as {me.first_name} (@{me.username})")
        return _client
    except Exception as e:
        logger.error(f"Userbot init failed: {e}")
        return None


async def create_escrow_group(deal_id: str, bot_username: str) -> Optional[Tuple[int, str]]:
    """
    Create a private group, add the bot as admin, return (group_id, invite_link).
    """
    client = await get_userbot()
    if not client:
        return None

    try:
        from telethon.tl.functions.channels import CreateChannelRequest, InviteToChannelRequest
        from telethon.tl.functions.messages import ExportChatInviteRequest
        from telethon.tl.types import InputPeerUser
        from telethon.tl.functions.channels import EditAdminRequest
        from telethon.tl.types import ChatAdminRights

        title = f"Escrow #{deal_id}"
        result = await client(CreateChannelRequest(
            title=title,
            about=f"EscrowDesk secure deal #{deal_id}. Deposit & release only.",
            megagroup=True
        ))
        channel = result.chats[0]
        group_id = channel.id

        # Add the bot
        try:
            bot_entity = await client.get_entity(bot_username)
            await client(InviteToChannelRequest(channel, [bot_entity]))
            # Promote bot to admin
            rights = ChatAdminRights(
                change_info=True,
                delete_messages=True,
                ban_users=True,
                invite_users=True,
                pin_messages=True,
                manage_call=False
            )
            await client(EditAdminRequest(
                channel=channel,
                user_id=bot_entity,
                admin_rights=rights,
                rank="EscrowDesk"
            ))
        except Exception as e:
            logger.warning(f"Could not add/promote bot: {e}")

        # Create invite link
        invite = await client(ExportChatInviteRequest(peer=channel))
        link = invite.link

        logger.info(f"Created group {title} id={group_id} link={link}")
        return group_id, link
    except Exception as e:
        logger.error(f"Group creation failed: {e}")
        return None


async def close_userbot():
    global _client
    if _client:
        await _client.disconnect()
        _client = None
