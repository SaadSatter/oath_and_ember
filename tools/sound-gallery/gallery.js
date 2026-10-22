import {
  groups,
  statuses,
  defaultReview,
  emptyReview,
  validateReview,
  withTracks,
  applyReviewUpdates,
} from "./review-state.mjs";
const $ = (selector) => document.querySelector(selector);
const esc = (value) =>
  String(value ?? "").replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );
const message = (text) => {
  $("#message").textContent = text;
};
let catalog;
try {
  const response = await fetch("/catalog.json");
  if (!response.ok) throw Error("Cannot load catalog.");
  catalog = await response.json();
} catch (error) {
  $("#results").textContent = error.message;
  throw error;
}
const assets = new Map(catalog.assets.map((a) => [a.id, a]));
const events = new Map(catalog.events.map((e) => [e.id, e]));
const storageKey = `oath-ember-sound-review-v1:${catalog.planSha256}`;
let review = emptyReview(catalog),
  view = "phase1",
  group = "All",
  selected = catalog.events.find((e) => e.name === "Inventory open").id;
let ctx,
  masterNode,
  active = [],
  generation = 0,
  stopTimer,
  master = 0.65;
const buffers = new Map();
try {
  const saved = localStorage.getItem(storageKey);
  if (saved) review = validateReview(JSON.parse(saved), catalog);
} catch (error) {
  message(
    `Saved review could not be loaded: ${error.message} Export a review before closing if browser storage is unavailable.`,
  );
}
function save() {
  try {
    localStorage.setItem(storageKey, JSON.stringify(review));
    message("Review saved in this browser. Export it to share or back it up.");
  } catch {
    message(
      "Browser storage is unavailable. Changes remain in this tab; export the review to preserve them.",
    );
  }
  totals();
}
function getReview(event) {
  return review.events[event.id] ?? defaultReview(event);
}
function clipReview(id) {
  return review.assets[id] ?? { status: "Pending", notes: "" };
}
function badge(status) {
  return `<span class="badge ${status.toLowerCase().replaceAll(" ", "-")}">${esc(status)}</span>`;
}
function totals() {
  const approved = catalog.events.filter(
    (e) => e.phase1 && getReview(e).status === "Approved",
  ).length;
  $("#totals").innerHTML =
    `<div class="stat"><strong>63</strong><span>verified source clips</span></div><div class="stat"><strong>204</strong><span>mapped events</span></div><div class="stat"><strong>${approved}<small>/28</small></strong><span>Phase 1 approved</span></div>`;
}
function stopAll() {
  generation++;
  clearTimeout(stopTimer);
  active.forEach((node) => {
    try {
      node.stop();
    } catch {}
  });
  active = [];
  document.querySelectorAll("audio").forEach((a) => {
    a.pause();
    a.currentTime = 0;
  });
}
async function buffer(id) {
  if (!buffers.has(id))
    buffers.set(
      id,
      fetch(assets.get(id).url)
        .then((r) => {
          if (!r.ok) throw Error(`Could not load ${id}.`);
          return r.arrayBuffer();
        })
        .then((bytes) => ctx.decodeAudioData(bytes))
        .catch((error) => {
          buffers.delete(id);
          throw error;
        }),
    );
  return buffers.get(id);
}
async function audition(tracks, label) {
  stopAll();
  const token = generation;
  try {
    if (!tracks.length) {
      message("Intentional silence. No sound will play.");
      return;
    }
    ctx ??= new AudioContext();
    masterNode ??= ctx.createGain();
    masterNode.gain.value = master;
    masterNode.disconnect();
    masterNode.connect(ctx.destination);
    await ctx.resume();
    const decoded = await Promise.all(tracks.map((t) => buffer(t.assetId)));
    if (token !== generation) return;
    const start = ctx.currentTime + 0.035;
    // Bound the sum of per-layer gains; audition sketches are not normalized masters.
    const headroom = Math.max(
      1,
      tracks.reduce((sum, t) => sum + t.gain, 0),
    );
    tracks.forEach((track, i) => {
      const source = ctx.createBufferSource(),
        gain = ctx.createGain();
      source.buffer = decoded[i];
      source.playbackRate.value = track.rate;
      source.loop = track.loop;
      gain.gain.value = track.gain / headroom;
      source.connect(gain);
      gain.connect(masterNode);
      source.onended = () => {
        gain.disconnect();
        source.disconnect();
        active = active.filter((n) => n !== source);
      };
      active.push(source);
      source.start(start + track.delay / 1000);
      source.stop(start + 8);
    });
    stopTimer = setTimeout(() => {
      if (token === generation) stopAll();
    }, 8200);
    message(
      `Auditioning ${label}. Preview stops within 8 seconds. Raw source / review mix only.`,
    );
  } catch (error) {
    if (token === generation) {
      stopAll();
      message(`Playback failed: ${error.message}`);
    }
  }
}
$("#stop").onclick = () => {
  stopAll();
  message("All previews stopped.");
};
$("#master").oninput = (e) => {
  master = Number(e.target.value);
  $("#master-value").textContent = `${Math.round(master * 100)}%`;
  if (masterNode) masterNode.gain.value = master;
  document
    .querySelectorAll("audio")
    .forEach((a) => (a.volume = master * Number(a.dataset.gain ?? 0.3)));
};
document.addEventListener(
  "play",
  (e) => {
    if (!(e.target instanceof HTMLAudioElement)) return;
    const playing = e.target;
    // Native source controls use the same exclusive playback policy as the mixer.
    generation++;
    clearTimeout(stopTimer);
    active.forEach((n) => {
      try {
        n.stop();
      } catch {}
    });
    active = [];
    document.querySelectorAll("audio").forEach((a) => {
      if (a !== playing) {
        a.pause();
        a.currentTime = 0;
      }
    });
    playing.volume = master * Number(playing.dataset.gain ?? 0.3);
  },
  true,
);
document.addEventListener(
  "error",
  (e) => {
    if (e.target instanceof HTMLAudioElement)
      message(
        "This source could not play in this browser. Try its download link or another browser.",
      );
  },
  true,
);
window.addEventListener("pagehide", stopAll);
document.addEventListener("visibilitychange", () => {
  if (document.hidden) stopAll();
});
window.addEventListener("keydown", (e) => {
  if (e.key === "Escape") {
    stopAll();
    message("All previews stopped.");
  }
});
function categoryNav() {
  $("#groups").innerHTML = ["All", ...groups]
    .map(
      (name) =>
        `<button data-group="${name}" class="${group === name ? "active" : ""}" aria-pressed="${group === name}">${name}</button>`,
    )
    .join("");
  $("#groups").hidden = view === "gaps";
}
function matches(item, status, haystack) {
  const query = $("#search").value.trim().toLowerCase(),
    filter = $("#status-filter").value;
  return (
    (filter === "All statuses" || filter === status) &&
    (!query || haystack.toLowerCase().includes(query))
  );
}
function sourceEvents(id) {
  return catalog.events.filter(
    (e) =>
      e.assetId === id ||
      e.companionAssetIds?.includes(id) ||
      e.recipes.some((r) => r.tracks.some((t) => t.assetId === id)),
  );
}
function renderList() {
  categoryNav();
  document
    .querySelectorAll("[data-view]")
    .forEach((button) =>
      button.setAttribute("aria-pressed", String(button.dataset.view === view)),
    );
  if (view === "gaps") {
    $("#result-count").textContent =
      `${catalog.gaps.length} observation limits`;
    $("#results").innerHTML = catalog.gaps
      .filter((g) => matches(g, "Pending", `${g.title} ${g.detail}`))
      .map(
        (g) =>
          `<article class="gap-card"><span class="tag">INTEGRATION DEFERRED</span><h2>${esc(g.title)}</h2><p>${esc(g.detail)}</p></article>`,
      )
      .join("");
    $("#detail").innerHTML =
      `<p class="eyebrow">SERVER TRUTH FIRST</p><h2>Audition now.<br>Observe reliably later.</h2><p class="description">These cues need exact observations before a future integration can promise every hit or transition.</p><p class="hint">No protocol changes are part of this gallery. Stable action sequences, impact IDs and permanent latches remain the preferred observation points. Snapshot state alone is not an event log.</p><div class="gap"><strong>Preserved multiplayer requirements</strong>Baseline first snapshots; deduplicate sequences/impacts; keep private story cues private; stop obsolete loops on travel/disconnect; pause held-world sounds; reconcile predicted casts; never infer gameplay outcomes from audio.</div><a href="/reference/SOUND_DESIGN_PLAN.md" target="_blank">Read the original synchronization requirements ↗</a>`;
    return;
  }
  if (view === "sources") {
    const list = catalog.assets.filter(
      (a) =>
        (group === "All" ||
          sourceEvents(a.id).some((e) => e.group === group)) &&
        matches(
          a,
          clipReview(a.id).status,
          `${a.id} ${a.member} ${a.creator} ${sourceEvents(a.id)
            .map((e) => e.name)
            .join(" ")}`,
        ),
    );
    $("#result-count").textContent = `${list.length} of 63 clips`;
    if (!list.some((a) => a.id === selected)) selected = list[0]?.id;
    $("#results").innerHTML =
      list
        .map(
          (a) =>
            `<button class="event-card ${selected === a.id ? "selected" : ""}" data-source="${esc(a.id)}"><div class="card-meta"><span>ORIGINAL SOURCE · ${a.pack}</span>${badge(clipReview(a.id).status)}</div><h2>${esc(a.id)}</h2><p>${esc(a.member)}</p><div class="tags"><span class="tag">CC0 · ${esc(a.creator)}</span><span class="tag">${sourceEvents(a.id).length} mapped / candidate uses</span></div></button>`,
        )
        .join("") || '<p class="empty">No clips match these filters.</p>';
    if (selected) renderSource(assets.get(selected));
    else $("#detail").innerHTML = '<p class="empty">Choose a source clip.</p>';
    return;
  }
  const list = catalog.events.filter(
    (e) =>
      (view !== "phase1" || e.phase1) &&
      (group === "All" || e.group === group) &&
      matches(
        e,
        getReview(e).status,
        `${e.name} ${e.description} ${e.trigger} ${e.assetId ?? "silence"} ${e.assetId ? assets.get(e.assetId).member : ""}`,
      ),
  );
  $("#result-count").textContent =
    `${list.length} ${view === "phase1" ? "Phase 1 proposals" : "events"}`;
  if (!list.some((e) => e.id === selected)) selected = list[0]?.id;
  $("#results").innerHTML =
    list
      .map(
        (e) =>
          `<button class="event-card ${selected === e.id ? "selected" : ""}" data-event="${e.id}"><div class="card-meta"><span>${e.group.toUpperCase()}${e.optional ? " · OPTIONAL / LATER" : ""}</span>${badge(getReview(e).status)}</div><h2>${esc(e.name)}</h2><p>${esc(e.description)}</p><div class="tags">${e.phase1 ? '<span class="tag phase">PHASE 1</span>' : ""}${e.silent ? '<span class="badge silence">PROTECTED SILENCE</span>' : `<span class="tag">${esc(e.assetId)}</span>`}${e.gaps.length ? '<span class="tag">Observation caution</span>' : ""}</div></button>`,
      )
      .join("") ||
    '<p class="empty">No events match. Try All categories or clear your search.</p>';
  if (selected) renderEvent(events.get(selected));
  else $("#detail").innerHTML = '<p class="empty">No event selected.</p>';
}
function statusSelect(status, kind) {
  return `<select data-approval="${kind}" aria-label="${kind === "event" ? "Event" : "Source clip"} approval status">${statuses.map((s) => `<option${s === status ? " selected" : ""}>${s}</option>`).join("")}</select>`;
}
function sourceInfo(a) {
  return `<p class="file">${esc(a.member)}</p><div class="source-links"><a href="${esc(a.source_page)}" target="_blank" rel="noreferrer">${esc(a.creator)} · ${esc(a.license)} ↗</a><a href="${esc(a.download_url)}" target="_blank" rel="noreferrer">Original pack ↓</a><a href="${esc(a.url)}" download>Source clip ↓</a></div>`;
}
function renderSource(a) {
  const state = clipReview(a.id),
    mapped = sourceEvents(a.id);
  $("#detail").innerHTML =
    `<div class="detail-header"><span class="eyebrow">VERIFIED SOURCE ${a.pack}</span><label>Clip review${statusSelect(state.status, "asset")}</label></div><h2>${esc(a.id)}</h2>${sourceInfo(a)}<audio controls preload="none" src="${esc(a.url)}" data-gain="0.3" aria-label="Play source ${esc(a.id)}"></audio><p class="hint">Original, unedited file. Source playback gain 0.30 × master. All source audio is manual. Use an event’s mixer to hear its proposed volume or layered treatment.</p><h3>Intended event mappings / candidate mixes</h3>${mapped.length ? `<ul class="used-list">${mapped.map((e) => `<li><button data-jump="${e.id}">${esc(e.name)}</button></li>`).join("")}</ul>` : '<p class="hint">Verified reserve / companion candidate in the original catalog. No primary event assignment; available for comparison without inventing a gameplay event.</p>'}<details><summary>Verification record</summary><p class="file">SHA-256 ${esc(a.sha256)}</p><p class="hint">${a.bytes.toLocaleString()} bytes · ${esc(a.signature)} · archive member preserved.<br>${esc(a.license_evidence || "Bundled License.txt retained in reference folder.")}</p></details><label class="notes">Source review notes<textarea data-notes="asset" maxlength="10000" placeholder="Timbre, edits needed, or preferred uses…">${esc(state.notes)}</textarea></label>`;
  $("#detail audio").volume = master * 0.3;
}
function renderEvent(e) {
  const state = getReview(e),
    a = assets.get(e.assetId);
  const aliases = Object.keys(catalog.references).filter((k) =>
    new RegExp(`\\b${k}\\b`).test(e.trigger),
  );
  $("#detail").innerHTML =
    `<div class="detail-header"><p class="eyebrow">${e.group.toUpperCase()} · ${e.phase1 ? "PHASE 1 PROPOSAL" : e.optional ? "OPTIONAL / LATER" : "LATER REVIEW"}</p><label>Selection review${statusSelect(state.status, "event")}</label></div><h2>${esc(e.name)}</h2><p class="description">${esc(e.description)}</p><div class="original"><strong>Original proposal</strong><br>${a ? esc(a.member) : "Intentional silence · no asset"}<br>Gain ${e.gain.toFixed(2)} · ${esc(e.playback.split(";").slice(1).join(";"))}</div><h3>Current-code trigger</h3><p class="trigger">${esc(e.trigger)}</p><div class="source-links">${aliases.map((k) => `<a href="${esc(catalog.references[k].url)}" target="_blank" rel="noreferrer">${k} ↗</a>`).join("")}</div>${e.gaps
      .map((id) => {
        const gap = catalog.gaps.find((g) => g.id === id);
        return `<div class="gap"><strong>${esc(gap.title)}</strong>${esc(gap.detail)}</div>`;
      })
      .join(
        "",
      )}${e.silent ? '<h3>Keep this moment quiet</h3><div class="silence-panel"><strong>Intentional silence</strong>No audio asset, playback button or editable layer. This protects the story’s emotional pacing. You can review the silence decision and leave notes below.</div>' : `<h3>Proposed source</h3>${sourceInfo(a)}<audio controls preload="none" src="${esc(a.url)}" data-gain="${e.gain}" aria-label="Original proposal playback"></audio>${e.recipes.length ? `<h3>Signature comparisons</h3><p class="hint">Audition a sketch, then Use it to choose that mix. Originals remain unchanged. These candidate combinations are gallery-only.</p>${e.recipes.map((r, i) => `<div class="recipe"><span>${esc(r.label)}</span><button data-recipe-play="${i}">Audition</button><button data-recipe-use="${i}">Use</button></div>`).join("")}` : ""}<h3>Selected mix · ${state.tracks.length}/4 layers</h3><div id="layers">${state.tracks.map((t, i) => renderLayer(t, i)).join("")}</div><div class="preview-actions"><button class="primary" data-play-mix>▶ Play selected mix</button><button data-add-layer ${state.tracks.length >= 4 ? "disabled" : ""}>+ Add layer</button><button data-original>Reset to proposal</button></div><p class="hint">Gain is per layer × master. Delay is milliseconds; rate changes speed and pitch. Loops are rough audition repeats, not seamless edits. Every mix stops within 8 seconds. Changing any layer resets review to Pending.</p>`}<label class="notes">Review notes<textarea data-notes="event" maxlength="10000" placeholder="What works? What needs revision?">${esc(state.notes)}</textarea></label>`;
  document
    .querySelectorAll("#detail audio")
    .forEach((audio) => (audio.volume = master * e.gain));
}
function renderLayer(t, i) {
  const a = assets.get(t.assetId);
  return `<div class="layer" data-layer="${i}"><div class="layer-head"><select data-track="assetId" aria-label="Layer ${i + 1} candidate">${catalog.assets.map((a) => `<option value="${a.id}"${a.id === t.assetId ? " selected" : ""}>${esc(a.id)} · ${esc(a.member)}</option>`).join("")}</select><button data-solo="${i}" aria-label="Solo layer ${i + 1}">Solo</button><button data-remove="${i}" aria-label="Remove layer ${i + 1}" ${i === 0 && getReview(events.get(selected)).tracks.length === 1 ? "disabled" : ""}>×</button></div><p class="layer-filename">${esc(a.member)} · ${esc(a.creator)} · ${esc(a.license)} <a href="${esc(a.source_page)}" target="_blank" rel="noreferrer">Source ↗</a></p><div class="layer-settings"><label>Gain <input data-track="gain" aria-label="Layer ${i + 1} gain" type="number" min="0" max="1" step="0.01" value="${t.gain}"></label><label>Delay <input data-track="delay" aria-label="Layer ${i + 1} delay in milliseconds" type="number" min="0" max="5000" step="10" value="${t.delay}"></label><label>Rate <input data-track="rate" aria-label="Layer ${i + 1} playback rate" type="number" min="0.5" max="2" step="0.05" value="${t.rate}"></label><label><input data-track="loop" type="checkbox" ${t.loop ? "checked" : ""}> Loop preview</label></div></div>`;
}
function changeTracks(tracks) {
  stopAll();
  const event = events.get(selected);
  const next = {
    ...review,
    events: {
      ...review.events,
      [selected]: withTracks(getReview(event), tracks),
    },
  };
  try {
    review = validateReview(next, catalog);
    save();
    renderList();
  } catch (error) {
    message(error.message);
    renderEvent(event);
  }
}
$("#groups").onclick = (e) => {
  const button = e.target.closest("[data-group]");
  if (!button) return;
  stopAll();
  group = button.dataset.group;
  renderList();
};
document.querySelector(".view-tabs").onclick = (e) => {
  const button = e.target.closest("[data-view]");
  if (!button) return;
  stopAll();
  view = button.dataset.view;
  selected = undefined;
  group = "All";
  $("#search").value = "";
  renderList();
};
$("#results").onclick = (e) => {
  const button = e.target.closest("[data-event], [data-source]");
  if (!button) return;
  stopAll();
  selected = button.dataset.event ?? button.dataset.source;
  renderList();
};
$("#search").oninput = () => {
  stopAll();
  renderList();
};
$("#status-filter").onchange = () => {
  stopAll();
  renderList();
};
$("#detail").onclick = (e) => {
  const target = e.target.closest("button");
  if (!target) return;
  if (target.dataset.jump) {
    stopAll();
    view = "events";
    group = "All";
    $("#search").value = "";
    $("#status-filter").value = "All statuses";
    selected = target.dataset.jump;
    renderList();
    return;
  }
  const event = events.get(selected);
  if (!event || event.silent) return;
  const state = getReview(event);
  if (target.hasAttribute("data-play-mix"))
    void audition(state.tracks, event.name);
  if (target.dataset.solo !== undefined)
    void audition(
      [state.tracks[Number(target.dataset.solo)]],
      `${event.name} · solo`,
    );
  if (target.hasAttribute("data-add-layer") && state.tracks.length < 4)
    changeTracks([
      ...state.tracks,
      { assetId: "soft", gain: 0.15, delay: 0, rate: 1, loop: false },
    ]);
  if (target.dataset.remove !== undefined && state.tracks.length > 1)
    changeTracks(
      state.tracks.filter((_, i) => i !== Number(target.dataset.remove)),
    );
  if (target.hasAttribute("data-original"))
    changeTracks(defaultReview(event).tracks);
  if (target.dataset.recipePlay !== undefined)
    void audition(
      event.recipes[Number(target.dataset.recipePlay)].tracks,
      event.recipes[Number(target.dataset.recipePlay)].label,
    );
  if (target.dataset.recipeUse !== undefined)
    changeTracks(event.recipes[Number(target.dataset.recipeUse)].tracks);
};
$("#detail").onchange = (e) => {
  const target = e.target;
  if (target.dataset.approval) {
    if (target.dataset.approval === "event")
      review.events[selected] = {
        ...getReview(events.get(selected)),
        status: target.value,
      };
    else
      review.assets[selected] = {
        ...clipReview(selected),
        status: target.value,
      };
    save();
    renderList();
  }
  if (target.dataset.track) {
    const state = getReview(events.get(selected)),
      index = Number(target.closest("[data-layer]").dataset.layer),
      key = target.dataset.track;
    const value =
      key === "assetId"
        ? target.value
        : key === "loop"
          ? target.checked
          : Number(target.value);
    if (
      target.type === "number" &&
      (!target.value || !target.checkValidity())
    ) {
      message("Use a value within the displayed limits.");
      renderEvent(events.get(selected));
      return;
    }
    changeTracks(
      state.tracks.map((t, i) => (i === index ? { ...t, [key]: value } : t)),
    );
  }
};
$("#detail").oninput = (e) => {
  const target = e.target;
  if (!target.dataset.notes) return;
  if (target.dataset.notes === "event")
    review.events[selected] = {
      ...getReview(events.get(selected)),
      notes: target.value,
    };
  else
    review.assets[selected] = { ...clipReview(selected), notes: target.value };
  save();
};
$("#export").onclick = () => {
  const blob = new Blob(
    [
      JSON.stringify(
        { ...review, exportedAt: new Date().toISOString() },
        null,
        2,
      ),
    ],
    { type: "application/json" },
  );
  const url = URL.createObjectURL(blob),
    link = document.createElement("a");
  link.href = url;
  link.download = "oath-ember-sound-review.json";
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  message(
    "Review exported. Only individually saved decisions are included; unspecified entries remain Pending.",
  );
};
$("#import").onclick = () => $("#import-file").click();
$("#import-file").onchange = async (e) => {
  const file = e.target.files[0];
  if (!file) return;
  try {
    if (file.size > 2_000_000) throw Error("Review file is too large.");
    const next = validateReview(JSON.parse(await file.text()), catalog);
    stopAll();
    review = applyReviewUpdates(next, catalog);
    save();
    renderList();
    message(
      "Review imported and saved. Import replaces this browser’s review; exported backups can restore prior decisions.",
    );
  } catch (error) {
    message(`Import rejected: ${error.message}`);
  }
  e.target.value = "";
};
const updatedReview = applyReviewUpdates(review, catalog);
if (updatedReview.appliedUpdates.length !== review.appliedUpdates.length) {
  review = updatedReview;
  save();
  message(
    "Your review update is applied: all 204 events and 63 source clips are provisionally Approved. You can revise individual selections at any time. No gameplay audio is enabled.",
  );
}
totals();
renderList();
