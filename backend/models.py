"""Database models."""

import uuid
from datetime import datetime
from sqlalchemy import String, DateTime, Text, Float, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column, relationship

from database import Base


class Voice(Base):
    """A cloned voice with its reference audio."""
    
    __tablename__ = "voices"
    
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    reference_path: Mapped[str] = mapped_column(String(500), nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    
    def to_dict(self):
        """Convert to dictionary for JSON response."""
        return {
            "id": self.id,
            "name": self.name,
            "created_at": self.created_at.isoformat() if self.created_at else None
        }


class Generation(Base):
    """A generated speech with its metadata."""
    
    __tablename__ = "generations"
    
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    voice_id: Mapped[str] = mapped_column(String(36), ForeignKey("voices.id", ondelete="CASCADE"), nullable=False)
    text: Mapped[str] = mapped_column(Text, nullable=False)
    audio_path: Mapped[str] = mapped_column(String(500), nullable=False)
    duration_seconds: Mapped[float] = mapped_column(Float, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    
    # Relationship
    voice = relationship("Voice", backref="generations")
    
    def to_dict(self):
        """Convert to dictionary for JSON response."""
        return {
            "id": self.id,
            "voice_id": self.voice_id,
            "voice_name": self.voice.name if self.voice else None,
            "text": self.text,
            "audio_path": self.audio_path,
            "duration_seconds": self.duration_seconds,
            "created_at": self.created_at.isoformat() if self.created_at else None
        }
