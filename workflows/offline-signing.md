# Offline signing (D-217)

**Status:** agreed 9 Oct 2026 (Option A). Built in Phase 1C.
**Supersedes:** D-104 for dispositions, clearing and certifying. Approving, granting privileges and chain set-up stay online only.

---

## 1. Summary

When there is no connection, a certifying engineer can still sign a disposition, a DDLS or NADD clearance, or a work order certification. The signature is **provisional** until the server checks it.

```
Offline on an enrolled device
  Engineer signs with PIN ─► entry saved on the device
                             marked "Signed offline · awaiting server check"
                             shown that way on screen and on every print
Connection returns
  Device sends the queue ─► server checks:
                              1. the PIN signature is genuine
                              2. the authorization was valid at the time of signing
                              3. the record did not change in the meantime
                              4. the device was not reported lost before that time
     all pass ─► entry becomes final; device time, estimated time and server time kept (D-024)
     any fail ─► entry returned to the engineer with the reason; Quality is told
```

**Is offline signing needed often?** Nexus runs on the operator's own server (D-101). If that server sits on the base network, an **internet** outage does not stop Nexus on base Wi-Fi. Offline signing is for places the base network does not reach (outstations, detachments, dead spots on the apron) and for base network failures.

---

## 2. The stolen device problem, and how it is handled

**The risk:** a phone that can check a PIN by itself can be attacked by trying every PIN. A 4-digit PIN falls in seconds, a 6-digit one in minutes, if the phone holds anything that says "this PIN is right".

**The answer: the phone never knows whether a PIN is right.**

| # | Safeguard | What it stops |
|---|---|---|
| S-1 | **No PIN check on the device.** At each online sign-in the server gives the device a personal signing key, locked with the user's PIN. Any PIN "unlocks" something, but only the right PIN gives the real key, and **only the server can tell the difference**. A thief guessing PINs gets no feedback. | Guessing the PIN offline |
| S-2 | **Wrong signatures are counted by the server.** Three offline signatures with a wrong key from one device: the device is blocked and Quality is alerted. | Guessing by trial and error through the queue |
| S-3 | **Enrolled devices only.** A Super Admin enrols each device allowed to sign offline (e.g. the line tablets). Personal phones can report and view offline, but not sign. | Signing from any phone |
| S-4 | **6-digit PIN** for anyone allowed to sign offline. | Short PINs |
| S-5 | **Offline signing expires.** If a device has not synced for 72 hours (setting), it stops offering offline signing until it reconnects. | A stolen device used for days |
| S-6 | **Report lost → revoke.** A Super Admin marks the device lost. Every offline signature made on it after the reported time is rejected and listed for Quality. | Misuse after theft |
| S-7 | **Quality review list** of all offline signatures, with the time gap between signing and receipt. | Anything unusual going unnoticed |
| S-8 | **Device screen lock required** (operator policy), and Nexus locks itself after inactivity (setting). | Casual access to an unlocked tablet |

A small typo check (one in sixteen wrong PINs is let through) warns the engineer of most mistyped PINs on the spot. It does not help a thief, who is still left with tens of thousands of candidates and no way to tell which is right.

---

## 3. Time: why not GPS, and what is used

**Can the app read GPS time?** Not reliably. A web app (PWA) gets location from the phone, but the time stamp that comes with it is the phone's own clock, not the satellite clock. A native app could read GPS time on some phones; a PWA cannot.

**What Nexus uses instead:**

| Source | When | Trust |
|---|---|---|
| **Last server time + tamper-proof elapsed timer** | The app has not been closed since it last talked to the server. The browser's elapsed-time counter cannot be changed by the user. | High: shown as the signing time |
| **Device clock corrected by the last known difference** | The app was restarted while offline | Medium: shown as "clock estimate" |
| **Server receipt time** | Always added on sync | Authoritative for the record (D-024) |

All three are stored. If the estimate and the server receipt disagree in a way that is not possible (e.g. signed "after" it was received), the entry is flagged for Quality.

**Recommended hardware (base):** a **GPS-disciplined network time server** on the base network. It sets every device's clock from satellites even with no internet. Cost is modest; this is the practical way to "use the GPS clock".

---

## 4. What can and cannot be signed offline

| Action | Offline? |
|---|---|
| Report snag, propose NADD, attach photos, record work entries | Yes (D-103, not a signature) |
| Dispositions: MEL, DDLS, NADD, no fault found | **Yes, provisional (D-217)** |
| Clear a DDLS entry, rectify a NADD, certify a work order | **Yes, provisional (D-217)** |
| Set tail status | Yes, provisional; the fleet board shows "provisional" until accepted |
| Approve or reject (Quality, CO) | **No** (needs a live check of the whole chain) |
| Request a work order or extension | Queued as a request; approvals are online |
| Grant privileges, change chains, load MEL | **No** |

---

## 5. Answers (9 Oct 2026)

| # | Question | Answer |
|---|---|---|
| Q-OS1 | Which devices sign offline? | **Line tablets only**, enrolled by a Super Admin |
| Q-OS2 | Offline limit | **72 hours** (setting `offline.max_hours`) |
| Q-OS3 | Show provisional releases? | **Yes.** On the signing tablet, anything signed offline shows "provisional" until the server accepts it. The server (and so Operations elsewhere) only learns of it when the tablet reconnects; from then on the record carries "signed offline at … · received …" |

## 6. How it is built (Phase 1C)

| Piece | Where |
|---|---|
| Devices: request, enrol, revoke, report lost | `public.device`, `app.request_device`, `app.enrol_device`, `app.revoke_device` |
| Personal offline key per user and tablet, issued online with a 6-digit PIN | `app.offline_key`, `app.issue_offline_key` |
| On the tablet: the key is stored mixed with a value made from the PIN (no check that a thief could use) | `app/src/lib/offline/signing.ts` |
| Each offline signature is a code made from the key and the exact text of what was signed | same |
| Server check on sync, then the action runs as if signed online at that time | `app.submit_offline_signature` |
| Every offline signature, accepted or not, for Quality | `public.offline_signature`, Offline signatures screen |
