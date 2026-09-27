from pydantic_settings import BaseSettings, SettingsConfigDict
from typing import List
from dotenv import load_dotenv

load_dotenv()


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    BOT_TOKEN: str = ""
    ADMIN_IDS_RAW: str = "0"
    SIMULATION_MODE: bool = True
    FEE_PERCENT: float = 5.0
    MIN_FEE_USD: float = 5.0
    DATABASE_PATH: str = "./data/escrow.db"
    BOT_USERNAME: str = "EscrowDeskBot"
    SUPPORT_CONTACT: str = "@invisibleghostshell"
    BRAND_NAME: str = "EscrowDesk"

    API_ID: str = ""
    API_HASH: str = ""
    USERBOT_SESSION: str = "escrowdesk_userbot"

    @property
    def ADMIN_IDS(self) -> List[int]:
        return [int(x.strip()) for x in self.ADMIN_IDS_RAW.split(",") if x.strip().isdigit()]

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
