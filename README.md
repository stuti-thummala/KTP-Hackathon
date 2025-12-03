# Eyewitness

Eyewitness is a real-time attention analysis and data visualization system that demonstrates how human memory distorts under pressure. It captures high-frequency gaze vectors through the webcam, transforms those signals into visualizations including heatmaps, blink traces, and drift timelines, and pairs the resulting insights with justice reform actions tied to the user's ZIP code.

https://www.youtube.com/watch?v=fdIyGFOo-g8

---

## System Overview

Eyewitness guides a user through a ten-second museum heist video while capturing gaze movements at up to sixty samples per second. The system produces several attention-centric visualizations:

- Heatmaps showing fixation density
- Temporal drift paths showing changes in focus over time
- Blink timelines revealing cognitive load
- Observer delta scoring for interpretability
- State-specific advocacy action cards

The experience blends an immersive web demo, a Python-based computer vision backend, and a visualization layer optimized for clarity and interpretability.

---

## Repository Layout

* **KTP-Hackathon/**
    * **web/**
        * **frontend/** (`# Next.js App Router + visualization components`)
        * **backend/** (`# FastAPI gaze + heatmap service`)
    * **eyetrax/** (`# Python gaze estimation package`)
    * **README.md**
---

## Architecture

| Layer | Stack | Responsibilities |
| :--- | :--- | :--- |
| Frontend | Next.js 14, React 18, Tailwind, Canvas | Webcam capture, stage flow, interactive visualization |
| API Proxy | Next.js API Route | ZIP → legislator lookup via OpenStates v3 |
| Gaze Service | FastAPI, OpenCV, MediaPipe, NumPy | Landmark extraction, gaze vectors, heatmap rasterization |
| ML Core | eyetrax | Iris detection, blink detection, normalization, regression |

### Interaction Flow

1. Webcam + video playback run in parallel
2. Gaze vectors stream over WebSocket
3. Data is aggregated into visualization-ready buffers
4. Heatmaps, drift charts, and blink timelines render client-side
5. Advocacy actions fetched dynamically through `/api/civic`

---

## API Surface & Endpoints

### Next.js Proxy
This endpoint serves as a proxy to retrieve legislative information based on the user's location.

| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `GET` | `/api/civic?zip=XXXXX` | Resolves a given ZIP code to its state, queries the OpenStates API for representatives, and returns the normalized legislator information. |

### FastAPI Endpoints
These endpoints handle real-time data streaming and heavy-duty data processing/visualization tasks.

| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `POST` | `/api/heatmap` | Accepts processed data and generates a visualization-ready PNG heatmap image, returning the image data. |
| `WS` | `/ws/gaze` | A WebSocket endpoint that streams real-time gaze data from the webcam/overlay process. Data payload format: `{x, y, blink, timestamp}` at approximately 60 Hz. |

---

## Data Flow Diagram

The application's data primarily flows through two distinct channels: the **real-time gaze stream** and the **civic data lookup**.

### 1. Real-Time Gaze Data & Visualization

This path handles live user input from the webcam for analysis and visualization.

Webcam → VideoOverlay

* **Real-time Stream:** VideoOverlay → WS /ws/gaze (Client-side consumption of raw gaze data)
* **Visualization Processing:** VideoOverlay → timeline → POST /api/heatmap → heatmap.png (Generating the visualization file)

### 2. Civic Representative Lookup

This path handles resolving location data to retrieve legislative information.

ZIP → GET /api/civic → OpenStates → normalized representatives (Final, processed representative data)

---

## Frontend Application

### Data Visualization Layer

The frontend implements several visualization modes:

- **RGBA heatmaps** using a perceptually uniform magma colormap
- **Drift plots** representing temporal trajectory of the gaze
- **Blink charts** showing engagement and cognitive interruptions
- **Baseline comparison metrics** for interpretability

Canvas handles real-time rendering; React handles contextual visualizations.

### Key Components

- `VideoOverlay.tsx`
  Captures webcam frames, collects gaze vectors, applies smoothing, and prepares visualization data.

- `BiasLabPanel.tsx`
  Main visualization panel generating heatmaps, drift traces, blink timelines, and scoring output.

- `VoiceForJusticePanel.tsx`
  Fetches OpenStates legislators and maps attention results to civic-engagement actions.

- `EyeTrackingComponent.tsx`
  Debug viewer for raw gaze streams and vectors.

---

## Backend Services

A FastAPI backend performs deterministic gaze estimation and produces visualization rasters.

### Core Capabilities

- MediaPipe FaceMesh landmark extraction
- Iris center estimation
- Blink detection via Eye Aspect Ratio + EMA
- Heatmap rasterization with Gaussian smoothing
- WebSocket streaming at ~60 Hz

Generated outputs include RGBA arrays and PNGs ready for compositing on the frontend.

---

## Gaze Estimation Engine (`eyetrax`)

`eyetrax` provides core low-level gaze features:

- Normalization of 3D face landmarks
- Rotation-invariant projections
- Stable iris center averaging
- Blink detection via smoothed

---

## Visualization Techniques

### Heatmaps
- Gaussian density smoothing
- Magma colormap
- RGBA outputs composited over video

### Temporal Drift
- Spatial trajectory plotted as a time-series
- Highlights fixation stability vs scatter

### Blink Frequency
- EAR plotted across time
- Identifies cognitive interruptions

### Baseline Comparison
- Calculates deviations from an ideal observer
- Produces normalized scoring metrics

### Canvas Rendering
- Maintains real-time frame rates
- Allows heatmap, drift, and overlay compositing
- Avoids hydration overhead from React

---

## Environment Variables

Create the following file:
`web/frontend/.env.local`

With:
`OPENSTATES_API_KEY=your_key`

This key is server-only and never exposed to the client.

---

## Local Development

### Install

```bash
# Frontend
cd web/frontend
npm install

# Backend
cd ../backend
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
Run
Bash

# Backend
uvicorn main:app --reload --host 0.0.0.0 --port 8000

# Frontend
cd ../frontend
npm run dev

# Visit:
http://localhost:3000/demo

## Troubleshooting

**Camera unavailable**  
Close other applications that may be using the webcam and refresh the page.

**Sparse heatmap**  
The backend requires at least five valid gaze points to generate a meaningful heatmap.

**OpenStates error**  
Check for an invalid API key, unsupported ZIP code, or upstream server error.

**Performance issues**  
Disable `--reload` in FastAPI for long sessions and use Python 3.10 for more stable MediaPipe performance.

---

## Extending the Project

- Add LLM-generated summaries personalized by gaze metrics  
- Expand state-specific advocacy action cards  
- Introduce calibration sequences for improved regression accuracy  
- Add multi-user comparison modes for classrooms or research labs  


