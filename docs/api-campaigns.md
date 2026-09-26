# API Campaigns

__CAMPAIGN_INTRO__

An **API campaign** is a campaign type you create once in the dashboard and then trigger from your own website, app or backend. Each API request sends the campaign's WhatsApp template to **one recipient**.

## Overview {#overview}

Create one in **Campaigns → New campaign → API Campaign**: give it a name and pick an approved WhatsApp template. The campaign page then shows its endpoint and the delivery stats (sent, delivered, read, replied, failed) for every message sent through it.

Unlike a broadcast, an API campaign has no audience list. The audience is whoever your code sends to. To send one template to a list of recipients in a single request instead, see [`POST /api/v1/broadcasts`](/docs#post-api-v1-broadcasts).

## Authentication {#authentication}

Requests authenticate with an **API key** sent as a bearer token. The key needs the `broadcasts:send` scope.

- How keys work and how to create one: [Authentication](/docs#authentication) and [Scopes](/docs#scopes).
- Create or revoke keys in [Settings → API keys](/settings?tab=api). Documentation never shows a real key — examples use `YOUR_API_KEY`.


## Endpoint {#endpoint}

### `POST /api/v1/campaigns/{campaign_id}/send` {#send-a-message}

Sends the campaign's template to one recipient. The message is sent synchronously — the response tells you whether Meta accepted it.

```
POST __ORIGIN__/api/v1/campaigns/__CAMPAIGN_ID__/send
```

## Request {#request}

Headers:

| Header          | Value                    |
| --------------- | ------------------------ |
| `Authorization` | `Bearer YOUR_API_KEY`    |
| `Content-Type`  | `application/json`       |

Body:

| Field    | Type       | Required | Description                                                         |
| -------- | ---------- | -------- | ------------------------------------------------------------------- |
| `to`     | `string`   | Yes      | Recipient phone in international format, with a leading `+` and country code (`+14155550123`) |
| `params` | `string[]` | No       | Values for the template's variables, in order: the first value fills the first variable, and so on. Omit for templates without variables |

```json
{
  "to": "+14155550123",
  "params": ["Jane"]
}
```

## Recipient handling {#recipient-handling}

- `to` must start with `+` followed by the country code. A number without the `+` is rejected with `400 bad_request` — the API does not guess the country.
- The recipient is matched to an existing contact by phone number, or a new contact is created.
- Every request sends one message. Sending twice to the same number sends two messages.
- Delivery and read status for each message are added to the campaign's stats as Meta reports them.

## Response {#response}

On success (`200`):

```json
{
  "data": {
    "campaign_id": "…",
    "recipient_id": "…",
    "message_id": "wamid.…",
    "status": "sent"
  }
}
```

Failures use the standard [response envelope](/docs#response-envelope): `{ "error": { "code", "message" } }`.

## Errors {#errors}

| Status | `code`                    | Meaning                                                       |
| ------ | ------------------------- | ------------------------------------------------------------- |
| 400    | `bad_request`             | Body is not a JSON object, or `to` is missing / not an international number |
| 400    | `whatsapp_not_configured` | WhatsApp is not connected for this account                    |
| 401    | `unauthorized`            | Missing / malformed / unknown / revoked / expired key         |
| 403    | `forbidden`               | Valid key, but missing the `broadcasts:send` scope            |
| 404    | `not_found`               | No API campaign with this id in your account                  |
| 409    | `conflict`                | The campaign is not active                                    |
| 429    | `rate_limited`            | Per-key [rate limit](/docs#rate-limits) exceeded              |
| 500    | `template_malformed`      | The campaign's template is malformed locally — run **Sync from Meta** in Settings |
| 500    | `internal`                | Server error                                                  |
| 502    | `send_failed`             | Meta rejected the message; `error.message` carries the reason |

## Examples {#examples}

Call the API from your **backend**. Never put an API key in code that runs in a visitor's browser.

### cURL {#curl}

```bash
curl -X POST __ORIGIN__/api/v1/campaigns/__CAMPAIGN_ID__/send \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
        "to": "+14155550123",
        "params": ["Jane"]
      }'
```

### JavaScript {#javascript}

```javascript
const res = await fetch(
  "__ORIGIN__/api/v1/campaigns/__CAMPAIGN_ID__/send",
  {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.CRM_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ to: "+14155550123", params: ["Jane"] }),
  }
);

const body = await res.json();
if (!res.ok) throw new Error(body.error.message);
console.log(body.data.message_id);
```

## Testing {#testing}

1. Verify your key first with [`GET /api/v1/me`](/docs#get-api-v1-me).
2. Send the campaign to your own WhatsApp number using the examples above.
3. Open the campaign in **Campaigns** — the message appears in its stats and moves from sent to delivered to read as Meta reports it.