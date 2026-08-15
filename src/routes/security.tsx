import { Link, createFileRoute } from "@tanstack/react-router";

import { Wordmark } from "@/components/brand";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/security")({
  head: () => ({
    meta: [
      { title: "How STRESS protects you — security model" },
      {
        name: "description",
        content:
          "Plain-language explanation of STRESS encryption: what is end-to-end encrypted, what metadata exists, and what we cannot claim.",
      },
      { property: "og:title", content: "STRESS security model, in plain language" },
      {
        property: "og:description",
        content: "What is encrypted, what isn't, and what we can never see.",
      },
    ],
  }),
  component: SecurityPage,
});

function SecurityPage() {
  return (
    <LegalShell title="How STRESS protects you">
      <p className="lead">
        This page explains our security model in everyday language. We would rather be honest than
        impressive.
      </p>

      <h2>What is end-to-end encrypted</h2>
      <ul>
        <li>
          <strong>Text messages.</strong> Encrypted on your device before they are sent, using
          libsodium (a widely reviewed implementation of NaCl): a random key per message with
          XSalsa20-Poly1305, delivered to each of you inside a sealed box locked to your X25519
          public keys.
        </li>
        <li>
          <strong>Photos, videos, files and voice messages.</strong> Encrypted on your device with
          the same per-message key. Only ciphertext is uploaded, into private storage that is not
          reachable by public URL.
        </li>
        <li>
          <strong>Audio and video calls.</strong> Encrypted in transit by WebRTC using DTLS-SRTP.
          When your networks allow it, media flows directly between the two devices; otherwise it is
          relayed, still encrypted, by a TURN server. Calls are never recorded and no call media is
          stored.
        </li>
      </ul>

      <h2>What is <em>not</em> end-to-end encrypted</h2>
      <ul>
        <li>
          <strong>Your account details.</strong> Your email address, STRESS ID, display name and
          public key are stored on the server so people can reach you.
        </li>
        <li>
          <strong>Minimal delivery metadata.</strong> Which two accounts share a room, message
          timestamps, delivery/read markers, message size and type. We keep this because a delivery
          system needs it — we do not use it for advertising or profiling.
        </li>
        <li>
          <strong>Anything you choose to include in a report.</strong> If you report someone and opt
          to attach recent messages, that excerpt is decrypted by <em>your</em> device and sent to us
          for review. Nothing is submitted unless you include it.
        </li>
      </ul>

      <h2>Your keys</h2>
      <p>
        Your private key is generated in your browser and stored only on that device. We never
        receive it. That has a real consequence: if you clear this device's storage or sign in on a
        new device without it, older messages can no longer be decrypted. We show a clear notice
        rather than pretend otherwise.
      </p>
      <p>
        Each room shows a <strong>safety code</strong> derived from both public keys. Compare it in
        person or on a call. Matching codes mean nobody swapped keys in the middle.
      </p>

      <h2>What we never do</h2>
      <ul>
        <li>We do not sell data or use private conversations for advertising.</li>
        <li>We do not scan, analyse or train on your conversations, and we never send them to an AI service.</li>
        <li>We do not record calls or store call media.</li>
        <li>We do not build hidden administrator access or backdoors to your conversations.</li>
        <li>We do not upload your contact book — you connect by STRESS ID or QR code.</li>
      </ul>

      <h2>What we will not claim</h2>
      <p>
        We will not tell you STRESS is impossible to hack or that it offers absolute privacy. No
        software can promise that. A compromised device, a screenshot taken by the other person, or a
        weak account password can all expose a conversation regardless of encryption.
      </p>

      <h2>Legal requests</h2>
      <p>
        If we receive a valid legal request, we can only produce what we actually hold: account
        identifiers such as email address and STRESS ID, account creation time, and the limited
        delivery metadata described above. We cannot produce message content, media, or call audio
        and video, because we cannot read them. We do not build exceptional access for anyone,
        including law enforcement.
      </p>

      <h2>Reporting a security problem</h2>
      <p>
        If you believe you have found a vulnerability, contact the address in our privacy policy
        before disclosing it publicly. We welcome the report.
      </p>
    </LegalShell>
  );
}

export function LegalShell({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="min-h-screen room-glow">
      <header className="mx-auto flex max-w-3xl items-center justify-between px-5 py-5 safe-t">
        <Link to="/" aria-label="STRESS home">
          <Wordmark />
        </Link>
        <Button asChild variant="ghost" size="sm">
          <Link to="/">Back</Link>
        </Button>
      </header>
      <main className="mx-auto max-w-3xl px-5 pb-20">
        <h1 className="text-3xl sm:text-4xl">{title}</h1>
        <div className="mt-6 space-y-4 text-sm leading-relaxed text-muted-foreground [&_h2]:mt-10 [&_h2]:text-lg [&_h2]:text-foreground [&_li]:mt-2 [&_p.lead]:text-base [&_p.lead]:text-foreground [&_strong]:text-foreground [&_ul]:list-disc [&_ul]:pl-5">
          {children}
        </div>
      </main>
    </div>
  );
}
