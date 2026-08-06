# WhatsApp Cloud API (Kaaraalan)

Dealer-friendly order alerts via Meta WhatsApp Business Cloud API.

## Flows implemented

| # | Trigger | Who gets WhatsApp | Content |
|---|---------|-------------------|---------|
| 1 | Dealer **places order** | Dealer (`Dealer.phone`) | Order received + items + pending status + due date |
| 2 | Dealer **places order** | Optional **admin** (`WHATSAPP_ADMIN_PHONE`) | New order alert (order #, dealer, crates, due) |
| 3 | Admin **approves** | Dealer | Approved + due date + items |
| 4 | Admin **rejects** | Dealer | Rejected + reason |
| 5 | Admin **fulfills / dispatches** | Dealer | Dispatched + expected arrival (due date) |
| 6 | Dealer **messages** business WhatsApp | Admin portal | Inbound logged + admin notification + WebSocket |

WhatsApp failures **never** block order create/approve/reject/fulfill.

---

## Meta webhook (fill in App Dashboard)

After this code is deployed to Railway:

| Field | Value |
|-------|--------|
| **Callback URL** | `https://api.kaaraalan.in/api/v1/whatsapp/webhook` |
| **Verify token** | `kaaraalan_wa_verify_2026` (must match `WHATSAPP_VERIFY_TOKEN`) |

Subscribe fields: **messages** (and message status if listed).

Leave client certificate **off**.

Then **Verify and save**. Publish the app for production webhook delivery.

---

## Railway variables

Set on the backend service:

```env
WHATSAPP_ENABLED=true
WHATSAPP_TOKEN=<permanent System User token>
WHATSAPP_PHONE_NUMBER_ID=1173633149174419
WHATSAPP_WABA_ID=1531290778102440
WHATSAPP_API_VERSION=v21.0
WHATSAPP_VERIFY_TOKEN=kaaraalan_wa_verify_2026
WHATSAPP_APP_SECRET=<optional Meta App Secret for signature check>
WHATSAPP_ADMIN_PHONE=91XXXXXXXXXX
WHATSAPP_USE_TEMPLATES=true
WHATSAPP_ALLOW_TEXT_FALLBACK=true
WHATSAPP_TEMPLATE_LANG=en
WHATSAPP_TEMPLATE_ORDER_PLACED=order_received
WHATSAPP_TEMPLATE_ORDER_APPROVED=order_approved
WHATSAPP_TEMPLATE_ORDER_REJECTED=order_rejected
WHATSAPP_TEMPLATE_ORDER_DISPATCHED=order_dispatched
```

Redeploy after changing variables. Install includes `httpx` (see `requirements.txt`).

---

## Message templates to create in WhatsApp Manager

Create **Utility** templates (category Utility), language `en` (or change `WHATSAPP_TEMPLATE_LANG`).

### 1. `order_received` (4 body variables)

Body example:

```
KAARAALAN GOLI SODA

Hello {{1}},

Your order has been received successfully.

Order ID: {{2}}
Items: {{3}}
Status: Pending Approval
Expected delivery: {{4}}

We will notify you once the order is approved. Thank you.
```

### 2. `order_approved` (3 body variables)

```
KAARAALAN GOLI SODA

Hello {{1}},

Your order has been approved.

Order ID: {{2}}
Expected Delivery: {{3}}

Thank you.
```

### 3. `order_rejected` (2 body variables)

```
KAARAALAN GOLI SODA

Your order {{1}} has been rejected.

Reason: {{2}}

Please contact the administrator.
```

### 4. `order_dispatched` (2 body variables)

```
KAARAALAN GOLI SODA

Your order {{1}} has been dispatched.

Expected arrival: {{2}}

Thank you for choosing KAARAALAN GOLI SODA.
```

Until templates are approved, keep `WHATSAPP_ALLOW_TEXT_FALLBACK=true`.  
Text works best inside the **24-hour** customer service window; for cold outbound you need approved templates + payment method on Meta.

---

## Dealer phone format

Stored on `dealers.phone`. Normalized automatically:

- `9361934041` → `919361934041`
- `+91 93619 34041` → `919361934041`

Ensure every dealer has a valid Indian mobile for WhatsApp delivery.

---

## Code map

| Piece | Path |
|-------|------|
| Config | `backend/app/core/config.py` |
| Send client | `backend/app/services/whatsapp.py` |
| Message copy | `backend/app/services/whatsapp_messages.py` |
| Order hooks | `backend/app/services/whatsapp_notify.py` + `crud/orders.py` |
| Webhook | `GET/POST /api/v1/whatsapp/webhook` → `api/v1/whatsapp.py` |

---

## Payment on Meta

You can add Meta billing **last**. Without it, service replies in the 24h window may still work; business-initiated utility templates generally need a payment method.
