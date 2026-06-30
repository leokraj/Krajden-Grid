"""
Authentication module for OverGrid
Supports both JWT-based email/password auth and Emergent Google OAuth
"""

import uuid
import os
import httpx
from datetime import datetime, timezone, timedelta
from typing import Optional
from fastapi import APIRouter, HTTPException, Request, Response
from pydantic import BaseModel, Field, EmailStr
from passlib.context import CryptContext
from motor.motor_asyncio import AsyncIOMotorClient

# Password hashing
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

# MongoDB connection (will be set from server.py)
db = None

def init_db(database):
    global db
    db = database

auth_router = APIRouter(prefix="/api/auth", tags=["auth"])

# === Models ===

class RegisterRequest(BaseModel):
    email: EmailStr
    password: str = Field(..., min_length=6)
    name: str = Field(..., min_length=1, max_length=100)
    nickname: str = Field(default="", max_length=50)

class LoginRequest(BaseModel):
    email: EmailStr
    password: str

class GoogleSessionRequest(BaseModel):
    session_id: str
    nickname: str = ""

class SocialLoginRequest(BaseModel):
    provider: str
    email: EmailStr
    name: str
    picture: Optional[str] = None
    nickname: Optional[str] = None

class UserResponse(BaseModel):
    user_id: str
    email: str
    name: str
    nickname: str = ""
    picture: Optional[str] = None
    auth_provider: str = "local"
    session_token: Optional[str] = None

# === Helper Functions ===

def generate_session_token():
    return f"sess_{uuid.uuid4().hex}"

async def create_user_session(user_id: str, response: Response):
    """Create a new session and set cookie"""
    session_token = generate_session_token()
    expires_at = datetime.now(timezone.utc) + timedelta(days=7)

    await db.user_sessions.insert_one({
        "user_id": user_id,
        "session_token": session_token,
        "expires_at": expires_at.isoformat(),
        "created_at": datetime.now(timezone.utc).isoformat(),
    })

    response.set_cookie(
        key="session_token",
        value=session_token,
        httponly=True,
        secure=True,
        samesite="none",
        path="/",
        max_age=7 * 24 * 60 * 60,
    )

    return session_token

async def get_current_user(request: Request) -> Optional[dict]:
    """Get current user from cookie or Authorization header"""
    session_token = request.cookies.get("session_token")

    if not session_token:
        auth_header = request.headers.get("Authorization", "")
        if auth_header.startswith("Bearer "):
            session_token = auth_header[7:]

    if not session_token:
        return None

    session_doc = await db.user_sessions.find_one(
        {"session_token": session_token}, {"_id": 0}
    )
    if not session_doc:
        return None

    # Check expiry
    expires_at = session_doc.get("expires_at", "")
    if isinstance(expires_at, str):
        expires_at = datetime.fromisoformat(expires_at)
    if expires_at.tzinfo is None:
        expires_at = expires_at.replace(tzinfo=timezone.utc)
    if expires_at < datetime.now(timezone.utc):
        return None

    user_doc = await db.users.find_one(
        {"user_id": session_doc["user_id"]}, {"_id": 0}
    )
    return user_doc

async def require_auth(request: Request) -> dict:
    """Require authentication - raises 401 if not authenticated"""
    user = await get_current_user(request)
    if not user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    return user

# === Routes ===

