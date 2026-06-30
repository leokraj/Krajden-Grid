from fastapi import FastAPI, APIRouter, HTTPException, Request, Response, UploadFile, File
from fastapi.responses import FileResponse, StreamingResponse
from fastapi.staticfiles import StaticFiles
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import socketio
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field, ConfigDict
from typing import List, Optional
import uuid
import base64
import io
from datetime import datetime, timezone
from contextlib import asynccontextmanager

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

# Import Socket.IO server from sessions module
from sessions import sio

# Import and init auth module
from auth import auth_router, init_db as init_auth_db

# Import licensing module
from licensing import license_router, db as _lic_db
import licensing

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup - init auth DB
    init_auth_db(db)
    # Init licensing DB
    licensing.db = db
    licensing.stripe_api_key = os.environ.get("STRIPE_API_KEY")
    yield
    # Shutdown
    client.close()

# Create the main FastAPI app
fastapi_app = FastAPI(title="OverGrid API", version="1.0.0", lifespan=lifespan)

# Create ASGI app that combines FastAPI and Socket.IO
# Mount socket.io at /api/socket.io to work with ingress routing
app = socketio.ASGIApp(sio, other_asgi_app=fastapi_app, socketio_path='/api/socket.io')

# Create a router with the /api prefix
api_router = APIRouter(prefix="/api")

# === MODELS ===

class GridSettings(BaseModel):
    model_config = ConfigDict(extra="ignore")
    
    screen_width: int = Field(default=1920, ge=100, le=10000)
    screen_height: int = Field(default=1080, ge=100, le=10000)
    unit_width: int = Field(default=66, ge=1, le=1000)
    unit_height: int = Field(default=33, ge=1, le=1000)
    grid_color: str = Field(default="#00F0FF")
    line_thickness: float = Field(default=1.0, ge=0.1, le=10.0)
    opacity: float = Field(default=0.3, ge=0.0, le=1.0)
    show_subdivisions: bool = Field(default=False)
    subdivision_count: int = Field(default=2, ge=2, le=10)

class PresetBase(BaseModel):
    name: str = Field(..., min_length=1, max_length=100)
    description: Optional[str] = Field(default="", max_length=500)
    settings: GridSettings

class PresetCreate(PresetBase):
    pass

class Preset(PresetBase):
    model_config = ConfigDict(extra="ignore")
    
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    created_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())
    updated_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())

class PresetUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=100)
    description: Optional[str] = Field(None, max_length=500)
    settings: Optional[GridSettings] = None

class Measurement(BaseModel):
    model_config = ConfigDict(extra="ignore")
    
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    start_x: float
    start_y: float
    end_x: float
    end_y: float
    pixel_distance: float
    unit_distance: float
    unit_label: str = "units"
    created_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())

class MeasurementCreate(BaseModel):
    start_x: float
    start_y: float
    end_x: float
    end_y: float
    pixel_distance: float
    unit_distance: float
    unit_label: str = "units"

# === API ROUTES ===

@api_router.get("/")
async def root():
    return {"message": "OverGrid API is running", "version": "1.0.0"}

@api_router.get("/health")
async def health_check():
    return {"status": "healthy", "timestamp": datetime.now(timezone.utc).isoformat()}

@api_router.get("/debug/sessions")
async def debug_sessions():
    """Debug endpoint to inspect active sessions"""
    from sessions import sessions as active_sessions
    result = {}
    for code, s in active_sessions.items():
        result[code] = {
            "host_name": s.get("host_name"),
            "host_sid": s.get("host_sid"),
            "host_disconnected": s.get("host_disconnected", False),
            "disconnect_version": s.get("disconnect_version", 0),
            "guest_count": len(s.get("guests", [])),
            "max_guests": s.get("max_guests"),
            "created_at": s.get("created_at"),
            "last_activity": s.get("last_activity"),
        }
    return {"active_sessions": result, "count": len(result)}

