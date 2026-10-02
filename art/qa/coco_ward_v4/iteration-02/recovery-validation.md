# Ward v4 routing/recovery verification

Iteration 01's original vision report is preserved: palette FAIL (ART, .96) plus animation REVIEW. Actionable failures now take precedence over unsupported REVIEW findings, subject to confidence threshold and the existing iteration cap.

The palette coverage claim was NOT_REPRODUCED. PNG inspection measured 1,264 visible atlas pixels, zero missing green-mask pixels, zero extra mask pixels and zero invalid mask pixels. Atlas and mask bytes/hashes are unchanged in iteration 02. No image-generation request was made. Actual mask-only defects now use deterministic alpha-derived recovery, tested on faint partially transparent pixels, with original source/evidence retained.

Iteration 02: typecheck PASS; 75 tests PASS across 13 files; build PASS with existing bundle-size advisory. Two clients and all four viewports produced 64 screenshots, eight named continuous WebM recordings, phase timelines, and zero objective QA failures.

Animation remains unresolved: current vision inputs contain sampled PNGs and diagnostics, not video frames. Continuous clips support human temporal review now; native timestamped frame extraction/cadence analysis is the next automated step. No animation judgment was converted to PASS, and no asset was approved/published.

The requested new external vision call was blocked by automatic approval review, which required separate authorization to upload private project screenshots, source/reference images and QA evidence to OpenAI. No rerun API request was made. Local QA was completed independently through art:capture. vision-input-preview.json describes the prepared 70-image packet; video bytes are excluded. Once external upload is approved, art:vision can review this iteration without rebuilding or recapturing it.
