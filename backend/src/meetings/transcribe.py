import json, os, sys


def main():
    if len(sys.argv) < 3:
        raise SystemExit("Usage: transcribe.py <audio-path> <output-json>")
    audio_path, output_path = sys.argv[1], sys.argv[2]
    model_name = os.getenv("APP2_WHISPER_MODEL", "small")
    device = os.getenv("APP2_WHISPER_DEVICE", "cpu")
    compute_type = os.getenv("APP2_WHISPER_COMPUTE_TYPE", "int8" if device == "cpu" else "float16")
    try:
        from faster_whisper import WhisperModel
    except Exception as exc:
        with open(output_path, "w", encoding="utf-8") as f:
            json.dump({"ok": False, "error": f"faster-whisper is not installed: {exc}"}, f)
        return 2
    try:
        model = WhisperModel(model_name, device=device, compute_type=compute_type)
        segments, info = model.transcribe(audio_path, vad_filter=True, beam_size=5)
        rows = []
        for index, segment in enumerate(segments, 1):
            text = (segment.text or "").strip()
            if text:
                rows.append({"segment_no": index, "start": float(segment.start), "end": float(segment.end), "text": text})
        payload = {"ok": True, "language": getattr(info, "language", None), "model": model_name, "segments": rows}
        with open(output_path, "w", encoding="utf-8") as f:
            json.dump(payload, f, ensure_ascii=False)
        return 0
    except Exception as exc:
        with open(output_path, "w", encoding="utf-8") as f:
            json.dump({"ok": False, "error": str(exc), "model": model_name}, f, ensure_ascii=False)
        return 3


if __name__ == "__main__":
    raise SystemExit(main())
