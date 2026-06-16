# LiveKit Cloud agent image for the Netomi voice agent.
FROM python:3.13-slim

# onnxruntime (silero VAD + turn detector) needs libgomp1; build-essential
# covers any source builds.
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    libgomp1 \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Install Python deps first (cached layer).
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# App code.
COPY agent.py .

# Bake model files (turn detector + Silero) into the image so the worker
# doesn't download them on cold start.
RUN python agent.py download-files

# Production worker. LiveKit Cloud injects LIVEKIT_URL / API_KEY / API_SECRET.
CMD ["python", "agent.py", "start"]
