from fastapi import FastAPI, HTTPException, WebSocket
from fastapi.middleware.cors import CORSMiddleware
import asyncio
import cv2
import numpy as np
import base64
from typing import List, Optional
from pydantic import BaseModel, Field
from eyetrax import GazeEstimator

app = FastAPI()


class HeatmapPoint(BaseModel):
    x: float
    y: float
    weight: Optional[float] = Field(default=None, ge=0)
    blink: Optional[bool] = None
    timestamp: Optional[float] = None
    region: Optional[str] = None


class HeatmapRequest(BaseModel):
    points: List[HeatmapPoint]
    width: int = Field(default=640, ge=16, le=4096)
    height: int = Field(default=360, ge=16, le=4096)
    point_radius: int = Field(default=48, ge=4, le=512)
    intensity: float = Field(default=1.0, ge=0.1, le=5.0)
    max_opacity: float = Field(default=0.75, ge=0.1, le=1.0)


class HeatmapResponse(BaseModel):
    image: str
    sample_count: int
    width: int
    height: int

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Allows all origins
    allow_credentials=True,
    allow_methods=["*"],  # Allows all methods
    allow_headers=["*"],  # Allows all headers
)

# Global variable to store the gaze estimator instance
gaze_estimator = None
cap = None


@app.post("/api/heatmap", response_model=HeatmapResponse)
async def generate_heatmap(payload: HeatmapRequest) -> HeatmapResponse:
    if not payload.points:
        raise HTTPException(status_code=400, detail="No gaze points provided.")

    width = payload.width
    height = payload.height
    heatmap = np.zeros((height, width), dtype=np.float32)
    valid_samples = 0

    for point in payload.points:
        if point.x is None or point.y is None:
            continue

        if np.isnan(point.x) or np.isnan(point.y):
            continue

        normalized_x = float(np.clip(point.x, 0.0, 1.0))
        normalized_y = float(np.clip(point.y, 0.0, 1.0))

        px = int(round(normalized_x * (width - 1)))
        py = int(round(normalized_y * (height - 1)))

        if px < 0 or px >= width or py < 0 or py >= height:
            continue

        weight = point.weight if point.weight is not None else 1.0
        heatmap[py, px] += weight
        valid_samples += 1

    if valid_samples == 0 or not np.any(heatmap):
        raise HTTPException(status_code=400, detail="Heatmap cannot be generated from the provided data.")

    sigma = max(1.0, payload.point_radius * 0.35)
    blurred = cv2.GaussianBlur(heatmap, (0, 0), sigma)
    blurred *= payload.intensity

    if np.max(blurred) > 0:
        normalized = cv2.normalize(blurred, None, alpha=0.0, beta=1.0, norm_type=cv2.NORM_MINMAX)
    else:
        normalized = blurred

    color_input = (normalized * 255).astype(np.uint8)
    colored = cv2.applyColorMap(color_input, cv2.COLORMAP_MAGMA)
    colored = cv2.cvtColor(colored, cv2.COLOR_BGR2RGB)
    alpha_channel = np.clip(normalized * (payload.max_opacity * 255), 0, 255).astype(np.uint8)
    rgba = np.dstack((colored, alpha_channel))

    success, buffer = cv2.imencode(".png", rgba)
    if not success:
        raise HTTPException(status_code=500, detail="Failed to encode heatmap image.")

    encoded = base64.b64encode(buffer).decode("ascii")
    return HeatmapResponse(
        image=f"data:image/png;base64,{encoded}",
        sample_count=valid_samples,
        width=width,
        height=height,
    )


@app.websocket("/ws/gaze")
async def websocket_endpoint(websocket: WebSocket):
    await websocket.accept()
    global gaze_estimator, cap
    
    if gaze_estimator is None:
        gaze_estimator = GazeEstimator()
        cap = cv2.VideoCapture(0)
    
    try:
        while True:
            ret, frame = cap.read()
            if not ret:
                continue
                
            features, blink_detected = gaze_estimator.extract_features(frame)
            if features is None:
                print("gaze debug: no face landmarks detected in frame")
                await asyncio.sleep(0.016)
                continue

            gaze_point = getattr(gaze_estimator, "last_gaze_point", None)
            if gaze_point is None:
                print("gaze debug: landmarks found but gaze point missing")
                await asyncio.sleep(0.016)
                continue

            x_coord, y_coord = gaze_point
            blink_flag = bool(blink_detected)

            await websocket.send_json({
                "x": x_coord,
                "y": y_coord,
                "blink": blink_flag,
                "timestamp": asyncio.get_event_loop().time()
            })
            print(f"gaze sample -> x:{x_coord:.3f}, y:{y_coord:.3f}, blink:{blink_flag}")
            await asyncio.sleep(0.016)  # ~60fps
    except Exception as e:
        print(f"WebSocket error: {e}")
    finally:
        if websocket.client_state.value:
            await websocket.close()

@app.on_event("shutdown")
async def shutdown_event():
    global cap
    if cap:
        cap.release()
