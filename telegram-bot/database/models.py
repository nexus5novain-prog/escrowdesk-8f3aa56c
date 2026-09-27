import aiosqlite
from typing import Optional, Dict, List
from config import settings, DealStatus
import time
import random
import string


class Database:
    def __init__(self, db_path: str = settings.DATABASE_PATH):
        self.db_path = db_path

    async def connect(self):
        import os
        os.makedirs(os.path.dirname(self.db_path) or ".", exist_ok=True)
        self.conn = await aiosqlite.connect(self.db_path)
        self.conn.row_factory = aiosqlite.Row
        await self.create_tables()

    async def close(self):
        if hasattr(self, "conn"):
            await self.conn.close()

    async def create_tables(self):
        await self.conn.executescript("""
            CREATE TABLE IF NOT EXISTS users (
                user_id INTEGER PRIMARY KEY,
                username TEXT,
                full_name TEXT,
                created_at INTEGER,
                total_deals INTEGER DEFAULT 0,
                successful_deals INTEGER DEFAULT 0,
                pin TEXT
            );

            CREATE TABLE IF NOT EXISTS deals (
                deal_id TEXT PRIMARY KEY,
                group_id INTEGER,
                group_link TEXT,
                creator_id INTEGER,
                buyer_id INTEGER,
                seller_id INTEGER,
                buyer_address TEXT,
                seller_address TEXT,
                amount REAL DEFAULT 0,
                currency TEXT DEFAULT 'USDT',
                network TEXT DEFAULT 'TRC20',
                status TEXT DEFAULT 'created',
                escrow_address TEXT,
                deposited_amount REAL DEFAULT 0,
                fee_amount REAL DEFAULT 0,
                created_at INTEGER,
                funded_at INTEGER,
                completed_at INTEGER
            );

            CREATE TABLE IF NOT EXISTS stats (
                key TEXT PRIMARY KEY,
                value INTEGER DEFAULT 0
            );
        """)
        # Init stats
        await self.conn.execute("INSERT OR IGNORE INTO stats (key, value) VALUES ('deals_completed', 0)")
        await self.conn.execute("INSERT OR IGNORE INTO stats (key, value) VALUES ('disputes_resolved', 0)")
        await self.conn.commit()

    async def get_or_create_user(self, user_id: int, username: str = None, full_name: str = None):
        async with self.conn.execute("SELECT * FROM users WHERE user_id = ?", (user_id,)) as c:
            row = await c.fetchone()
            if row:
                return dict(row)
        await self.conn.execute(
            "INSERT INTO users (user_id, username, full_name, created_at) VALUES (?, ?, ?, ?)",
            (user_id, username, full_name, int(time.time()))
        )
        await self.conn.commit()
        return {"user_id": user_id, "username": username, "full_name": full_name}

    def generate_deal_id(self) -> str:
        return ''.join(random.choices(string.ascii_lowercase + string.digits, k=5))

    async def create_deal(self, creator_id: int) -> Dict:
        deal_id = self.generate_deal_id()
        while await self.get_deal(deal_id):
            deal_id = self.generate_deal_id()
        await self.conn.execute(
            "INSERT INTO deals (deal_id, creator_id, status, created_at) VALUES (?, ?, ?, ?)",
            (deal_id, creator_id, DealStatus.CREATED, int(time.time()))
        )
        await self.conn.commit()
        return await self.get_deal(deal_id)

    async def get_deal(self, deal_id: str) -> Optional[Dict]:
        async with self.conn.execute("SELECT * FROM deals WHERE deal_id = ?", (deal_id,)) as c:
            row = await c.fetchone()
            return dict(row) if row else None

    async def get_deal_by_group(self, group_id: int) -> Optional[Dict]:
        async with self.conn.execute(
            "SELECT * FROM deals WHERE group_id = ? ORDER BY created_at DESC LIMIT 1", (group_id,)
        ) as c:
            row = await c.fetchone()
            return dict(row) if row else None

    async def update_deal(self, deal_id: str, **kwargs):
        if not kwargs:
            return
        fields = ", ".join(f"{k} = ?" for k in kwargs)
        values = list(kwargs.values()) + [deal_id]
        await self.conn.execute(f"UPDATE deals SET {fields} WHERE deal_id = ?", values)
        await self.conn.commit()

    async def get_stat(self, key: str) -> int:
        async with self.conn.execute("SELECT value FROM stats WHERE key = ?", (key,)) as c:
            row = await c.fetchone()
            return row["value"] if row else 0

    async def increment_stat(self, key: str, amount: int = 1):
        await self.conn.execute(
            "UPDATE stats SET value = value + ? WHERE key = ?", (amount, key)
        )
        await self.conn.commit()


db = Database()
