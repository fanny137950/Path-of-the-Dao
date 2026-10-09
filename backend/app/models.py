"""PostgreSQL foundation. Not the deployed D1 storage adapter."""
from sqlalchemy import String, Integer, Text, ForeignKey, ForeignKeyConstraint, UniqueConstraint, JSON
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column
from pgvector.sqlalchemy import Vector
class Base(DeclarativeBase): pass
class World(Base):
 __tablename__='worlds'
 id:Mapped[str]=mapped_column(String,primary_key=True)
 owner:Mapped[str]=mapped_column(String,index=True)
 revision:Mapped[int]=mapped_column(Integer,default=0)
 state:Mapped[dict]=mapped_column(JSON)
class Memory(Base):
 __tablename__='memories'
 world:Mapped[str]=mapped_column(ForeignKey('worlds.id'),primary_key=True)
 id:Mapped[str]=mapped_column(String,primary_key=True)
 layer:Mapped[int]=mapped_column(Integer)
 actor:Mapped[str|None]=mapped_column(String,nullable=True)
 minute:Mapped[int]=mapped_column(Integer,index=True)
 content:Mapped[str]=mapped_column(Text)
 provenance:Mapped[dict]=mapped_column(JSON)
 embedding:Mapped[list|None]=mapped_column(Vector(1536),nullable=True)
class Event(Base):
 __tablename__='events'
 world:Mapped[str]=mapped_column(ForeignKey('worlds.id'),primary_key=True)
 id:Mapped[str]=mapped_column(String,primary_key=True)
 minute:Mapped[int]=mapped_column(Integer,index=True)
 location:Mapped[str]=mapped_column(String)
 payload:Mapped[dict]=mapped_column(JSON)
class Knowledge(Base):
 __tablename__='knowledge'
 world:Mapped[str]=mapped_column(String,primary_key=True)
 actor:Mapped[str]=mapped_column(String,primary_key=True)
 event:Mapped[str]=mapped_column(String,primary_key=True)
 acquired:Mapped[int]=mapped_column(Integer)
 source:Mapped[str]=mapped_column(String)
 status:Mapped[str]=mapped_column(String)
 __table_args__=(ForeignKeyConstraint(['world','event'],['events.world','events.id']),)
class Turn(Base):
 __tablename__='turns'
 world:Mapped[str]=mapped_column(ForeignKey('worlds.id'),primary_key=True)
 request:Mapped[str]=mapped_column(String,primary_key=True)
 revision:Mapped[int]=mapped_column(Integer)
 result:Mapped[dict]=mapped_column(JSON)
 __table_args__=(UniqueConstraint('world','revision'),)
class Snapshot(Base):
 __tablename__='snapshots'
 world:Mapped[str]=mapped_column(ForeignKey('worlds.id'),primary_key=True)
 id:Mapped[str]=mapped_column(String,primary_key=True)
 revision:Mapped[int]=mapped_column(Integer)
 state:Mapped[dict]=mapped_column(JSON)
class Truth(Base):
 __tablename__='truths'
 world:Mapped[str]=mapped_column(ForeignKey('worlds.id'),primary_key=True)
 id:Mapped[str]=mapped_column(String,primary_key=True)
 digest:Mapped[str]=mapped_column(String)
 payload:Mapped[dict]=mapped_column(JSON)
