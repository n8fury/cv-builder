# n8n integration — AI-assisted drafting

An optional layer over the manual editor (SPEC §10). You post a job
description to a webhook; an LLM picks which of *your* library items suit it
and in what order; the draft is saved as a variant, rendered to PDF, and
emailed to you. You then open it in the editor and fine-tune. The draft is a
starting point, never the final output.

**The model writes nothing.** It selects and orders library IDs, and every ID
it returns is checked against the profile's `content-library.json` before
anything is written. A draft naming an item that does not exist is rejected
whole, with the offending IDs named in the 400 body. That check lives in
`app/api/variants/route.ts`, not in the prompt, because a prompt is a request
and this is a rule.

The exported workflow lives at **[`n8n/cv-draft-workflow.json`](../n8n/cv-draft-workflow.json)** — import it into n8n and fill
in the credentials (see *Setup* below).

---

## Webhook payload

`POST /webhook/cv-draft`

```json
{
  "profileId": "jordan",
  "variantId": "acme-backend",
  "targetRole": "Senior Backend Engineer",
  "jobDescription": "Full text of the posting…",
  "notifyEmail": "you@example.com"
}
```

| Field | Meaning |
|---|---|
| `profileId` | Which profile's library to draft from. Must exist. |
| `variantId` | The variant file to create. Slug only; **must not already exist** — the save is an exclusive create, so a repeat delivery returns 409 rather than overwriting curation you have since edited by hand. |
| `targetRole` | One line, used in the prompt and the email subject. |
| `jobDescription` | The posting. Plain text. |
| `notifyEmail` | Where the finished PDF goes. |

---

## Node sequence

| # | Node | What it does |
|---|---|---|
| 1 | **Webhook** (`POST /cv-draft`) | Receives the payload above. |
| 2 | **Config** (Set) | The one place to edit: `baseUrl` (where this app runs) and `model`. |
| 3 | **Fetch library catalogue** (HTTP) | `GET {baseUrl}/api/library?profileId=…&format=catalogue` → `{ systemPrompt, catalogue }`. The prompt is served from the repo (`lib/n8n/prompt.ts`) so it stays reviewable and tested rather than pasted into a workflow. |
| 4 | **Draft the variant** (HTTP) | `POST https://api.anthropic.com/v1/messages` with that system prompt, the catalogue, the role and the posting. Model `claude-opus-5`, `max_tokens: 16000`. |
| 5 | **Parse draft** (Code) | Pulls the JSON out of the response (tolerating a stray code fence) and shapes the request body. Anything else malformed fails here, before the store. |
| 6 | **Save variant** (HTTP) | `POST {baseUrl}/api/variants`. Validates the schema *and* every reference; returns `editPath` and `exportPath`. |
| 7 | **Render PDF** (HTTP) | `GET {baseUrl}{exportPath}` as a binary — the same Puppeteer route the Download button uses. |
| 8 | **Email the draft** (Send Email) | The PDF attached, plus a link straight into the editor. |

---

## The API endpoints it uses

Both are added for this workflow and are useful on their own.

### `GET /api/library?profileId=<id>`

Returns `{ profileId, library }` — the parsed content library.
With `&format=catalogue`, returns `{ profileId, systemPrompt, catalogue }`
instead: the drafting prompt and an `id — text` listing of every library item
with its tags, which is all the model is allowed to choose from.

`400` without a `profileId`, `404` for one that does not exist.

### `POST /api/variants`

```json
{
  "profileId": "jordan",
  "variantId": "acme-backend",
  "tag": "acme-backend",
  "label": "Acme — backend",
  "sections": [ /* … */ ],
  "overwrite": false
}
```

`schemaVersion`, `createdAt` and `updatedAt` are set by the endpoint — they
describe the write, so they are not accepted from the caller. `sections` is
the variant schema of SPEC §6.2, unchanged.

| Status | When |
|---|---|
| `201` | Written. Body: `{ profileId, variantId, editPath, exportPath }`. |
| `400` | Body is not JSON; fails the schema (strict — an unknown key is an error, not a shrug); a `profileId`/`variantId` that is not a slug; or **any reference the library cannot satisfy** — the body carries `unknownIds` with every one of them. |
| `404` | No such profile. |
| `409` | That variant already exists. Send `"overwrite": true` to replace it deliberately. |
| `401` | Only when `CV_API_TOKEN` is set and the request did not present it. |

---

## Setup — what you do by hand

1. **Import the workflow.** n8n → *Import from File* → `n8n/cv-draft-workflow.json`.
   Or from the CLI: `n8n import:workflow --input=n8n/cv-draft-workflow.json`.
2. **Edit the Config node.** Set `baseUrl` to wherever this app is reachable
   *from n8n* — `http://localhost:3000` only works if n8n runs on the same
   machine; in Docker it is usually `http://host.docker.internal:3000`.
3. **Anthropic credential.** Create a *Header Auth* credential named
   `x-api-key` with your API key as the value, and select it on the
   **Draft the variant** node. (The `anthropic-version: 2023-06-01` header is
   already set on the node.) The imported JSON has a placeholder credential id
   — n8n will show the node as needing one until you pick it.
4. **SMTP credential.** Select one on **Email the draft**.
5. **Raise the timeout on Render PDF.** Chromium launches per request (SPEC
   §8), so a cold export can take several seconds.
6. **Activate the workflow** and note the production webhook URL.

### Optional: protect the write endpoint

The app has no authentication anywhere (SPEC §9) and is meant to run on
localhost. If n8n is *not* on the same machine, set `CV_API_TOKEN` in the
app's environment; every `POST /api/variants` then needs
`Authorization: Bearer <token>`, which you add as a second Header Auth
credential on the **Save variant** node. Unset, the endpoint is as open as the
rest of the app.

---

## Testing it

```sh
curl -X POST http://localhost:5678/webhook/cv-draft \
  -H 'content-type: application/json' \
  -d '{
    "profileId": "jordan",
    "variantId": "test-draft",
    "targetRole": "Backend Engineer",
    "jobDescription": "We need someone who has shipped production APIs.",
    "notifyEmail": "you@example.com"
  }'
```

Expect a new file at `data/profiles/jordan/variants/test-draft.json`, and the
PDF in your inbox. Delete the variant between runs, or the save returns 409.

**If the save returns 400 with `unknownIds`**, the model invented content and
the run is working exactly as designed — nothing was written. Reruns usually
succeed; a model that does it repeatedly is a prompt problem, and the prompt
is `lib/n8n/prompt.ts`, covered by `lib/n8n/prompt.test.ts`.
