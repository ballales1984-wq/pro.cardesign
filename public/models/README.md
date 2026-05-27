# ONNX Models for AI Engine

## Available Models (Fase 7)

### Depth Estimation - MiDaS Small
- `midas_small.onnx` (66.7 MB) - Already downloaded
- Source: https://github.com/isl-org/MiDaS/releases/download/v2_1/model-small.onnx

### Object Segmentation - SAM ViT-B Quantized
Encoder + Decoder (quantizzati, 71.9 MB totali):
- `sam_vit_b/sam_vit_b_01ec64.encoder.quant.onnx` - Image encoder
- `sam_vit_b/sam_vit_b_01ec64.decoder.quant.onnx` - Mask decoder
- Source: https://huggingface.co/vietanhdev/segment-anything-onnx-models

## Usage

The models are loaded dynamically via onnxruntime-web:

```javascript
// MiDaS depth estimation
const midas = await ort.InferenceSession.create('/models/midas_small.onnx');

// SAM encoder + decoder (quantized)
const encoder = await ort.InferenceSession.create('/models/sam_vit_b/sam_vit_b_01ec64.encoder.quant.onnx');
const decoder = await ort.InferenceSession.create('/models/sam_vit_b/sam_vit_b_01ec64.decoder.quant.onnx');
```

If models are unavailable, the system falls back to simple heuristics (grayscale depth estimation + full-image segmentation).