"""Database setup with SQLAlchemy async."""

from sqlalchemy import text
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker, AsyncSession
from sqlalchemy.orm import DeclarativeBase

from config import DATABASE_URL

# Create async engine
engine = create_async_engine(DATABASE_URL, echo=False)

# Session factory (exported for background tasks)
async_session_factory = async_sessionmaker(
    engine, class_=AsyncSession, expire_on_commit=False
)

# Alias for backward compatibility
async_session = async_session_factory


class Base(DeclarativeBase):
    """Base class for all models."""

    pass


async def create_tables():
    """Create all database tables and run migrations."""
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    # Migrate existing tables — add columns that may not exist yet.
    # Each ALTER TABLE is wrapped in try/except so it's safe to re-run.
    migrations = [
        "ALTER TABLE voices ADD COLUMN reference_transcript TEXT",
        "ALTER TABLE voices ADD COLUMN language VARCHAR(20) NOT NULL DEFAULT 'Auto'",
        "ALTER TABLE voices ADD COLUMN source VARCHAR(20) NOT NULL DEFAULT 'uploaded'",
        "ALTER TABLE voices ADD COLUMN description TEXT",
        "ALTER TABLE generations ADD COLUMN language VARCHAR(20) NOT NULL DEFAULT 'Auto'",
    ]
    async with engine.begin() as conn:
        for stmt in migrations:
            try:
                await conn.execute(text(stmt))
            except Exception:
                pass  # Column already exists


async def get_session() -> AsyncSession:
    """Dependency for getting database sessions."""
    async with async_session() as session:
        yield session
