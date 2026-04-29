#!/bin/bash
# postinstall.sh — 晓园 Vault macOS 安装后脚本
set -e

echo "[postinstall] 晓园 Vault 安装中..."

# whisper-cpp (if not already installed via Homebrew)
WHISPER_BIN="/opt/homebrew/bin/whisper-cli"
if [ ! -x "$WHISPER_BIN" ]; then
  echo "[postinstall] 安装 whisper-cpp..."
  brew install whisper-cpp 2>/dev/null || {
    echo "[postinstall] ⚠️ whisper-cpp 安装失败"
    echo "可手动运行: brew install whisper-cpp"
  }
else
  echo "[postinstall] whisper-cli OK"
fi

# tesseract (for OCR, optional)
if ! command -v tesseract &>/dev/null; then
  echo "[postinstall] 安装 tesseract（可选，用于图片 OCR）..."
  brew install tesseract 2>/dev/null || true
fi

echo "[postinstall] ✅ 安装完成"
echo "[postinstall] 提示: 首次导入文件时，App 会自动转换格式"
