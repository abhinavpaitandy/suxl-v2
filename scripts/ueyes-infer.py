"""Local adapter for the separately installed UEyes DeepGaze++ research code.

Reads image bytes on stdin; writes normalized fixation coordinates as JSON.
"""
import io
import json
import os
import sys
from pathlib import Path

import numpy as np
from PIL import Image, ImageOps
from scipy.ndimage import zoom
from scipy.special import logsumexp
import torch

repo = Path(os.environ["UEYES_MODEL_DIR"])
sys.path.insert(0, str(repo))
import deepgaze_pytorch

Image.MAX_IMAGE_PIXELS = 30_000_000
image = ImageOps.exif_transpose(Image.open(io.BytesIO(sys.stdin.buffer.read()))).convert("RGB")
width, height = image.size
if width < 10 or height < 10:
    raise ValueError("Image is too small")
scale = min(1 / 2.5, 1400 / max(width, height))
image = np.asarray(image.resize((max(4, round(width * scale)), max(4, round(height * scale))), Image.Resampling.LANCZOS))
h, w = image.shape[:2]
center = np.load(repo / "centerbias_mit1003.npy")
center = zoom(center, (h / center.shape[0], w / center.shape[1]), order=0, mode="nearest")
center -= logsumexp(center)
model = deepgaze_pytorch.DeepGazeIII(1, pretrained=True).eval()
xs, ys = [w // 2], [h // 2]
history = {1: [-1, -1, -1, -1], 2: [-1, -1, -1, -2], 3: [-1, -1, -2, -3], 4: [-1, -2, -3, -4]}
yy, xx = np.ogrid[:h, :w]
radius = int(0.2 * min(w, h))
with torch.inference_mode():
    for _ in range(3):
        mask = np.zeros((h, w), dtype=np.float32)
        for i, (x, y) in enumerate(zip(xs, ys)):
            strength = 1 - 0.1 * (len(xs) - i - 1)
            mask = np.maximum(mask, ((xx - x) ** 2 + (yy - y) ** 2 <= radius ** 2) * strength)
        mask = 1 - mask
        indexes = history[min(len(xs), 4)]
        image_tensor = torch.from_numpy((image * mask[:, :, None].astype("uint8")).transpose(2, 0, 1).copy()).unsqueeze(0)
        x_history = torch.tensor([[xs[i] for i in indexes]])
        y_history = torch.tensor([[ys[i] for i in indexes]])
        mask_tensor = torch.from_numpy(mask)
        density = (100 + model(image_tensor, torch.from_numpy(center).unsqueeze(0), x_history, y_history)) * mask_tensor[None, None] - (1 - mask_tensor) * 1000
        index = int(torch.argmax(density).item())
        ys.append(index // w)
        xs.append(index % w)
print(json.dumps({"points": [{"x": x / w, "y": y / h} for x, y in zip(xs, ys)]}))