@api_router.get("/download/{filename}")
async def download_file(filename: str):
    downloads_dir = ROOT_DIR / "downloads"
    file_path = downloads_dir / filename
    if not file_path.exists() or not file_path.is_file():
        raise HTTPException(status_code=404, detail="File not found")
    file_size = file_path.stat().st_size

    def iter_file():
        with open(file_path, "rb") as f:
            while chunk := f.read(1024 * 1024):
                yield chunk

    return StreamingResponse(
        iter_file(),
        media_type="application/octet-stream",
        headers={
            "Content-Disposition": f'attachment; filename="{filename}"',
            "Content-Length": str(file_size),
        },
    )

# === Video Upload ===
VIDEOS_DIR = ROOT_DIR / "uploads" / "videos"
VIDEOS_DIR.mkdir(parents=True, exist_ok=True)
ALLOWED_VIDEO_TYPES = {"video/mp4", "video/webm", "video/ogg", "video/quicktime"}
MAX_VIDEO_SIZE = 200 * 1024 * 1024  # 200MB

@api_router.post("/upload-video")
async def upload_video(file: UploadFile = File(...)):
    """Upload a video file and return its URL"""
    if file.content_type not in ALLOWED_VIDEO_TYPES:
        raise HTTPException(status_code=400, detail=f"Unsupported video type: {file.content_type}. Use mp4, webm, or ogg.")
    ext = file.filename.rsplit('.', 1)[-1] if '.' in file.filename else 'mp4'
    video_id = f"{uuid.uuid4()}.{ext}"
    video_path = VIDEOS_DIR / video_id
    total = 0
    with open(video_path, "wb") as f:
        while chunk := await file.read(1024 * 1024):
            total += len(chunk)
            if total > MAX_VIDEO_SIZE:
                video_path.unlink(missing_ok=True)
                raise HTTPException(status_code=413, detail="Video too large (max 200MB)")
            f.write(chunk)
    return {"video_url": f"/api/videos/{video_id}", "filename": file.filename, "size": total}

@api_router.get("/videos/{video_id}")
async def serve_video(video_id: str, request: Request):
    """Serve uploaded video with range request support"""
    video_path = VIDEOS_DIR / video_id
    if not video_path.exists():
        raise HTTPException(status_code=404, detail="Video not found")
    ext = video_id.rsplit('.', 1)[-1]
    media_types = {"mp4": "video/mp4", "webm": "video/webm", "ogg": "video/ogg", "mov": "video/quicktime"}
    media_type = media_types.get(ext, "video/mp4")
    return FileResponse(path=str(video_path), media_type=media_type, headers={"Accept-Ranges": "bytes", "Cache-Control": "public, max-age=86400"})

# Presets CRUD
@api_router.get("/presets", response_model=List[Preset])
async def get_presets():
    presets = await db.presets.find({}, {"_id": 0}).to_list(100)
    return presets

@api_router.get("/presets/{preset_id}", response_model=Preset)
async def get_preset(preset_id: str):
    preset = await db.presets.find_one({"id": preset_id}, {"_id": 0})
    if not preset:
        raise HTTPException(status_code=404, detail="Preset not found")
    return preset

@api_router.post("/presets", response_model=Preset)
async def create_preset(preset_data: PresetCreate):
    preset = Preset(
        name=preset_data.name,
        description=preset_data.description,
        settings=preset_data.settings
    )
    doc = preset.model_dump()
    await db.presets.insert_one(doc)
    return preset

@api_router.put("/presets/{preset_id}", response_model=Preset)
async def update_preset(preset_id: str, preset_update: PresetUpdate):
    existing = await db.presets.find_one({"id": preset_id}, {"_id": 0})
    if not existing:
        raise HTTPException(status_code=404, detail="Preset not found")
    
    update_data = preset_update.model_dump(exclude_unset=True)
    if update_data:
        update_data["updated_at"] = datetime.now(timezone.utc).isoformat()
        # Handle nested settings update
        if "settings" in update_data and update_data["settings"]:
            update_data["settings"] = update_data["settings"].model_dump() if hasattr(update_data["settings"], 'model_dump') else update_data["settings"]
        await db.presets.update_one({"id": preset_id}, {"$set": update_data})
    
    updated = await db.presets.find_one({"id": preset_id}, {"_id": 0})
    return updated

