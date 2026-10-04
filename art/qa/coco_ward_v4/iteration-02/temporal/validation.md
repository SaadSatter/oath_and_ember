# Temporal evidence validation

Iteration 2 and its candidate bytes were preserved. No regeneration, provider request, approval or publication occurred.

`art:temporal` decoded the existing two desktop WebM recordings locally using Playwright FFmpeg, preserving native video PTS at millisecond resolution. Sixty PNGs cover three ordered 800ms windows per client. Selection uses actual decoded frames at intervals >=80ms, with no interpolation. Request-phase hints remain approximate because the legacy Node timeline is not synchronized to video start. Other viewports have still evidence; uncovered intervals and uncertain transitions must remain REVIEW.

`vision-input-preview-v2.json` is the current upload preview: 130 images (26,358,939 bytes before base64 encoding), existing brief/reference data, four state samples, objective diagnostics and ordered temporal metadata. Vision verifies candidate, video and frame hashes. No WebM upload is used. The configured model remains gpt-5.6.

Validation: typecheck and build passed; 78 tests passed with local loopback permission. Timestamp selection, cadence calculation, evidence tampering and mocked Responses temporal image/label delivery are covered. The original sandbox test attempt was blocked from binding localhost; the permitted run passed.

A separate local two-client/four-viewport capture validated the browser sampler without changing this asset's QA iteration. All 18 checks passed; eight telemetry files each have three request markers and 325–824 callback timestamps. See cadence-validation-v2.json for the capture directory and summaries. The initial validation exposed an esbuild/tsx injected __name helper in browser code; plain JavaScript injection fixed it, with the failed v1 evidence retained.

Callback cadence is not render completion or display FPS. Capture overhead affects scheduling. Next instrumentation work should hook Phaser POST_RENDER and PlayerPresentation/defense phase transitions, then synchronize their browser clock with a visible capture marker in video PTS. No pacing threshold or automatic animation PASS was added. Existing iteration-2 recordings have no callback telemetry; the separate validation run is not substituted into their vision evidence.

External upload is pending explicit authorization. Asset remains NEEDS_HUMAN_REVIEW; AWAITING_APPROVAL depends on supported reviewer findings and final approval remains human.
