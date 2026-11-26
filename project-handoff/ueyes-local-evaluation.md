# UEyes local scanpath evaluation

The H&M and Zara demo images were evaluated on 26 November 2026 using the
[UEyes research repository's DeepGaze++ script](https://github.com/YueJiang-nj/UEyes-CHI2023/tree/main/scanpath_models/DeepGaze%2B%2B).
The test used the published DeepGaze III weights, CPU inference, the script's
2.5× image resize, centre-bias template and inhibition-of-return logic. The
temporary test copy changed CUDA to CPU, used Pillow's current resampling API,
and corrected the script's y-history input, which otherwise repeats x-history.
Four points were requested: the fixed centre seed and three predicted fixations.

| Image | Resized dimensions | Points (x, y) in pixels |
| --- | --- | --- |
| H&M | 471 × 1022 | (235, 511), (250, 357), (230, 197), (85, 201) |
| Zara | 471 × 1022 | (235, 511), (242, 129), (242, 605), (242, 734) |

The shared results component displays these precomputed paths only after checking
the bundled screenshot bytes against the SHA-256 hashes in
`src/lib/ueyes-demo-paths.ts`. They are general free-viewing predictions, not
measured gaze, persona- or task-conditioned behaviour, or predictions for new
uploads. The heatmap, exports and illustrative click path remain separate.
For new screenshots, the local Vite server can invoke the research model using
`scripts/ueyes-infer.py`. Run `sh scripts/setup-ueyes.sh` and restart the local
server. The checkout, Python dependencies and model downloads stay in ignored
`.ueyes/`; they are not bundled or deployed. The local endpoint accepts only
same-origin loopback requests, bounds the upload size and runs one job at a
time. The UI caches validated coordinates by screenshot hash. Lovable deployments
do not expose this local endpoint; the Lovable gateway architecture is unchanged.
Review the research code and model weights' usage terms before distributing or
deploying them: the UEyes repository does not declare a repository license.