@api_router.delete("/presets/{preset_id}")
async def delete_preset(preset_id: str):
    result = await db.presets.delete_one({"id": preset_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Preset not found")
    return {"message": "Preset deleted successfully", "id": preset_id}

# Measurements
@api_router.get("/measurements", response_model=List[Measurement])
async def get_measurements():
    measurements = await db.measurements.find({}, {"_id": 0}).to_list(100)
    return measurements

@api_router.post("/measurements", response_model=Measurement)
async def save_measurement(measurement_data: MeasurementCreate):
    measurement = Measurement(**measurement_data.model_dump())
    doc = measurement.model_dump()
    await db.measurements.insert_one(doc)
    return measurement

@api_router.delete("/measurements/{measurement_id}")
async def delete_measurement(measurement_id: str):
    result = await db.measurements.delete_one({"id": measurement_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Measurement not found")
    return {"message": "Measurement deleted successfully", "id": measurement_id}

# Default preset
@api_router.get("/default-settings", response_model=GridSettings)
async def get_default_settings():
    return GridSettings()

# === COMMUNITY CLIPART LIBRARY ===

# Import auth helper
from auth import get_current_user, require_auth

class CommunityClipartUpload(BaseModel):
    model_config = ConfigDict(extra="ignore")
    name: str = Field(..., min_length=1, max_length=100)
    category: str = Field(default="other")
    image_data: str = Field(...)
    tags: List[str] = Field(default=[])

class CommunityClipartResponse(BaseModel):
    id: str
    name: str
    category: str
    image_data: str
    tags: List[str]
    uploaded_by: str
    uploaded_by_id: Optional[str] = None
    created_at: str
    downloads: int

class CommunityClipartListItem(BaseModel):
    id: str
    name: str
    category: str
    tags: List[str]
    uploaded_by: str
    uploaded_by_id: Optional[str] = None
    created_at: str
    downloads: int

def clipart_doc_to_response(c: dict) -> CommunityClipartResponse:
    return CommunityClipartResponse(
        id=c.get("id", ""),
        name=c.get("name", "Unknown"),
        category=c.get("category", "other"),
        image_data=c.get("image_data", ""),
        tags=c.get("tags", []),
        uploaded_by=c.get("uploaded_by", "Anonymous"),
        uploaded_by_id=c.get("uploaded_by_id"),
        created_at=c.get("created_at", ""),
        downloads=c.get("downloads", 0),
    )

def clipart_doc_to_list_item(c: dict) -> CommunityClipartListItem:
    return CommunityClipartListItem(
        id=c.get("id", ""),
        name=c.get("name", "Unknown"),
        category=c.get("category", "other"),
        tags=c.get("tags", []),
        uploaded_by=c.get("uploaded_by", "Anonymous"),
        uploaded_by_id=c.get("uploaded_by_id"),
        created_at=c.get("created_at", ""),
        downloads=c.get("downloads", 0),
    )

@api_router.get("/community-cliparts", response_model=List[CommunityClipartListItem])
async def get_community_cliparts(
    category: Optional[str] = None,
    search: Optional[str] = None,
    sort: str = "popular",
    limit: int = 50,
):
    """Get community uploaded cliparts (no auth required) — lightweight list without image data"""
    query = {}
    if category and category != "all":
        query["category"] = category
    if search:
        query["$or"] = [
            {"name": {"$regex": search, "$options": "i"}},
            {"tags": {"$regex": search, "$options": "i"}},
        ]

    sort_field = {"popular": ("downloads", -1), "recent": ("created_at", -1), "name": ("name", 1)}
    sf, sd = sort_field.get(sort, ("downloads", -1))

    cliparts = await db.community_cliparts.find(query, {"_id": 0, "image_data": 0}).sort(sf, sd).limit(limit).to_list(limit)
    return [clipart_doc_to_list_item(c) for c in cliparts]

@api_router.get("/community-cliparts/{clipart_id}", response_model=CommunityClipartResponse)
async def get_community_clipart(clipart_id: str):
    """Get single community clipart with full image data"""
    clipart = await db.community_cliparts.find_one({"id": clipart_id}, {"_id": 0})
    if not clipart:
        raise HTTPException(status_code=404, detail="Clipart not found")
    return clipart_doc_to_response(clipart)

@api_router.get("/community-cliparts/my", response_model=List[CommunityClipartListItem])
async def get_my_community_cliparts(request: Request):
    """Get cliparts uploaded by the current user"""
    user = await require_auth(request)
    cliparts = await db.community_cliparts.find(
        {"uploaded_by_id": user["user_id"]}, {"_id": 0, "image_data": 0}
    ).sort("created_at", -1).to_list(100)
    return [clipart_doc_to_list_item(c) for c in cliparts]

@api_router.post("/community-cliparts", response_model=CommunityClipartResponse)
async def upload_community_clipart(clipart: CommunityClipartUpload, request: Request):
    """Upload a clipart to the community library (auth required)"""
    user = await require_auth(request)
    clipart_id = str(uuid.uuid4())

    doc = {
        "id": clipart_id,
        "name": clipart.name,
        "category": clipart.category,
        "image_data": clipart.image_data,
        "tags": clipart.tags,
        "uploaded_by": user["name"],
        "uploaded_by_id": user["user_id"],
        "created_at": datetime.now(timezone.utc).isoformat(),
        "downloads": 0,
    }
    await db.community_cliparts.insert_one(doc)
    return clipart_doc_to_response(doc)

@api_router.delete("/community-cliparts/{clipart_id}")
async def delete_community_clipart(clipart_id: str, request: Request):
    """Delete a community clipart (only by owner)"""
    user = await require_auth(request)
    clipart = await db.community_cliparts.find_one({"id": clipart_id}, {"_id": 0})
    if not clipart:
        raise HTTPException(status_code=404, detail="Clipart not found")
    if clipart.get("uploaded_by_id") != user["user_id"]:
        raise HTTPException(status_code=403, detail="You can only delete your own cliparts")
    await db.community_cliparts.delete_one({"id": clipart_id})
    return {"message": "Clipart deleted", "id": clipart_id}

@api_router.post("/community-cliparts/{clipart_id}/download")
async def increment_download_count(clipart_id: str):
    """Increment download count for a clipart"""
    result = await db.community_cliparts.update_one(
        {"id": clipart_id}, {"$inc": {"downloads": 1}}
    )
    if result.modified_count == 0:
        raise HTTPException(status_code=404, detail="Clipart not found")
    return {"success": True}

@api_router.get("/community-cliparts/{clipart_id}/thumbnail")
async def get_clipart_thumbnail(clipart_id: str, size: int = 80):
    """Get a small thumbnail of a community clipart"""
    clipart = await db.community_cliparts.find_one({"id": clipart_id}, {"_id": 0, "image_data": 1})
    if not clipart or not clipart.get("image_data"):
        raise HTTPException(status_code=404, detail="Clipart not found")
    try:
        from PIL import Image as PILImage
        data_str = clipart["image_data"]
        if "," in data_str:
            data_str = data_str.split(",", 1)[1]
        img_bytes = base64.b64decode(data_str)
        img = PILImage.open(io.BytesIO(img_bytes))
        img.thumbnail((size, size), PILImage.LANCZOS)
        # Convert palette/other modes to RGBA for PNG output
        if img.mode not in ("RGB", "RGBA"):
            img = img.convert("RGBA")
        buf = io.BytesIO()
        img.save(buf, format="PNG", quality=60)
        buf.seek(0)
        return Response(content=buf.getvalue(), media_type="image/png", headers={"Cache-Control": "public, max-age=86400"})
    except Exception as e:
        logging.error(f"Thumbnail generation failed: {e}")
        raise HTTPException(status_code=500, detail="Thumbnail generation failed")

# === Image Layouts (Save/Load) ===

class ImageLayoutLayer(BaseModel):
    model_config = ConfigDict(extra="ignore")
    name: str = ""
    imageData: str = ""
    x: float = 0
    y: float = 0
    scale: float = 300
    rotation: float = 0
    opacity: float = 100
    visible: bool = True

class ImageLayoutCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=100)
    layers: List[ImageLayoutLayer]

@api_router.post("/image-layouts")
async def save_image_layout(body: ImageLayoutCreate, request: Request):
    from auth import require_auth
    user = await require_auth(request)
    layout = {
        "id": str(uuid.uuid4()),
        "user_id": user["user_id"],
        "name": body.name,
        "layers": [l.model_dump() for l in body.layers],
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.image_layouts.insert_one(layout)
    return {"id": layout["id"], "name": layout["name"], "created_at": layout["created_at"], "layer_count": len(layout["layers"])}

@api_router.get("/image-layouts")
async def list_image_layouts(request: Request):
    from auth import require_auth
    user = await require_auth(request)
    cursor = db.image_layouts.find({"user_id": user["user_id"]}, {"_id": 0, "layers": 0}).sort("created_at", -1)
    layouts = await cursor.to_list(100)
    return {"layouts": layouts}

@api_router.get("/image-layouts/{layout_id}")
async def get_image_layout(layout_id: str, request: Request):
    from auth import require_auth
    user = await require_auth(request)
    layout = await db.image_layouts.find_one({"id": layout_id, "user_id": user["user_id"]}, {"_id": 0})
    if not layout:
        raise HTTPException(status_code=404, detail="Layout not found")
    return layout

@api_router.delete("/image-layouts/{layout_id}")
async def delete_image_layout(layout_id: str, request: Request):
    from auth import require_auth
    user = await require_auth(request)
    result = await db.image_layouts.delete_one({"id": layout_id, "user_id": user["user_id"]})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Layout not found")
    return {"success": True}

# Mount license routes under /api
api_router.include_router(license_router)

# Include the routers in the main app
fastapi_app.include_router(auth_router)
fastapi_app.include_router(api_router)

# Stripe webhook (must be at /api/webhook/stripe)
@api_router.post("/webhook/stripe")
async def stripe_webhook(request: Request):
    """Handle Stripe payment webhooks"""
    from emergentintegrations.payments.stripe.checkout import StripeCheckout
    try:
        body = await request.body()
        sig = request.headers.get("Stripe-Signature")
        api_key = os.environ.get("STRIPE_API_KEY")
        host_url = str(request.base_url).rstrip("/")
        webhook_url = f"{host_url}api/webhook/stripe"
        checkout = StripeCheckout(api_key=api_key, webhook_url=webhook_url)
        event = await checkout.handle_webhook(body, sig)
        logging.info(f"Stripe webhook: {event.event_type} session={event.session_id} status={event.payment_status}")
        # Update transaction if found
        if event.session_id:
            await db.payment_transactions.update_one(
                {"session_id": event.session_id},
                {"$set": {"status": event.event_type, "payment_status": event.payment_status or "unknown"}}
            )
        return {"status": "ok"}
    except Exception as e:
        logging.error(f"Stripe webhook error: {e}")
        return {"status": "error", "detail": str(e)}

fastapi_app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["*"],
    allow_headers=["*"],
)

# Serve production React build for Electron desktop (no HMR WebSocket = stable)
# Build is stored in backend/frontend-build/ to avoid CRA dev server interference
FRONTEND_BUILD_DIR = ROOT_DIR / 'frontend-build'
if FRONTEND_BUILD_DIR.exists():
    from starlette.responses import HTMLResponse

    # Serve static assets (JS, CSS, images) under /api/app-stable/static/
    if (FRONTEND_BUILD_DIR / "static").exists():
        fastapi_app.mount("/api/app-stable/static", StaticFiles(directory=str(FRONTEND_BUILD_DIR / "static")), name="react-static")

    @fastapi_app.get("/api/app-stable/{rest_of_path:path}")
    async def serve_react_app(rest_of_path: str):
        """Serve the production React build for Electron windows.
        This avoids the CRA dev server's HMR WebSocket which causes periodic reloads."""
        # Try to serve the exact file if it exists
        file_path = FRONTEND_BUILD_DIR / rest_of_path
        if rest_of_path and file_path.exists() and file_path.is_file():
            return FileResponse(str(file_path))
        # Otherwise serve index.html (React Router handles client-side routing)
        return HTMLResponse((FRONTEND_BUILD_DIR / "index.html").read_text())

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)
