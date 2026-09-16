Maya Video Pipeline — Video #1
================================

Self-contained image-to-video pipeline for one approved Maya start frame.

This folder maps to the intended local project:

    /Users/vikashkumar/maya-video-pipeline

It lives under `maya-video-pipeline/` in this repository so it stays isolated
from the VP Loan Connect product code.

Rules
-----

- Default is DRY RUN. Running the generator does not spend credits.
- Paid generation requires BOTH `--execute` and `--confirm VIDEO01`.
- One API request maximum. No retry. No fallback generation. No variants.
- fal.ai is never selected unless the current account balance is confirmed usable.

Commands (run from this directory)
----------------------------------

    python3 scripts/generate_video01.py
    python3 scripts/generate_video01.py --execute --confirm VIDEO01
    python3 scripts/accept_video01.py PASS
    python3 scripts/accept_video01.py REJECT

Credentials
-----------

Copy `.env.example` to `.env` and add keys you already own. Do not purchase
credits from this pipeline.
