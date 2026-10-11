# Login animation: video prompt and script

Source design: Claude Design canvas "Login Animation Concept" (artboard `Panel.dc.html`).
Everything shown is fictional sample data (D-112). No real aircraft markings, crests or OEM data.

---

## 1. Master prompt (paste into a video generator)

> Seamless 16-second looping background animation, 1920×1080, 30 fps. Calm, technical, aviation-maintenance mood. Flat 2D, no 3D, no camera movement, no people, no logos, no airline or military markings.
>
> Background: flat dark navy-black (#0B1220) with a very faint light-blue engineering grid. Centre: a precise top-view technical drawing of a small twin-engine business jet pointing up: swept wings with flap lines, two engines mounted on the rear fuselage, T-tail, cockpit windows, panel lines and a dash-dot centre line. Thin light-blue lines (#8FD3F7), dark fill. Beside the nose, the tail number "NX-101" with a small blue pill reading "SNAG OPEN".
>
> Around the aircraft, on a faint dotted circle, five small node points with labels in IBM Plex Mono capitals: ENGINEERING (upper left), QUALITY (top), SUPPLY (lower left), PROCUREMENT (bottom), OPERATIONS (right). Next to each node is a small dark rectangular record card with two lines of text. Thin, faint lines join the nodes. A dotted side path between Procurement and Supply passes a small dashed box labelled "IN CLEARING". A faint label at the top reads "QUALITY — APPROVE AND AUDIT".
>
> Almost everything is still. Only one small yellow square marker (#FACC15) moves. It glides slowly and smoothly from node to node and pauses at each one: from the aircraft's left wing to Engineering, to Quality, back to Engineering, to Supply, to Procurement, to In Clearing (a longer pause), to Supply, to Engineering, then back to the aircraft. There the "SNAG OPEN" pill gently crossfades to a green pill reading "SVC", and a small green tick appears on the wing. The marker continues to Quality, then to Operations, whose card brightens, then back to the aircraft's nose and disappears. The aircraft drawing then smoothly accelerates straight up and off the top of the frame, as if taking off. A moment later it fades back in at the centre with "SNAG OPEN", and the loop restarts seamlessly.
>
> A single caption line at the bottom left in IBM Plex Sans changes with each step, with a yellow step number. Low contrast, lots of empty space, slow and professional.

**Negative prompt:** 3D, photorealistic, camera shake, zoom, lens flare, glow trails, particles, neon, gradients, people, cockpit, runway, clouds, logos, military markings, real airline livery, fast motion, flashing.

**Tip:** AI video tools often garble small text. Render the clean animation first (aircraft, nodes, marker, take-off), then add the labels, cards and captions as text layers in your editor (CapCut, Canva, Premiere, After Effects) using the table in section 4.

---

## 2. Style sheet

| Item | Value |
|---|---|
| Canvas | 1920×1080, 30 fps, 16.0 s loop (480 frames). For a panel-only version: 840×900 |
| Ground | #0B1220 flat; grid lines #8FD3F7 at 7% opacity, 80 px spacing |
| Lines | #8FD3F7, 1 px, 20% opacity; In clearing path dotted (3 on, 5 off) |
| Aircraft | stroke #8FD3F7 1.2 px, fill #0E1828; detail lines 0.7 px at 45% |
| Nodes | 4 px dot #8FD3F7 + 13 px ring at 60% |
| Record cards | fill #0F1A2B, border #8FD3F7 at 30%, radius 4; line 1 IBM Plex Mono 11 px #E6F6FF, line 2 IBM Plex Sans 11 px #9FB3C8 |
| Marker | 12×12 px square, radius 2, #FACC15, 1.5 px dark outline. No glow |
| Status pill | SNAG OPEN: blue #5AB0FF border, text #8CC8FF. SVC: green #34D399 border, text #6EE7B7 |
| Captions | IBM Plex Sans 14 px (scale ×2 at 1080p), #CFEFFF; step number IBM Plex Mono in #FACC15 |
| Easing | ease-in-out for each marker move; take-off ease-in, return fade ease-out |

Node positions (on an 840×900 panel; scale to fit the left 60% of a 1080p frame):
Aircraft snag point 350,462 · Engineering 169,305 · Quality 420,160 · Supply 169,595 · Procurement 420,740 · In clearing 255,736 · Operations 700,375 · Aircraft nose 420,352.

---

## 3. Shot script (timecodes for the 16 s loop)

| Time (s) | Marker | What happens |
|---|---|---|
| 0.0–0.8 | at left wing | Scene still. NX-101 shows SNAG OPEN (blue). Marker fades in at the snag point |
| 0.8–1.3 | → Engineering | Glides to Engineering |
| 1.3–1.9 | hold | Pause at Engineering (WO raised) |
| 1.9–2.4 | → Quality | |
| 2.4–3.2 | hold | Pause at Quality (approval) |
| 3.2–3.7 | → Engineering | Back to Engineering |
| 3.7–4.1 | hold | |
| 4.1–4.6 | → Supply | |
| 4.6–5.1 | hold | Supply: 0 on hand |
| 5.1–5.6 | → Procurement | |
| 5.6–6.1 | hold | Order placed |
| 6.1–6.5 | → In clearing | Along the dotted path |
| 6.5–7.3 | hold | Longer pause in clearing |
| 7.3–7.7 | → Supply | Received into store |
| 7.7–8.1 | hold | |
| 8.1–8.6 | → Engineering | Part issued |
| 8.6–8.8 | hold | |
| 8.8–9.3 | → aircraft wing | |
| 9.3–10.1 | hold | 9.5–9.7: pill crossfades SNAG OPEN → SVC (green); green tick appears on the wing; snag dot turns green |
| 10.1–10.6 | → Quality | |
| 10.6–11.1 | hold | Review and close |
| 11.1–11.7 | → Operations | Operations card brightens (11.5–11.8) |
| 11.7–12.2 | hold | |
| 12.2–12.8 | → aircraft nose | |
| 12.8–13.2 | fades out | Marker disappears into the aircraft |
| 13.1–14.7 | — | Take-off: aircraft drawing (with NX-101, pill and tick) accelerates straight up and leaves the frame. Lines, nodes and cards stay |
| 14.7–15.0 | — | Empty centre. Pill resets to SNAG OPEN while out of view |
| 15.0–15.8 | — | Aircraft fades back in at the centre |
| 15.8–16.0 | — | Hold, then loop to 0.0 |

---

## 4. Text layers

**Record cards (always visible; Operations card at 30% until 11.5 s, then 100% until 14 s)**

| Card | Line 1 | Line 2 |
|---|---|---|
| Engineering | WO-0417 · Open | Hyd. seep, L/H wing root |
| Quality | WO-0417 · Approved | Quality signature with PIN |
| Supply | PN NX-2210-04 | Main Store · 0 on hand |
| Procurement | PO-1182 · AOG | Shipped · release doc. due |
| Operations | NX-101 · SVC | Available for tasking |

**Captions (bottom left, crossfade 0.15 s)**

| Time (s) | Caption |
|---|---|
| 0.0–1.3 | **01** Snag reported · hydraulic seep, L/H wing |
| 1.3–1.9 | **02** Work order WO-0417 raised · Engineering |
| 1.9–3.7 | **03** Approved by Quality · back to Engineering |
| 3.7–5.1 | **04** Part requested · Supply, 0 on hand |
| 5.1–7.7 | **05** Ordered · Procurement PO-1182, in clearing |
| 7.7–8.8 | **06** Received with release document · issued to Engineering |
| 8.8–10.1 | **07** Fitted, certified with PIN · NX-101 SVC |
| 10.1–11.1 | **08** Reviewed and closed · Quality |
| 11.1–12.2 | **09** Available for tasking · Operations |
| 12.2–13.1 | **10** Tasked by Operations · NX-101 handed to the crew |
| 13.1–15.0 | **11** NX-101 airborne |
| 15.0–16.0 | (blank, then 01 fades in) |

**Fixed labels:** ENGINEERING · QUALITY · SUPPLY · PROCUREMENT · OPERATIONS · IN CLEARING · QUALITY — APPROVE AND AUDIT · NX-101.

---

## 5. Export

- MP4 (H.264), 1920×1080, 30 fps, 16 s, no audio. Make sure the first and last frames match so it loops.
- Also export a 3–5 s still or poster frame (the reduced-motion frame: everything visible, SVC, caption "One record, every department").
- For the installed app, the coded SVG version stays preferred (works offline, sharp, respects reduced motion). Use the video for pitch decks, social posts and presentations.
