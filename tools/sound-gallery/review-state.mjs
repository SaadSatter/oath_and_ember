export const statuses = ["Pending", "Approved", "Needs Revision"];
export const groups = [
  "UI",
  "Sieg",
  "Coco",
  "Monsters",
  "Puzzles",
  "Griffin",
  "Shrine",
  "Story",
];
export function defaultReview(event) {
  return {
    status: "Pending",
    notes: "",
    tracks: event.assetId
      ? [
          {
            assetId: event.assetId,
            gain: event.gain,
            delay: 0,
            rate: 1,
            loop: false,
          },
        ]
      : [],
  };
}
export function emptyReview(catalog) {
  return {
    version: 1,
    planSha256: catalog.planSha256,
    events: {},
    assets: {},
    appliedUpdates: [],
  };
}
// Apply explicit human selection requests once; later manual revisions still persist.
export function applyReviewUpdates(review, catalog) {
  const next = {
    ...review,
    events: { ...review.events },
    assets: { ...review.assets },
    appliedUpdates: [...review.appliedUpdates],
  };
  for (const update of catalog.reviewUpdates ?? []) {
    if (next.appliedUpdates.includes(update.id)) continue;
    for (const id of update.eventIds) {
      const event = catalog.events.find((e) => e.id === id);
      const current = next.events[id] ?? defaultReview(event);
      if (update.status) {
        next.events[id] = { ...current, status: update.status };
        continue;
      }
      const tracks = current.tracks.map((track, index) => ({
        ...track,
        assetId:
          index === 0 || track.assetId === "select"
            ? update.assetId
            : track.assetId,
      }));
      next.events[id] = withTracks(current, tracks);
    }
    for (const id of update.assetIds ?? []) {
      next.assets[id] = {
        ...(next.assets[id] ?? { notes: "" }),
        status: update.status,
      };
    }
    next.appliedUpdates.push(update.id);
  }
  return next;
}
export function validateReview(value, catalog) {
  if (!value || value.version !== 1 || value.planSha256 !== catalog.planSha256)
    throw Error(
      "This review belongs to a different plan or format. Nothing was imported.",
    );
  const clean = emptyReview(catalog);
  const applied = value.appliedUpdates ?? [];
  if (
    !Array.isArray(applied) ||
    applied.some(
      (id) => !(catalog.reviewUpdates ?? []).some((update) => update.id === id),
    )
  )
    throw Error("Invalid selection-update history. Nothing was imported.");
  clean.appliedUpdates = [...new Set(applied)];
  const assets = new Set(catalog.assets.map((a) => a.id));
  const events = new Map(catalog.events.map((e) => [e.id, e]));
  const note = (record) => {
    if (
      !record ||
      !statuses.includes(record.status) ||
      typeof record.notes !== "string" ||
      record.notes.length > 10000
    )
      throw Error("Invalid approval status or notes. Nothing was imported.");
    return { status: record.status, notes: record.notes };
  };
  if (
    !value.events ||
    !value.assets ||
    Array.isArray(value.events) ||
    Array.isArray(value.assets)
  )
    throw Error("Missing event or source reviews. Nothing was imported.");
  for (const [id, record] of Object.entries(value.events)) {
    const event = events.get(id);
    if (!event) throw Error("Unknown event in review. Nothing was imported.");
    const base = note(record);
    if (
      !Array.isArray(record.tracks) ||
      record.tracks.length > 4 ||
      (event.silent && record.tracks.length)
    )
      throw Error(
        "Invalid layer count or an attempted sound on a protected silence event.",
      );
    const tracks = record.tracks.map((track) => {
      if (
        !track ||
        !assets.has(track.assetId) ||
        !Number.isFinite(track.gain) ||
        track.gain < 0 ||
        track.gain > 1 ||
        !Number.isFinite(track.delay) ||
        track.delay < 0 ||
        track.delay > 5000 ||
        !Number.isFinite(track.rate) ||
        track.rate < 0.5 ||
        track.rate > 2 ||
        typeof track.loop !== "boolean"
      )
        throw Error(
          "Unknown source or invalid layer setting. Nothing was imported.",
        );
      return {
        assetId: track.assetId,
        gain: track.gain,
        delay: track.delay,
        rate: track.rate,
        loop: track.loop,
      };
    });
    if (!event.silent && !tracks.length)
      throw Error("A sound event must retain a candidate.");
    clean.events[id] = { ...base, tracks };
  }
  for (const [id, record] of Object.entries(value.assets)) {
    if (!assets.has(id))
      throw Error("Unknown source clip in review. Nothing was imported.");
    clean.assets[id] = note(record);
  }
  return clean;
}
// Audition edits invalidate a prior approval; notes alone never change the selection.
export function withTracks(record, tracks) {
  return {
    ...record,
    status: "Pending",
    tracks: tracks.map((t) => ({ ...t })),
  };
}
