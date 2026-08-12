# 内見動画の結合サービス（Cloud Run）
# ffmpeg が入っていることだけが要件。Python 側の依存パッケージは無い。
FROM python:3.12-slim

RUN apt-get update \
 && apt-get install -y --no-install-recommends ffmpeg \
 && rm -rf /var/lib/apt/lists/*

ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1

WORKDIR /app
COPY main.py .

# Cloud Run は $PORT を渡してくる。ローカルでは既定の 8080。
ENV PORT=8080
EXPOSE 8080

CMD ["python", "main.py"]
