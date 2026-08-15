import { createFileRoute } from "@tanstack/react-router";

import { LegalShell } from "@/routes/security";

export const Route = createFileRoute("/terms")({
  head: () => ({
    meta: [
      { title: "STRESS terms of service" },
      {
        name: "description",
        content: "The simple rules for using STRESS: minimum age 16, no abuse, and what we promise.",
      },
      { property: "og:title", content: "STRESS terms of service" },
      { property: "og:description", content: "Plain-language terms for a one-to-one private messenger." },
    ],
  }),
  component: TermsPage,
});

function TermsPage() {
  return (
    <LegalShell title="Terms of service">
      <p className="lead">
        These terms are written to be read. If something here is unclear, assume the reading that is
        fairest to you and ask us.
      </p>

      <h2>1. Minimum age</h2>
      <p>You must be at least 16 years old to create or use a STRESS account.</p>

      <h2>2. Your account</h2>
      <p>
        Keep your password private and your device secure. Your encryption key lives on your device,
        so losing that device means losing access to older messages. We cannot recover them for you.
      </p>

      <h2>3. What STRESS is for</h2>
      <p>
        Private conversation between exactly two people. Each room holds two participants — there are
        no groups, channels or broadcast tools.
      </p>

      <h2>4. Acceptable use</h2>
      <ul>
        <li>Do not harass, threaten, stalk or abuse anyone.</li>
        <li>Do not send illegal content, including sexual content involving minors.</li>
        <li>Do not impersonate other people or organisations.</li>
        <li>Do not spam STRESS IDs or automate connection requests; requests are rate-limited.</li>
        <li>Do not attempt to break, overload or probe the service without permission.</li>
      </ul>

      <h2>5. Blocking and reports</h2>
      <p>
        You can block anyone instantly, which stops their messages, calls and future connection
        requests. You can report someone and choose whether to include recent messages for review. We
        cannot see your conversation otherwise, and a report does not grant us standing access to it.
        We may suspend accounts that break these terms.
      </p>

      <h2>6. Availability</h2>
      <p>
        We work hard on reliability but we do not promise uninterrupted service, and we do not claim
        STRESS is impossible to hack. Calls depend on your network and your device.
      </p>

      <h2>7. Ending your account</h2>
      <p>
        You can delete your account at any time from Settings; this deletes your profile,
        connections, messages and media. We may terminate accounts that repeatedly violate these
        terms.
      </p>

      <h2>8. Changes</h2>
      <p>
        If we change these terms in a way that matters, we will tell you in the app before the change
        takes effect.
      </p>

      <h2>9. Contact</h2>
      <p>
        <strong>legal@stress.example</strong> — replace this with your real contact address before
        launch.
      </p>
    </LegalShell>
  );
}
