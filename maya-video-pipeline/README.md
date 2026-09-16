Maya Video Pipeline — Video #1
================================

Self-contained image-to-video pipeline for one approved Maya start frame.

This folder maps to the intended local project:

    /Users/vikashkumar/maya-video-pipeline

It lives under `maya-video-pipeline/` in this repository so it stays isolated
from the VP Loan Connect product code.

The approved start frame is registered and SHA256-locked. Do not replace it.

Rules
-----

- Default is DRY RUN. Running the generator does not spend credits.
- Paid generation requires BOTH `--execute` and `--confirm VIDEO01`.
- One API request maximum. No retry. No fallback generation. No variants.
- fal.ai is never selected unless the current account balance is confirmed usable.
- Paid cloud providers are optional. They are not required.

Local free path
---------------

CPU-only machines cannot run neural image-to-video. Use the isolated Video Agent
for a free local 9:16 MP4 that animates this same approved still without
redesigning Maya's identity:

    video-agent/scripts/setup.sh
    video-agent/scripts/run.sh
    # open http://127.0.0.1:7860
    # check "Use Maya Video #1 approved start frame"

    PYTHONPATH=video-agent/src python3 -m video_agent generate --maya --dry-run
    PYTHONPATH=video-agent/src python3 -m video_agent generate --maya

Commands (run from this directory)
----------------------------------

    python3 scripts/generate_video01.py
    python3 scripts/generate_video01.py --execute --confirm VIDEO01
    python3 scripts/accept_video01.py PASS
    python3 scripts/accept_video01.py REJECT

Credentials
-----------

Copy `.env.example` to `.env` and add keys you already own. Do not purchase
credits from this pipeline. The Video Agent UI will not submit paid requests.
