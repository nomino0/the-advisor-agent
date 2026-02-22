# Security Incident & Remediation Report: Client-Side State Trust

**Date:** 2026-02-22  
**Component:** Frontend Authentication & Authorization (Next.js)  
**Vulnerability Type:** Insecure Direct Object Reference (Client State) / Client-Side Trust Violation  
**Severity:** High (UI/UX Bypass)  
**Status:** Patched

---

## 1. Description of the Vulnerability

During a security review, it was discovered that the frontend application implicitly trusted unverified client-side storage mechanisms (`sessionStorage`, `localStorage`, and un-signed cookies) to determine user authorization levels and 2FA status. 

An attacker (or malicious insider) could use browser Developer Tools to manually edit the stored JSON user object:
- **Role Elevation:** Changing `"role": "user"` to `"role": "admin"`.
- **2FA Bypass:** Changing `"totp_enabled": false` to `"totp_enabled": true`.

While the backend API remained secure (rejecting unauthorized data requests with `403 Forbidden` due to strict JWT validation), the frontend router and UI components relied entirely on the spoofed local state. This allowed the attacker to:
1. Bypass the mandatory `/2fa-setup` onboarding flow.
2. Circumvent edge middleware routing guards.
3. Access and view restricted administrative screens (e.g., `/admin`).

---

## 2. Impact Analysis

- **Data Exposure:** **None.** The backend correctly validated the cryptographic signature of the JWT before returning sensitive data. The API returned `401/403` errors when the spoofed client attempted to fetch admin data.
- **UI/UX Integrity:** **Compromised.** Unauthorized users could navigate to administrative interfaces, creating a perceived breach of security and exposing the platform's internal administrative capabilities and layouts.
- **Security Check Bypass:** **Compromised.** Users could actively bypass mandatory security checkpoints (like setting up Two-Factor Authentication) by convincing the client application that they had already completed the process.

---

## 3. Remediation & Defense in Depth

The vulnerability was addressed by shifting the "Source of Truth" away from the easily manipulated DOM/Browser storage and anchoring it directly to the cryptographically verifiable JWT and the backend database. Three layers of security were applied:

### Layer 1: Cryptographic Perimeter Hardening (`frontend/src/middleware.ts`)
The Next.js edge middleware was rewritten to completely ignore the plaintext `user` cookie.
- **Fix:** It now extracts the `access_token` JWT, decodes the Base64Url payload, and parses the `role` directly from the signed token. 
- **Result:** If an attacker modifies the token payload in their browser, the JWT signature is invalidated. The middleware now only routes based on claims that were cryptographically signed by the backend at the time of login.

### Layer 2: Server-Side State Synchronization (`frontend/src/hooks/useAuth.ts`)
The React authentication hook previously trusted `sessionStorage` indefinitely.
- **Fix:** The hook was updated to perform an immediate background fetch to `/api/v1/auth/me` on every page hydration if a token is present.
- **Result:** It fetches the true, unforgeable user profile from the backend database and overwrites any spoofed values in `sessionStorage`. Features like `totp_enabled` and `role` are now enforced using the verified backend response, ensuring users cannot bypass 2FA checks by modifying local variables.

### Layer 3: Graceful Security Ejection (`frontend/src/lib/api.ts`)
The global API fetch wrapper failed to handle backend authorization rejections gracefully, allowing the user to remain on unauthorized pages.
- **Fix:** A global interceptor was added for `403 Forbidden` HTTP responses.
- **Result:** If an attacker manages to bypass the router and lands on an `/admin` page, any subsequent API request returning a `403` will instantly trigger an "Access Denied" notification and aggressively force-redirect the user back to the safe `/dashboard`.

---

## 4. Key Takeaways

1. **Never Trust the Client:** Any data residing in the browser (Cookies, LocalStorage, SessionStorage, IndexedDB) must be considered tainted and inherently modifiable by the user.
2. **UI Guards are not Security:** Hiding a button or a route on the frontend does not secure the application. True security must happen at the API layer (which was correctly implemented) *and* the token layer (which was fixed).
3. **Synchronize State:** For critical feature flags like `totp_enabled`, always double-check the client's assumed state against the backend's source of truth on component mount.
