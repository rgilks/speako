#!/bin/bash
# Download DeBERTa model from Modal Volume

echo "📦 Downloading DeBERTa model from Modal..."
mkdir -p public/models/cefr-deberta-v3-small

# Download the specific model directory
modal volume get cefr-models cefr-deberta-v3-small public/models/

# Flatten the structure (move contents of onnx/ up one level)
if [ -d "public/models/cefr-deberta-v3-small/onnx" ]; then
    echo "📦 Flattening directory structure..."
    mv public/models/cefr-deberta-v3-small/onnx/* public/models/cefr-deberta-v3-small/
    rmdir public/models/cefr-deberta-v3-small/onnx
fi

echo "✅ Model downloaded to public/models/cefr-deberta-v3-small"
