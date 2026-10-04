import { contactEmail } from './Footer'

const UPDATED = '4 October 2026'

function Contact() {
  const email = contactEmail(import.meta.env.VITE_CONTACT_EMAIL)
  return email ? <a href={`mailto:${email}`}>{email}</a> : <>the contact address shown in the site footer</>
}

export function PrivacyPage() {
  return (
    <main className="page legal">
      <h1>Privacy policy</h1>
      <p>Last updated {UPDATED}.</p>
      <p>Yarns is a place to build and share research boards. This page explains what we collect and why.</p>

      <h2>What we collect</h2>
      <ul>
        <li><strong>Account details.</strong> Your email address and a password (stored only as a hash). If you sign in with Google, we receive your email address and basic profile from that provider. We never see your provider password.</li>
        <li><strong>Your boards.</strong> The content you create: notes, links, sources, images you add, layout, titles, and the visibility you choose (private, unlisted or public).</li>
        <li><strong>Sharing.</strong> If you share a board with someone by email, we store that email address against the board.</li>
        <li><strong>Technical data.</strong> Our hosting provider processes standard request data such as IP address and browser type to serve the site and keep it secure.</li>
      </ul>
      <p>We do not run advertising or analytics trackers, and we do not sell your data.</p>

      <h2>How we use it</h2>
      <p>To run your account, store and show your boards, send account emails (confirmation and password reset), and keep the service secure. Public and unlisted boards are visible to anyone who has the link, and public boards can be listed by topic. Private boards are visible only to you and anyone you share them with.</p>

      <h2>Who processes it</h2>
      <ul>
        <li>Supabase: database, sign-in and file storage.</li>
        <li>Vercel: website hosting.</li>
        <li>Resend: sending account emails.</li>
        <li>Google, only if you choose to sign in with them.</li>
      </ul>

      <h2>Keeping and deleting data</h2>
      <p>You can delete a board from your boards list, and you can delete your account from the Account page. Deleting your account removes your login and all your boards. Deleted boards and backups may persist for a short time before they are purged.</p>

      <h2>Your choices</h2>
      <p>You can access, correct or delete your data through the app, or contact us using the details below and we will help.</p>

      <h2>Contact</h2>
      <p>Questions, privacy requests or copyright takedown notices: <Contact />.</p>
      <p>We may update this policy and will change the date above when we do.</p>
    </main>
  )
}

export function TermsPage() {
  return (
    <main className="page legal">
      <h1>Terms of service</h1>
      <p>Last updated {UPDATED}.</p>
      <p>By creating an account or using Yarns you agree to these terms.</p>

      <h2>Your account</h2>
      <p>Keep your login secure. You are responsible for activity under your account. You must be old enough to enter a binding agreement where you live.</p>

      <h2>Your content</h2>
      <p>You own what you create. You give us permission to store, display and transmit it as needed to run the service, including showing public and unlisted boards to anyone with the link. You are responsible for your boards, including the accuracy of claims and sources you present.</p>

      <h2>Acceptable use</h2>
      <p>Do not use Yarns to harass or defame people, to publish private personal information about others, to post unlawful content, or to infringe copyright. Only add images you have the right to use. Do not attack, scrape abusively or overload the service. A board that presents allegations should be clearly sourced and labelled as such.</p>

      <h2>Removal and suspension</h2>
      <p>We may remove content or suspend accounts that break these terms or that we are legally required to take down. To report a board, or to send a copyright takedown request, contact <Contact />.</p>

      <h2>No warranty</h2>
      <p>Yarns is provided as is and as available, without warranties of any kind. We do not guarantee that it will be uninterrupted or error free, or that content on public boards is accurate. Keep your own copies of anything important.</p>

      <h2>Liability</h2>
      <p>To the extent the law allows, we are not liable for indirect or consequential losses arising from your use of the service.</p>

      <h2>Changes</h2>
      <p>We may update these terms and will change the date above when we do. Continuing to use Yarns after a change means you accept the new terms.</p>
    </main>
  )
}
