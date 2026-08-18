# Kindred Connect

Build a production-oriented web app called STRESS.

STRESS is a simple, beautiful, fast, privacy-first ONE-TO-ONE communication platform.

CORE RULE:

🔐 PRIVACY BETWEEN TWO PEOPLE IS THE #1 PRIORITY.

The product must focus exclusively on private communication between exactly two people.

CORE FEATURES:

• One-to-one text messaging

• One-to-one voice calls

• One-to-one HD video calls

• Secure photo/video/file sharing

• Voice messages

• Read receipts

• Typing indicator

• Online status

• Optional disappearing messages

• QR-code/STRESS-ID connection

• Block & report

• Privacy/security center

• Session/device management

• Data export

• Account deletion

DESIGN:

Create a premium, modern, minimal, extremely user-friendly interface.

It must be understandable by a complete beginner/non-technical person.

Mobile-first and fully responsive for:

• Android

• iPhone

• Tablets

• Desktop browsers

The main conversation screen should make only the essential actions obvious:

PERSON

↓

PRIVATE CONVERSATION

↓

MESSAGE

↓

📞 AUDIO CALL

🎥 VIDEO CALL

First-run onboarding should take a non-technical user from account creation to their first connection in under a minute, with friendly, clear empty states — never a confusing blank screen.

Do NOT copy WhatsApp, Telegram, Messenger, Signal or other messengers. STRESS should have its own distinctive visual identity.

Use a calm, elegant interface with excellent typography, spacing, accessibility (target WCAG 2.1 AA), touch targets, subtle animations and fast interactions.

PRIVACY ARCHITECTURE:

Treat privacy as an architectural requirement, not a visual feature.

Use established, publicly reviewed cryptographic protocols/libraries.

NEVER invent custom encryption.

Where technically appropriate, implement genuine end-to-end encryption for private communications.

Protect:

• Text

• Voice messages

• Photos

• Videos

• Files

• Audio calls

• Video calls

• Encryption keys

• Local conversation data

• Sessions

Minimize metadata and data collection.

NEVER:

• Sell user data

• Use private conversations for advertising

• Secretly analyze conversations

• Send private conversations to AI

• Record calls

• Store call recordings

• Give administrators hidden access to private conversations

• Expose private media through public URLs

• Store plaintext unnecessarily

Do not claim "100% impossible to hack" or "absolute privacy".

Clearly distinguish between what is actually encrypted and what is not.

A privacy/security page must explain the security model in simple language.

MESSAGING:

Implement real-time one-to-one messaging.

Include:

• Sending

• Delivery state

• Read state

• Typing indicator

• Reply

• Delete

• Optional edit

• Emoji

• Voice messages

• Secure media sharing

• Disappearing messages

Do not use fake buttons or simulated backend behavior for core functionality.

AUDIO CALLS:

Implement REAL one-to-one audio calling using WebRTC.

Requirements:

• Fast connection

• Low latency

• Crystal-clear audio

• Opus where appropriate

• Echo cancellation

• Noise suppression

• Automatic gain control

• Adaptive bitrate

• Network adaptation

• Reconnection

• Mute/unmute

• Speaker/output

• End call

Never record calls.

VIDEO CALLS:

Implement REAL one-to-one video calling using WebRTC.

Target 720p/1080p-class video when device/network conditions permit.

Include:

• HD video

• Adaptive bitrate

• Adaptive resolution

• Network adaptation

• Camera switching

• Camera on/off

• Microphone on/off

• Full-screen

• Picture-in-picture where supported

• Connection quality

• Reconnection

Quality strategy:

Excellent network → highest stable quality

Good network → HD

Weak network → lower resolution but stable

Very weak network → prioritize audio

Never sacrifice privacy for video quality.

GLOBAL CONNECTIVITY:

Design for users worldwide.

Support:

• Wi-Fi

• 4G

• 5G

• Slow networks

• Network switching

• Temporary disconnections

Use WebRTC STUN/TURN infrastructure appropriately.

Prefer peer-to-peer media when practical, with secure TURN relay fallback.

Do not make users configure networking manually.

LOCALIZATION:

Build UI text through an i18n-ready structure — no hardcoded strings in components.

Ship with one launch language (e.g., English), but architect so additional languages can be added without refactoring.

Support locale-aware date, time and number formatting, and keep layouts flexible enough to accommodate RTL languages later.

CONNECTION:

Users connect through either:

1. STRESS ID

2. QR code

Flow:

Create account

→ Create STRESS ID

→ Share ID/QR

→ Connection request

→ Accept

→ Verify

→ Private conversation

Do not require uploading the user's entire contact book.

SAFETY & MODERATION:

