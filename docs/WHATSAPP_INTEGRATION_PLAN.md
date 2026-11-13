# WhatsApp Integration Plan

> Status: WhatsApp mock is working end-to-end. This document covers what must be done to go live with the Meta Business API and to handle inbound customer replies and confirmations.

---

## Current state

| What exists | Where |
|---|---|
| `IWhatsAppService` interface with `sendMessage` + `sendTemplate` | `apps/api/src/modules/whatsapp/whatsapp.interface.ts` |
| `WhatsAppMockService` — logs to console | `whatsapp-mock.service.ts` |
| `WhatsAppMetaService` — calls `graph.facebook.com/v18.0` | `whatsapp-meta.service.ts` |
| Provider factory: `WHATSAPP_PROVIDER=mock\|meta` | `whatsapp.module.ts` |
| Approval gate: `ApprovalsService.approve()` calls `whatsapp.sendMessage()` only for `kind=client_update` | `approvals.service.ts` |
| `Approval` schema has `whatsappScheduled: boolean` | `approval.schema.ts` |

**Gap:** Inbound messages from customers are not received, parsed, or acted upon. The flow is one-way outbound only.

---

## Phase A — Production outbound (switch mock → Meta)

### A1. WhatsApp Business Account setup

1. Create a **Meta Business Manager** account at [business.facebook.com](https://business.facebook.com)
2. Add a WhatsApp Business App (App type: Business)
3. Add a phone number and complete the business verification
4. Get a **Permanent System User Access Token** with scope:
   - `whatsapp_business_messaging`
   - `whatsapp_business_management`
5. Copy the Phone Number ID from the App Dashboard

```env
WHATSAPP_PROVIDER=meta
WHATSAPP_API_TOKEN=<permanent-system-user-token>
WHATSAPP_PHONE_NUMBER_ID=<phone-number-id>
```

### A2. Message templates (required for first contact)

Meta requires pre-approved templates to initiate conversations. Templates must be submitted via the [Meta Business Manager](https://business.facebook.com/wa/manage/message-templates/).

**Templates needed:**

| Template name | Category | Variables | When used |
|---|---|---|---|
| `project_update` | UTILITY | `{{client_name}}`, `{{project_title}}`, `{{update_body}}` | Client update approval |
| `quotation_ready` | UTILITY | `{{client_name}}`, `{{project_title}}`, `{{amount}}` | Quotation approval |
| `order_confirmed` | UTILITY | `{{client_name}}`, `{{project_title}}` | Order confirmation approval |
| `drawing_ready` | UTILITY | `{{client_name}}`, `{{project_title}}`, `{{drive_link}}` | Drawing approval |
| `handover_complete` | UTILITY | `{{client_name}}`, `{{project_title}}` | Final handover completion |

### A3. Update `WhatsAppMetaService.sendTemplate()`

The current implementation constructs template payload correctly. Add language detection:

```typescript
// apps/api/src/modules/whatsapp/whatsapp-meta.service.ts
async sendTemplate(to: string, templateName: string, params: string[], language = 'en') {
  const body = {
    messaging_product: 'whatsapp',
    to,
    type: 'template',
    template: {
      name: templateName,
      language: { code: language === 'ta' ? 'ta' : 'en' }, // Tamil template variant if approved
      components: [{ type: 'body', parameters: params.map(text => ({ type: 'text', text })) }],
    },
  };
  // ... rest unchanged
}
```

### A4. Update `ApprovalsService.approve()` to use templates

Instead of `sendMessage` (free-form, only valid within 24h customer service window), use `sendTemplate`:

```typescript
// After approval, switch to template-based send:
await this.whatsapp.sendTemplate(
  project.client.phone,
  'project_update',
  [project.client.name, project.title, approval.generatedMessage],
  approval.language ?? 'en',
);
```

> **Important:** Free-form `sendMessage` only works if the client has messaged within the last 24 hours. For first-touch or periodic updates, templates are mandatory.

### A5. Add `language` field to Approval schema

```typescript
// approval.schema.ts — add:
@Prop({ type: String, enum: ['en', 'ta'], default: 'en' })
language: string;
```

Set it from the `kind` and the `generatedMessage` language when the approval is requested.

---

## Phase B — Inbound webhook (customer replies + confirmations)

This is the core of "message approval from the customer" — allowing clients to reply to WhatsApp messages and have those replies captured and acted upon in the CRM.

### B1. Webhook endpoint

Meta sends all inbound messages to a single webhook URL. Create:

```
POST /webhooks/whatsapp
GET  /webhooks/whatsapp   ← Meta verification (hub.mode=subscribe + hub.verify_token)
```

**New module:** `apps/api/src/modules/webhooks/`

```typescript
// webhooks.controller.ts
@Controller('webhooks')
export class WebhooksController {
  @Get('whatsapp')
  verify(@Query() q: { 'hub.mode': string; 'hub.verify_token': string; 'hub.challenge': string }) {
    if (q['hub.mode'] === 'subscribe' && q['hub.verify_token'] === process.env.WA_VERIFY_TOKEN) {
      return Number(q['hub.challenge']);
    }
    throw new ForbiddenException();
  }

  @Post('whatsapp')
  receive(@Body() body: WhatsAppWebhookPayload) {
    return this.webhooksService.handleInbound(body);
  }
}
```

Add to `.env`:
```env
WA_VERIFY_TOKEN=<random-secret-you-choose>   # must match what you set in Meta dashboard
```

### B2. Inbound message types and routing

The webhook payload contains:

```json
{
  "entry": [{
    "changes": [{
      "value": {
        "messages": [{
          "from": "91xxxxxxxxxx",   // client phone (no + prefix)
          "type": "text",
          "text": { "body": "Looks good, please proceed" },
          "timestamp": "1700000000"
        }],
        "statuses": [...]
      }
    }]
  }]
}
```

**`WebhooksService.handleInbound()`** must:

1. Look up the client by phone number from the `messages[0].from` field
2. Look up the most recent pending or recently-approved approval for that client's projects
3. Classify the reply:

| Reply type | Detection | Action |
|---|---|---|
| Customer confirmation | "yes", "ok", "confirm", "proceed", "approved" | Mark `customerConfirmed: true` on the linked approval |
| Customer rejection | "no", "cancel", "stop", "reject" | Create a blocker or alert the MD |
| Free-form reply | Anything else | Store as a `ClientMessage` and notify MD/GM via in-app notification |
| Stop opt-out | `STOP` | Set `client.whatsappOptIn = false` |

### B3. Schema changes

#### Approval schema — add customer confirmation fields

```typescript
// approval.schema.ts — add:
@Prop({ default: false })
customerConfirmed: boolean;

@Prop()
customerConfirmedAt: Date;

@Prop({ trim: true })
customerReplyText: string;
```

#### New schema: `ClientMessage`

Stores inbound messages from clients that are not direct confirmations.

```typescript
@Schema({ timestamps: true })
export class ClientMessage {
  @Prop({ type: Types.ObjectId, ref: 'Client', required: true })
  client: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Project' })
  project: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Approval' })
  linkedApproval: Types.ObjectId;

  @Prop({ required: true })
  body: string;

  @Prop({ default: false })
  isRead: boolean;

  @Prop()
  receivedAt: Date;
}
```

### B4. Notification to MD/GM on customer reply

When a customer reply comes in, push a real-time notification:

```typescript
// After classifying the reply:
this.eventEmitter.emit('client.replied', {
  clientId: client._id,
  projectId: project._id,
  approvalId: approval._id,
  body: message.text.body,
  isConfirmation: customerConfirmed,
});
```

The `MessagesGateway` (Socket.IO) listens for `client.replied` and emits to the MD/GM room:

```typescript
@OnEvent('client.replied')
handleClientReply(payload) {
  this.server.to('role:md').to('role:gm').emit('notification', {
    type: 'client_reply',
    message: `${payload.clientName} replied to the project update`,
    ...payload,
  });
}
```

### B5. UI — Client reply inbox

Add a **Client Replies** tab to the Approvals page showing:

- Client name and project
- The message we sent (linked approval)
- Their reply text and timestamp
- Confirmation status chip (Confirmed / Rejected / Awaiting / Replied)
- Quick actions: Mark as read, Create blocker (for rejections), Send follow-up

---

## Phase C — Two-way conversation flow (customer confirmation required)

This adds a new approval `kind`: `requires_customer_confirmation` — the MD approves internally and then waits for the customer to confirm before the project advances.

### C1. New approval kind

```typescript
// approval.schema.ts — extend enum:
enum: ['quotation', 'order_confirmation', 'client_update', 'drawing', 'customer_sign_off']
```

### C2. Flow

```
Staff requests approval (kind=customer_sign_off)
         ↓
MD/GM reviews and approves internally
         ↓
System sends WhatsApp to client:
  "Please reply YES to confirm your project is ready to move to [next stage]"
         ↓
Client replies YES/NO on WhatsApp
         ↓
Webhook receives reply → marks customerConfirmed=true/false
         ↓
System emits notification to MD/GM
         ↓
MD triggers project.advance_stage (or raises a blocker)
```

### C3. Template for sign-off request

```
Template name: customer_sign_off
Body: "Hi {{1}}, your project *{{2}}* is ready to move to the {{3}} stage.
Reply *YES* to confirm or *NO* to raise a concern.
— Team Trendy Interios"
```

---

## Phase D — Delivery status tracking

Meta sends delivery receipts via the same webhook (`statuses` array):

```json
{
  "statuses": [{
    "id": "wamid.xxxx",
    "status": "delivered",   // sent | delivered | read | failed
    "timestamp": "1700000000",
    "recipient_id": "91xxxxxxxxxx"
  }]
}
```

Store `wamid` (WhatsApp message ID) on the `Approval` document and update delivery status:

```typescript
// approval.schema.ts — add:
@Prop()
whatsappMessageId: string;   // wamid returned by Meta API

@Prop({ type: String, enum: ['sent', 'delivered', 'read', 'failed'] })
whatsappDeliveryStatus: string;
```

Show delivery status chips on approval cards in the web UI:

- 🕐 Sending…
- ✓ Sent
- ✓✓ Delivered
- ✓✓ Read (blue ticks)
- ✗ Failed (with retry button)

---


## Implementation order

| Phase | Effort | Priority | Depends on |
|---|---|---|---|
| A — Production outbound (templates) | 2–3 days | P0 | Meta account + template approval (takes 24–48h) |
| B — Inbound webhook + client reply inbox | 3–4 days | P0 | Phase A |
| C — Customer sign-off flow | 2 days | P1 | Phase B |
| D — Delivery status tracking | 1 day | P1 | Phase A |

---

## Meta account checklist before going live

- [ ] Business Manager account created and verified
- [ ] WhatsApp Business App created
- [ ] Phone number added and verified
- [ ] Business verification submitted (takes 1–5 days)
- [ ] Permanent System User token generated (not the temporary 24h token)
- [ ] All message templates submitted and approved
- [ ] Webhook URL registered in Meta App Dashboard
- [ ] `WA_VERIFY_TOKEN` set in `.env` and matching Meta dashboard
- [ ] Webhook subscribed to: `messages`, `message_deliveries`, `message_reads`
- [ ] Test with Meta's sandbox before pointing at a real phone number
- [ ] Opt-out handling live (`STOP` → `client.whatsappOptIn = false`)

---

## Security constraints (unchanged)

1. `whatsapp:send_approved` is a system-only internal permission — never assignable to a user role
2. No employee can trigger a WhatsApp send directly; all sends go through `ApprovalsService.approve()`
3. Inbound webhook verifies `hub.verify_token` before processing any payload
4. Client phone numbers are never exposed to the browser; all lookups happen server-side
5. Opt-out (`STOP`) must be honoured immediately and permanently