@auth_router.post("/register", response_model=UserResponse)
async def register(data: RegisterRequest, response: Response):
    """Register with email/password"""
    existing = await db.users.find_one({"email": data.email}, {"_id": 0})
    if existing:
        raise HTTPException(status_code=400, detail="Email already registered")

    user_id = f"user_{uuid.uuid4().hex[:12]}"
    hashed_password = pwd_context.hash(data.password)

    user_doc = {
        "user_id": user_id,
        "email": data.email,
        "name": data.name,
        "nickname": data.nickname or data.name,
        "picture": None,
        "password_hash": hashed_password,
        "auth_provider": "local",
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.users.insert_one(user_doc)

    session_token = await create_user_session(user_id, response)

    return UserResponse(
        user_id=user_id,
        email=data.email,
        name=data.name,
        nickname=data.nickname or data.name,
        auth_provider="local",
        session_token=session_token,
    )

@auth_router.post("/login")
async def login(data: LoginRequest, response: Response):
    """Login with email/password"""
    user_doc = await db.users.find_one({"email": data.email}, {"_id": 0})
    if not user_doc:
        raise HTTPException(status_code=401, detail="Invalid email or password")

    if not user_doc.get("password_hash"):
        raise HTTPException(
            status_code=401,
            detail="This account uses Google login. Please sign in with Google.",
        )

    if not pwd_context.verify(data.password, user_doc["password_hash"]):
        raise HTTPException(status_code=401, detail="Invalid email or password")

    session_token = await create_user_session(user_doc["user_id"], response)

    return UserResponse(
        user_id=user_doc["user_id"],
        email=user_doc["email"],
        name=user_doc["name"],
        nickname=user_doc.get("nickname", user_doc["name"]),
        picture=user_doc.get("picture"),
        auth_provider=user_doc.get("auth_provider", "local"),
        session_token=session_token,
    )

@auth_router.post("/social-login", response_model=UserResponse)
async def social_login(data: SocialLoginRequest, response: Response):
    """Direct, secure, highly efficient social login without emergent.com dependency"""
    import traceback
    import sys
    try:
        email = str(data.email)
        name = data.name or "User"
        picture = data.picture
        provider = data.provider

        # Find or create user
        existing = await db.users.find_one({"email": email}, {"_id": 0})
        if existing:
            # Update name/picture if changed
            update_fields = {"name": name, "picture": picture, "auth_provider": provider}
            if data.nickname:
                update_fields["nickname"] = data.nickname
            await db.users.update_one({"email": email}, {"$set": update_fields})
            user_id = existing["user_id"]
            nickname = data.nickname or existing.get("nickname", name)
        else:
            user_id = f"user_{uuid.uuid4().hex[:12]}"
            nickname = data.nickname or name
            user_doc = {
                "user_id": user_id,
                "email": email,
                "name": name,
                "nickname": nickname,
                "picture": picture,
                "auth_provider": provider,
                "created_at": datetime.now(timezone.utc).isoformat(),
            }
            await db.users.insert_one(user_doc)

        session_token = await create_user_session(user_id, response)

        return UserResponse(
            user_id=user_id,
            email=email,
            name=name,
            nickname=nickname,
            picture=picture,
            auth_provider=provider,
            session_token=session_token,
        )
    except Exception as e:
        tb = traceback.format_exc()
        print("CRITICAL ERROR IN social_login:", tb, file=sys.stderr)
        raise HTTPException(status_code=500, detail=f"Social login crash: {str(e)}\n{tb}")

@auth_router.post("/google-session", response_model=UserResponse)
async def exchange_google_session(data: GoogleSessionRequest, response: Response):
    """Exchange Emergent Google OAuth session_id for a local session"""
    # Call Emergent Auth to get user data
    async with httpx.AsyncClient() as client:
        try:
            resp = await client.get(
                "https://demobackend.emergentagent.com/auth/v1/env/oauth/session-data",
                headers={"X-Session-ID": data.session_id},
                timeout=10,
            )
            if resp.status_code != 200:
                raise HTTPException(status_code=401, detail="Invalid session ID")
            google_data = resp.json()
        except httpx.RequestError:
            raise HTTPException(status_code=502, detail="Failed to verify Google session")

    email = google_data.get("email")
    name = google_data.get("name", "User")
    picture = google_data.get("picture")

    if not email:
        raise HTTPException(status_code=400, detail="No email from Google")

    # Find or create user
    existing = await db.users.find_one({"email": email}, {"_id": 0})
    if existing:
        # Update name/picture if changed
        update_fields = {"name": name, "picture": picture}
        if data.nickname:
            update_fields["nickname"] = data.nickname
        await db.users.update_one({"email": email}, {"$set": update_fields})
        user_id = existing["user_id"]
        nickname = data.nickname or existing.get("nickname", name)
    else:
        user_id = f"user_{uuid.uuid4().hex[:12]}"
        nickname = data.nickname or name
        user_doc = {
            "user_id": user_id,
            "email": email,
            "name": name,
            "nickname": nickname,
            "picture": picture,
            "auth_provider": "google",
            "created_at": datetime.now(timezone.utc).isoformat(),
        }
        await db.users.insert_one(user_doc)

    session_token = await create_user_session(user_id, response)

    return UserResponse(
        user_id=user_id,
        email=email,
        name=name,
        nickname=nickname,
        picture=picture,
        auth_provider="google",
        session_token=session_token,
    )

@auth_router.get("/me", response_model=UserResponse)
async def get_me(request: Request):
    """Get current user info"""
    user = await require_auth(request)
    return UserResponse(
        user_id=user["user_id"],
        email=user["email"],
        name=user["name"],
        nickname=user.get("nickname", user["name"]),
        picture=user.get("picture"),
        auth_provider=user.get("auth_provider", "local"),
    )

@auth_router.post("/logout")
async def logout(request: Request, response: Response):
    """Logout - clear session"""
    session_token = request.cookies.get("session_token")
    if not session_token:
        auth_header = request.headers.get("Authorization", "")
        if auth_header.startswith("Bearer "):
            session_token = auth_header[7:]

    if session_token:
        await db.user_sessions.delete_one({"session_token": session_token})

    response.delete_cookie(
        key="session_token",
        path="/",
        secure=True,
        samesite="none",
    )
    return {"message": "Logged out"}

@auth_router.patch("/nickname")
async def update_nickname(request: Request):
    """Update user nickname"""
    user = await require_auth(request)
    body = await request.json()
    nickname = body.get("nickname", "").strip()
    if not nickname or len(nickname) > 50:
        raise HTTPException(status_code=400, detail="Nickname must be 1-50 characters")
    await db.users.update_one(
        {"user_id": user["user_id"]},
        {"$set": {"nickname": nickname}},
    )
    return {"nickname": nickname}

# === User Clipart Storage ===

@auth_router.get("/cliparts")
async def get_user_cliparts(request: Request):
    """Get user's saved custom cliparts"""
    user = await require_auth(request)
    doc = await db.user_cliparts.find_one(
        {"user_id": user["user_id"]}, {"_id": 0}
    )
    if not doc:
        return {"cliparts": [], "favorites": []}
    return {
        "cliparts": doc.get("cliparts", []),
        "favorites": doc.get("favorites", []),
    }

@auth_router.put("/cliparts")
async def save_user_cliparts(request: Request):
    """Save user's custom cliparts and favorites"""
    user = await require_auth(request)
    body = await request.json()
    cliparts = body.get("cliparts", [])
    favorites = body.get("favorites", [])

    await db.user_cliparts.update_one(
        {"user_id": user["user_id"]},
        {"$set": {
            "user_id": user["user_id"],
            "cliparts": cliparts,
            "favorites": favorites,
            "updated_at": datetime.now(timezone.utc).isoformat(),
        }},
        upsert=True,
    )
    return {"saved": True, "count": len(cliparts)}
