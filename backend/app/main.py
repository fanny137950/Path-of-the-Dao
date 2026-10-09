import os,hmac
from fastapi import FastAPI,Depends,HTTPException
from fastapi.security import HTTPBearer,HTTPAuthorizationCredentials
from sqlalchemy import create_engine,select
from sqlalchemy.orm import Session
from .models import Event,Knowledge,World
app=FastAPI(title='問道九州 native backend foundation')
bearer=HTTPBearer()
def authorize(auth:HTTPAuthorizationCredentials=Depends(bearer)):
 token=os.getenv('DEV_BEARER_TOKEN','')
 if not token or not hmac.compare_digest(auth.credentials,token):raise HTTPException(401,'Configure DEV_BEARER_TOKEN; development authentication only')
 return os.getenv('DEV_OWNER','local-developer')
def session():
 url=os.getenv('DATABASE_URL')
 if not url:raise HTTPException(503,'DATABASE_URL is not configured')
 with Session(create_engine(url,pool_pre_ping=True)) as db:yield db
@app.get('/health')
def health():return {'status':'foundation','simulation_adapter':'not-connected','production_auth':'not-implemented'}
@app.get('/worlds/{world}/memory')
def memory(world:str,owner=Depends(authorize),db:Session=Depends(session)):
 owned=db.scalar(select(World).where(World.id==world,World.owner==owner))
 if not owned:raise HTTPException(404,'World not found')
 rows=db.scalars(select(Event).join(Knowledge,(Event.world==Knowledge.world)&(Event.id==Knowledge.event)).where(Event.world==world,Knowledge.actor=='player').order_by(Event.minute)).all()
 return {'events':[r.payload for r in rows]}
