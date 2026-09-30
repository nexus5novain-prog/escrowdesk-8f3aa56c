from pydantic_settings import BaseSettings, SettingsConfigDict
from typing import List
from dotenv import load_dotenv

load_dotenv()


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    BOT_TOKEN: str = ""
    ADMIN_IDS_RAW: str = "7371453715"
    FEE_PERCENT: float = 5.0
    MIN_FEE_USD: float = 5.0
    DATABASE_PATH: str = "./data/escrow.db"
    BOT_USERNAME: str = "EscrowDeskBot"
    SUPPORT_CONTACT: str = "@invisibleghostshell"
    BRAND_NAME: str = "EscrowDesk"
    DEALS_CHANNEL_ID: str = ""

    # Real EscrowDesk receiving wallets (leave empty to disable a network)
    WALLET_BTC: str = ""
    WALLET_LTC: str = ""
    WALLET_TRC20: str = ""
    WALLET_ERC20: str = ""
    WALLET_BEP20: str = ""
    WALLET_TON: str = ""

    API_ID: str = ""
    API_HASH: str = ""
    USERBOT_SESSION: str = "escrowdesk_userbot"

    @property
    def ADMIN_IDS(self) -> List[int]:
        return [int(x.strip()) for x in self.ADMIN_IDS_RAW.split(",") if x.strip().isdigit()]

    def escrow_address(self, network: str) -> str:
        return (getattr(self, f"WALLET_{network}", "") or "").strip()

    @property
    def userbot_enabled(self) -> bool:
        return bool(self.API_ID and self.API_HASH and self.API_ID.isdigit())


settings = Settings()


class DealStatus:
    CREATED = "created"
    WAITING_ROLES = "waiting_roles"
    WAITING_DEPOSIT = "waiting_deposit"
    FUNDED = "funded"
    COMPLETED = "completed"
    REFUNDED = "refunded"
    DISPUTED = "disputed"
    CANCELLED = "cancelled"
