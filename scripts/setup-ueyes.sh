#!/bin/sh
set -eu
# Local research dependencies only; the app's deployed AI gateway is unchanged.
cd "$(dirname "$0")/.."
mkdir -p .ueyes
if [ ! -f '.ueyes/repo/scanpath_models/DeepGaze++/centerbias_mit1003.npy' ]; then
  git clone https://github.com/YueJiang-nj/UEyes-CHI2023.git .ueyes/repo
fi
if [ -d .ueyes/repo/.git ]; then
  git -C .ueyes/repo checkout 7bc064175310284c74e64e0c3c2ef264bfbe66e2
fi
python3 -m venv .ueyes/venv
.ueyes/venv/bin/python -m pip install 'torch==2.8.0' 'torchvision==0.23.0' 'scipy>=1.10,<1.14' 'numpy<2.1' 'pillow>=10,<12' imageio matplotlib
echo 'UEyes dependencies installed. On the first prediction, PyTorch downloads its public model weights into .ueyes/torch.'
