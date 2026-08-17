import { Link, createFileRoute } from "@tanstack/react-router";

import { LegalShell } from "@/routes/security";

export const Route = createFileRoute("/privacy")({
  head: () => ({
    meta: [
      { title: "Wynse privacy policy — plain language" },
      {
        name: "description",
        content:
          "What Wynse collects, what it cannot read, how long data is kept, and how to export or delete your account.",
      },
      { property: "og:title", content: "Wynse privacy policy" },
      { property: "og:description", content: "Minimal data, no advertising, no conversation scanning." },
    ],
  }),
  component: PrivacyPage,
});

function PrivacyPage() {
  return (
    <LegalShell title="Privacy policy">
      <p className="lead">
        Short version: we keep as little as possible, we cannot read your conversations, and we never
        sell your data.
      </p>

      <h2>What we collect</h2>
      <ul>
        <li>
          <strong>Account:</strong> email address (or Google account identifier), password hash
          handled by our authentication provider, display name, Wynse ID, public encryption key,
          account creation time and age confirmation.
        </li>
        <li>
          <strong>Connections:</strong> which two accounts share a room, who asked, status, and the
          room's disappearing-message setting.
        </li>
        <li>
          <strong>Messages:</strong> ciphertext only, plus timestamps, delivery and read markers,
          message type and size, and optional expiry time.
        </li>
        <li>
          <strong>Media:</strong> encrypted blobs in private storage, reachable only by the two
          people in the room.
        </li>
        <li>
          <strong>Safety:</strong> your block list, and reports you choose to submit.
        </li>
        <li>
          <strong>Presence:</strong> a "last seen" timestamp we overwrite — we do not keep a history.
        </li>
      </ul>

      <h2>What we do not collect</h2>
      <p>
        No contact book, no advertising identifiers, no third-party analytics or trackers, no call
        recordings, and no readable message content.
      </p>

      <h2>How we use it</h2>
      <p>
        Only to deliver your messages and calls, keep your account secure, enforce rate limits
        against spam, and act on reports you send us. We do not profile you and we do not use your
        conversations for advertising or AI training.
      </p>

      <h2>Retention</h2>
      <ul>
        <li>Messages stay until you or the other person delete them, or until a disappearing timer removes them.</li>
        <li>Deleting your account deletes your profile, connections, messages and media.</li>
        <li>Reports you submit are kept only as long as needed to review and act on them.</li>
      </ul>

      <h2>Your controls</h2>
      <p>
        In Settings you can delete individual messages, delete a whole room, turn on disappearing
        messages, block people, change what notifications reveal, set a device PIN, sign out
        everywhere, export your data, and delete your account. Because of end-to-end encryption,
        exports are built on your own device from data you can already read.
      </p>

      <h2>Legal requests</h2>
      <p>
        We respond to valid legal requests with only what we hold: account identifiers and limited
        delivery metadata. We cannot hand over message content, media, or call audio and video, and
        we do not build backdoors or exceptional access for anyone. See our{" "}
        <Link to="/security" className="underline underline-offset-4">
          security model
        </Link>{" "}
        for detail.
      </p>

      <h2>Children</h2>
      <p>You must be at least 16 years old to create a Wynse account.</p>

      <h2>Contact</h2>
      <p>
        Privacy questions and security reports: <strong>privacy@wynse.app</strong> — replace
        this with your real contact address before launch.
      </p>
    </LegalShell>
  );
}
