"""
pyannote-service/main.py - 화자 분리 마이크로서비스
FastAPI 기반, pyannote.audio를 사용한 Speaker Diarization
"""

import os
import tempfile
import time
from pathlib import Path

from fastapi import FastAPI, File, UploadFile, HTTPException
from fastapi.responses import JSONResponse

app = FastAPI(title="Speaker Diarization Service")

_pipeline = None


def get_pipeline():
    global _pipeline
    if _pipeline is None:
        hf_token = os.getenv("HF_TOKEN")
        if not hf_token:
            raise RuntimeError("HF_TOKEN 환경변수가 설정되지 않았습니다.")
        from pyannote.audio import Pipeline
        _pipeline = Pipeline.from_pretrained(
            "pyannote/speaker-diarization-3.1",
            use_auth_token=hf_token,
        )
        import torch
        if torch.cuda.is_available():
            _pipeline.to(torch.device("cuda"))
    return _pipeline


@app.get("/diarize/health")
async def health():
    return {
        "status": "ok",
        "service": "diarization",
        "model_loaded": _pipeline is not None,
    }


@app.post("/diarize")
async def diarize(file: UploadFile = File(...)):
    """오디오 파일을 받아 화자 세그먼트를 반환"""
    suffix = Path(file.filename).suffix if file.filename else ".wav"
    with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as tmp:
        content = await file.read()
        tmp.write(content)
        tmp_path = tmp.name

    try:
        pipeline = get_pipeline()
        start_time = time.time()
        diarization = pipeline(tmp_path)
        elapsed = time.time() - start_time

        segments = []
        speakers = set()
        for turn, _, speaker in diarization.itertracks(yield_label=True):
            speakers.add(speaker)
            segments.append({
                "speaker": speaker,
                "start": round(turn.start, 3),
                "end": round(turn.end, 3),
            })

        return JSONResponse({
            "segments": segments,
            "num_speakers": len(speakers),
            "processing_time_sec": round(elapsed, 2),
        })
    except RuntimeError as e:
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        os.unlink(tmp_path)


if __name__ == "__main__":
    import uvicorn
    port = int(os.getenv("DIARIZE_PORT", "5000"))
    uvicorn.run(app, host="0.0.0.0", port=port)