Even in a one-to-one product, users need protection from abuse.

Include:

• Instant block (stops messages, calls and future connection requests from that person)

• Manage / unblock a blocked list

• Report a user or conversation — the reporting user chooses what to submit for review; never automatic server-side scanning of encrypted content

• Rate-limit connection requests to deter harassment and spam STRESS IDs

• Minimum age requirement stated at signup

Reporting must follow the same privacy principles as the rest of the product: the platform never gains standing access to private conversations just because a report exists.

SECURITY:

Protect against:

• XSS

• CSRF

• Injection

• Broken access control

• Session hijacking

• Authentication attacks

• ID enumeration

• Malicious uploads

• Rate-limit abuse

• WebRTC signaling abuse

• Dependency vulnerabilities

Use:

• HTTPS

• Secure authentication

• Secure cookies where appropriate

• CSP

• HSTS

• Input validation

• Authorization

• Rate limiting

• Secure secret management

Never expose secrets/API keys in frontend code.

NOTIFICATIONS:

Privacy-first default.

Use:

"STRESS — You have a new message"

Do not reveal message contents by default.

Allow:

• Generic notification

• Sender only

• Full preview

• No preview

DEVICE PRIVACY:

Where supported:

• App lock

• PIN/password

• Biometrics

• Hide notification content

• Secure local storage

• Session/device management

DATA CONTROL:

Allow users to:

• Delete messages

• Delete conversations

• Enable disappearing messages

• Revoke devices/sessions

• Export their own account data and locally stored conversation history

• Delete account

Minimize retention. Because of E2EE, exports are generated client-side from the user's own device, not from server-side plaintext.

LEGAL & COMPLIANCE:

Provide plain-language Terms of Service and Privacy Policy pages alongside the security page.

State a minimum age requirement for account creation.

In the privacy/security page, define what limited data (if any) could be produced for a valid legal request — consistent with the E2EE architecture, this excludes message content the platform cannot access.

Do not build hidden backdoors or exceptional access for law enforcement or anyone else. Any legal process is handled the way any company handles one, and disclosed transparently in the policy.

AI:

AI is NOT part of the core communication system.

Never automatically send private conversations to an external AI service.

If AI is added later, require explicit opt-in and clearly explain how data is processed.

TECH STACK:

Use:

• React

• TypeScript

• Vite

• Modern responsive CSS or Tailwind

• PWA support

• Node.js/TypeScript backend where required

• PostgreSQL for necessary account/connection data

• WebSockets/WebRTC for realtime communication

• WebRTC + Opus for calls

• Mature cryptographic libraries/protocols for E2EE

• i18n library (e.g., i18next) for localization-ready UI text

You may choose better production technologies if they materially improve security, reliability, performance or simplicity.

ARCHITECTURE:

Separate:

• UI

• Authentication

• Messaging

• Signaling

• WebRTC

• Encryption/key management

• Database

• Media storage

• Notifications

• Moderation/reporting

Do not put private encryption secrets in frontend source code.

Do not create homemade cryptographic algorithms.

MVP:

Build the actual application, not just a static mockup.

Phase 1:

• Beautiful STRESS UI

• Authentication

• STRESS ID

• Two-person connection

• QR connection

• Real-time text messaging

• Block & report

• Privacy settings

• Terms of Service & Privacy Policy pages

Phase 2:

• Real WebRTC audio calling

• Real HD video calling

• Adaptive quality

• Reconnection

• Secure signaling

Phase 3:

• Mature E2EE implementation

• Secure media

• Device/session management

• Disappearing messages

• Data export

• Privacy hardening

• Security testing

IMPORTANT DEVELOPMENT RULES:

Do not pretend simulated functionality is real.

If backend credentials or external infrastructure are required, create clear environment-variable placeholders and explain exactly what must be configured.

Never hard-code secrets.

Never invent cryptography.

Never claim security features are production-ready without implementing them.

Prioritize security, privacy, performance and simplicity over adding more features.

Make the UI beautiful enough to feel like a finished premium product while keeping the experience extremely simple.

FINAL PRODUCT PHILOSOPHY:

STRESS should feel like:

"A private room for two people, anywhere in the world."

🌟 PRIVATE

🌍 GLOBAL

⚡ FAST

🎥 HD VIDEO

🔊 CRYSTAL-CLEAR AUDIO

💬 SIMPLE

TWO PEOPLE.

ONE PRIVATE CONNECTION.

ZERO UNNECESSARY COMPLEXITY.

Start by creating the complete working STRESS application structure and UI. Then implement the backend architecture and real communication features without replacing the core design.

This project was built with [Lovable](https://lovable.dev).

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/e78c0936-a160-47c8-af97-8c3fb2277191).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
