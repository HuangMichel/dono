# Dono frontend

Next.js renders donor, association and platform screens. Supabase email/password authentication supplies the user session. Every business read and command goes to the FastAPI API. No fictional records, role selector, sample analysis or browser-local donation database remains.

## Run

Use the pinned pnpm version in `package.json` and Node.js 24 LTS, matching the Vercel runtime. Both the SDK and environment loader are recorded in `pnpm-lock.yaml`.

```sh
pnpm install --frozen-lockfile
pnpm dev
```

Open `http://127.0.0.1:3000`. Configure `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` and `NEXT_PUBLIC_API_BASE_URL` before starting. The API URL can be an origin or include `/api/v1`. Next.js loads the repository root environment as well as its normal frontend environment. Existing exported settings take precedence. Never prefix backend secrets with `NEXT_PUBLIC_`.

Allow the exact frontend origin in FastAPI `APP_ORIGIN`. Enable Supabase Email signup, set its minimum password length to eight, and disable Google. `/signup` accepts email and password; `/login` signs in an existing account. Local confirmation is disabled. If the hosted project requires confirmation, allow the callback and its continuation query pattern described in setup, configure confirmation email delivery, and open the link in the signup browser. See [setup](../docs/setup.md#frontend). Roles come from the profile and association memberships returned by FastAPI. A donor cannot choose staff or platform access.

## Workflows

- Browse `/needs` without an account, optionally search by town or postcode, filter by category and inspect a need. **Offer an item** starts signup or sign-in and preserves the selected need for donation preparation.
- Take item or label photos with the camera, review and retake them, or choose existing files. Use up to three JPEG, PNG or WebP photos, at most 4 MiB each. Analyse them or enter facts manually, confirm the item, find eligible associations, and send an offer.
- Follow separate donation, offer and appointment states. Book only after human approval. QR retrieval uses the backend-signed payload and does not create another appointment.
- Staff review frozen facts and original evidence, then approve or refuse with the required checks. Staff resolve signed QR payloads and receive or distribute a full lot.
- Association admins configure needs, storage, daily intake quotas, hours and slots. Platform admins verify association registrations.

Unmatched offer publication and company attribution have no supported backend contract. Their routes explain that limit instead of simulating records or successful actions. No remote records were deleted. The old `dono-demo-v1` browser key is no longer read or imported into the backend.

Live camera capture requires HTTPS or localhost and browser camera permission. It requests no microphone access. Confirming a capture adds a local JPEG; the existing donation actions perform the upload. The camera stops during photo review and on dismissal. File selection remains available when camera access fails. See [MDN's camera access requirements](https://developer.mozilla.org/en-US/docs/Web/API/MediaDevices/getUserMedia#privacy_and_security).

## Checks and deployment

Run `pnpm lint`, `pnpm typecheck`, `pnpm test`, and `pnpm build`. Donation protocol tests exercise `DonationSession` directly. Lifecycle tests mount actual React components in jsdom; HTTP and authentication services remain mocked. They do not prove hosted signup, email delivery or sign-in. See [readiness](../docs/readiness.md) for current results.

The donation route renders the form; `components/donor/donation-session.ts` owns uploads, revision checks and command recovery. `lib/category-fields.ts` and `lib/labels.ts` hold shared field definitions and wording. Authentication keeps SDK identity separate from application access: backend account-loading failures retain sign-out but block business operations. Collection hooks cancel obsolete reads. Photos load near the viewport, offer history loads on expansion, and gallery text filters apply on submission.

On Vercel, set the project Root Directory to `frontend` and `ENABLE_EXPERIMENTAL_COREPACK=1` to use the pinned pnpm version. Deploy FastAPI as a second Vercel project with Root Directory `backend`, and use its HTTPS URL in `NEXT_PUBLIC_API_BASE_URL`. Photo requests go directly to FastAPI. See [setup](../docs/setup.md#vercel) for configuration and limits.
