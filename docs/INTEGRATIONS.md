# Third-Party Integrations

Every external service is accessed through an injectable NestJS provider. A `mock` mode is always available so the app runs fully offline without any external credentials.

---

## 1. MongoDB Atlas

**Used for:** Primary database — all application data.

**Provider module:** `@nestjs/mongoose` / `mongoose`

### Setup

1. Create a free cluster at [cloud.mongodb.com](https://cloud.mongodb.com)
2. Add a database user with read/write access
3. Whitelist your IP address (or `0.0.0.0/0` for development)
4. Copy the connection string into `MONGODB_URI`

```env
MONGODB_URI=mongodb+srv://<user>:<password>@cluster0.xxxxx.mongodb.net/trendy_interios?retryWrites=true&w=majority
```

### Collections created automatically by Mongoose

`users`, `roles`, `departments`, `clients`, `projects`, `tasks`, `handovers`, `blockers`, `approvals`, `tidocuments`, `messages`, `chatgroups`, `slaSettings`, `activityLog`

---

## 2. Google Drive

**Used for:** File storage — proof photos, drawings, invoices, quotations.

**Provider:** `DriveService` (`apps/api/src/modules/drive/`)

**Switch:** `DRIVE_PROVIDER=mock | google`

### Mock mode (default)

Files are logged to console and a placeholder link is returned. No credentials needed.

### Google Drive (production)

1. Create a project in [Google Cloud Console](https://console.cloud.google.com)
2. Enable the **Google Drive API**
3. Create a **Service Account** and grant it access to your shared Drive folder
4. Download the JSON key and paste its content (minified to one line) into `GOOGLE_DRIVE_SERVICE_ACCOUNT`

```env
DRIVE_PROVIDER=google
GOOGLE_DRIVE_SERVICE_ACCOUNT={"type":"service_account","project_id":"...","private_key":"...","client_email":"..."}
```

> The service account must be added as an editor on the target Drive folder.

---

## 3. Cloudinary (alternative storage)

**Used for:** Image/video storage when Google Drive is not preferred.

**Provider:** `drive-cloudinary.service.ts`

**Switch:** `DRIVE_PROVIDER=cloudinary`

```env
DRIVE_PROVIDER=cloudinary
CLOUDINARY_CLOUD_NAME=
CLOUDINARY_API_KEY=
CLOUDINARY_API_SECRET=
```

Sign up at [cloudinary.com](https://cloudinary.com) and copy the credentials from the dashboard.

---

## 4. WhatsApp Business API (Meta)

**Used for:** Sending pre-approved client updates via WhatsApp.

**Provider:** `WhatsAppService` (`apps/api/src/modules/whatsapp/`)

**Switch:** `WHATSAPP_PROVIDER=mock | meta`

### Mock mode (default)

Messages are logged to console. No credentials needed. The approval gate still functions — messages are "sent" but only logged.

### Meta WhatsApp Business API (production)

1. Create a Meta Business account and a WhatsApp Business App at [developers.facebook.com](https://developers.facebook.com)
2. Add the **WhatsApp** product to your app
3. Get a **permanent system user access token** with `whatsapp_business_messaging` permission
4. Retrieve your **Phone Number ID** from the app dashboard

```env
WHATSAPP_PROVIDER=meta
WHATSAPP_API_TOKEN=<permanent-system-user-token>
WHATSAPP_PHONE_NUMBER_ID=<phone-number-id>
```

> Only pre-approved message templates can be sent to clients who haven't messaged in the last 24 hours. For free-form messages, the client must initiate the conversation.

**Security constraint:** WhatsApp sends are triggered exclusively by the approval service after an approval document reaches `approved` status. There is no endpoint that allows staff to message clients directly.

---

## 5. Firebase Cloud Messaging (FCM)

**Used for:** Push notifications to the mobile app (Expo).

**Provider:** `NotificationsService` (`apps/api/src/modules/notifications/`)

### Setup

1. Create a Firebase project at [console.firebase.google.com](https://console.firebase.google.com)
2. Add an Android/iOS app and download the `google-services.json` / `GoogleService-Info.plist`
3. Generate a **service account private key** from Project Settings → Service Accounts
4. Copy the values into the API environment:

```env
FCM_PROJECT_ID=your-firebase-project-id
FCM_CLIENT_EMAIL=firebase-adminsdk-xxxxx@your-project.iam.gserviceaccount.com
FCM_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
```

5. Place `google-services.json` in `apps/mobile/android/app/`
6. FCM tokens are saved per user via `POST /notifications/register-token` after login on the mobile app

---

## 6. AI Message Drafting (Groq / LLaMA)

**Used for:** Drafting WhatsApp client update messages and Tamil translations.

**Provider:** `MessageGeneratorService` (`apps/api/src/modules/message-generator/`)

**Model:** `llama-3.3-70b-versatile` via Groq API

### Setup

```env
GROQ_API_KEY=gsk_xxxxxxxxxxxxxxxxxxxx
```

Sign up for a free API key at [console.groq.com](https://console.groq.com).

### Mock mode

If `GROQ_API_KEY` is not set (or provider is `mock`), the service returns a deterministic placeholder message. Tamil translation falls back to prepending `(தமிழ்)` to the original text.

### How it works

1. Staff fills in raw notes and selects language (English or Tamil)
2. `POST /approvals/generate-message` calls the LLM with a structured prompt
3. The LLM returns a client-friendly message (and a Tamil translation of the raw notes when `language=ta`)
4. MD/GM reviews and edits before approving
5. After approval, `WhatsAppService` sends the finalised message

---

## 7. MFA (TOTP)

**Used for:** Two-factor authentication for MD, GM, and users with `approvals:decide` or `blockers:trigger_sla`.

**Libraries:** `speakeasy` (TOTP), `qrcode` (QR code generation)

### Flow

1. `POST /auth/mfa/setup` — generates a TOTP secret and QR code URI
2. User scans the QR code with an authenticator app (Google Authenticator, Authy, etc.)
3. `POST /auth/mfa/verify` — verifies the TOTP code and activates MFA on the account
4. On subsequent logins, a valid TOTP code is required alongside email + password

No external service needed — TOTP runs entirely server-side.

---

## Integration status matrix

| Integration | Mock available | Production ready | Notes |
|---|---|---|---|
| MongoDB | ✅ (in-memory for tests) | ✅ | Atlas free tier is sufficient for production |
| Google Drive | ✅ | ✅ | Needs service account setup |
| Cloudinary | ✅ | ✅ | Alternative to Drive |
| WhatsApp (Meta) | ✅ | ✅ | Requires approved templates for new conversations |
| FCM push | ✅ | ⚠️ | Mobile app needs `google-services.json` |
| Groq AI | ✅ | ✅ | Free tier has generous rate limits |
| TOTP MFA | — | ✅ | No external dependency |
