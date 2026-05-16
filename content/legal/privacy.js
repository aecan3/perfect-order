// Source of truth for the Privacy Policy rendered at /privacy and in the
// signup modal. Both import directly from this file.
// Bump PRIVACY_VERSION in lib/legalVersions.js when the content changes
// materially enough that existing users must re-agree.

export const PRIVACY_LAST_UPDATED = "16 May 2026";

export const PRIVACY_CONTENT = `
## 1. About this Privacy Policy

1.1 This Privacy Policy explains how A E Cann Pty Ltd (ABN 98 655 390 284) ("Master Setter", "we", "us", "our") collects, uses, stores, and discloses your personal information when you use the Master Setter application, website, and related services (the "Service").

1.2 We handle personal information in accordance with the Privacy Act 1988 (Cth) and the Australian Privacy Principles ("APPs"). Where the Privacy Act does not strictly apply to a small business, we commit to applying its principles voluntarily.

1.3 By using the Service, you agree to the collection and use of your information as described in this Privacy Policy. This Privacy Policy should be read together with our Terms of Service.

## 2. What personal information we collect

We collect the following categories of personal information:

2.1 Account information. When you create an account: your email address, your chosen handle (username), your display name, the country you select at signup, and a record of your agreement to the Terms of Service and this Privacy Policy (including timestamp and version).

2.2 Profile information. Any additional information you choose to add to your profile.

2.3 Collection data. Information about the cards you own, the cards you are seeking, your favourites, and related collection details. This is generally not "personal information" on its own, but it is linked to your account.

2.4 Approximate location. Your suburb and postcode, used to connect you with nearby users and improve trade match-making. You provide this yourself by selecting it; if you choose, you can also grant device location permission so the app can suggest your suburb once based on coarse device location. We do not store precise GPS coordinates and we do not track your location over time.

2.5 Mailing addresses. Master Setter does not store your mailing address on your profile by default. If you and another user agree to trade physical cards, you may choose to share your mailing address with that user directly through in-app messaging. In that case, the address exists in the relevant message thread, controlled by the users involved.

2.6 Photographs. You may upload photographs — for example, to document the condition of cards involved in a trade. Photos are stored in our cloud storage (see Section 5) and are visible to users involved in the relevant trade or context. Embedded metadata (such as EXIF data, including any GPS information) is stripped from photographs on upload so that location and device information embedded in image files is not retained or shared.

2.7 Messages. The content of messages you send to other users through the Service is stored so it can be delivered to the recipient and remain visible in the conversation. Messages are stored unencrypted at rest in our database, with access controlled by our database access rules.

2.8 Usage, performance, and error data. When you use the Service, we and our analytics providers (see Section 5) collect:

(a) Usage and performance metrics — for example, page views, performance timings, and general device/browser information — via Vercel Analytics. This data is privacy-friendly and does not use cookies for identification.

(b) Error and crash data — for example, JavaScript error messages and stack traces — via Sentry, to help us diagnose and fix problems.

We may add additional product analytics in the future (such as a privacy-friendly tool that helps us understand which features are useful). If we do, we will update this Privacy Policy and disclose it before activating it.

2.9 Information from third parties. We display card information (names, set data, estimated prices) sourced from the public Pokemon TCG data provider pokemontcg.io, and card images referenced from Limitless TCG. This is not your personal information, but is part of the Service.

## 3. How we collect personal information

3.1 Directly from you — when you create an account, set up your profile, enter collection data, select your suburb, share information through messages, upload a photo, or otherwise use the Service.

3.2 Automatically — when you use the Service, certain technical, performance, and error information is collected automatically by our analytics and error reporting providers.

3.3 With your permission — if you choose to use device location to help set your suburb, that one-time request happens only after you grant permission. The Service explains what location is used for before requesting it.

## 4. How we use personal information

We use personal information to:

4.1 create, operate, and maintain your account;

4.2 provide the core features of the Service — collection tracking, identifying cards you are seeking, and connecting you with other users;

4.3 enable trade match-making, including using your suburb and postcode to surface nearby users and relevant trade opportunities;

4.4 enable communication between users (messaging) and the trade process;

4.5 send you transactional communications, such as email confirmation, password reset, and security or account notices;

4.6 maintain the safety, security, and integrity of the Service — including detecting, preventing, and responding to fraud, abuse, and breaches of our Terms;

4.7 monitor and improve the performance, reliability, and usability of the Service through analytics and error reporting;

4.8 respond to your enquiries and provide support;

4.9 comply with our legal obligations.

We do not currently send marketing emails. If we ever do, we will give you a clear opt-in choice and a way to opt out, consistent with the Spam Act 2003 (Cth).

## 5. How and when we disclose personal information

5.1 To other users — as part of how the Service works.

(a) Your handle, display name, country, and profile information are visible to other users, in particular to users you are connected with or are arranging trades with.

(b) Your collection data (cards you own, duplicates you have, cards you are seeking) may be shown to other users to enable trade match-making — for example, a friend may see that you have a card they are looking for.

(c) Messages you send are visible to the user you send them to.

(d) Your mailing address is not stored on your profile. If you share it with another user through a message, that user can see it in the conversation. Once shared, see our Terms of Service regarding users' obligations to handle each other's information appropriately.

(e) Photographs you upload may be visible to a user involved in the relevant trade or context.

5.2 To service providers. We use the following third-party providers to operate the Service. They may process or store personal information on our behalf:

Supabase — database, user authentication, and file/photo storage. Our Supabase project is hosted in the Tokyo region (ap-northeast-1), Japan.

Vercel — application hosting and content delivery, and analytics for usage and performance metrics. Vercel operates a global edge network; requests and data may be processed at edge locations worldwide.

Resend — delivery of transactional emails (such as signup confirmation and password reset). Resend sending infrastructure for our domain is configured in the Tokyo region (ap-northeast-1), Japan.

Sentry — error and crash reporting, which collects diagnostic information when something goes wrong in the app. Sentry's processing locations depend on the configured plan and may include the United States or European Union.

We require our service providers to handle personal information consistently with this Privacy Policy and applicable law.

5.3 Third-party links. The Service contains links to third-party websites, including marketplaces (currently eBay), some of which are affiliate links. If you follow a link to a third-party site, that site's own privacy practices apply. We are not responsible for third-party sites.

5.4 Legal and safety disclosures. We may disclose personal information if we reasonably believe it is necessary to: comply with a law, regulation, legal process, or enforceable government request; enforce our Terms; or protect the rights, property, or safety of Master Setter, our users, or others.

5.5 Business transfers. If Master Setter is involved in a merger, acquisition, restructure, or sale of assets, personal information may be transferred as part of that transaction. We will take reasonable steps to ensure it remains protected.

5.6 We do not sell your personal information, and we do not disclose it to third parties for their own advertising or marketing purposes.

## 6. Cross-border disclosure

6.1 Some of our service providers store or process personal information outside Australia. Specifically:

Supabase — Japan (Tokyo region)

Resend — Japan (Tokyo region, for outbound email)

Vercel — global edge network, with processing in multiple regions; primary hosting infrastructure is located in the United States

Sentry — United States or European Union, depending on plan configuration

6.2 Where personal information is disclosed overseas, we take reasonable steps in accordance with Australian Privacy Principle 8 to ensure that the recipient handles it in a manner consistent with the APPs, including by selecting providers with appropriate security and privacy practices.

6.3 You acknowledge that overseas providers may be subject to the laws of their jurisdictions, including laws permitting government access to data.

## 7. Storage and security

7.1 We take reasonable steps to protect personal information from misuse, interference, loss, and unauthorised access, modification, or disclosure — including through the security measures provided by our infrastructure providers, database access rules, and authentication controls.

7.2 No method of transmission or storage is completely secure. While we take reasonable steps to protect your information, we cannot guarantee absolute security.

7.3 If we become aware of a data breach that is likely to result in serious harm, we will respond in accordance with the Notifiable Data Breaches scheme under the Privacy Act, including notifying affected individuals and the Office of the Australian Information Commissioner where required.

## 8. Data retention

8.1 We retain personal information for as long as it is needed to provide the Service and for the purposes described in this Privacy Policy, unless a longer retention period is required or permitted by law.

8.2 If you close your account, we will delete or de-identify your personal information within a reasonable period, except where we are required or permitted to retain certain records (for example, to comply with legal obligations, resolve disputes, or prevent fraud). Deletion is processed manually on request to the contact address below and within our infrastructure; backups containing your information may persist for a short additional period before being overwritten in the normal backup cycle.

8.3 Uploaded photographs related to trade documentation may be retained for a reasonable period after a trade is resolved, in case of disputes, and are subject to periodic cleanup.

8.4 Messages are retained for as long as the conversation exists in the Service and are accessible to the participants.

## 9. Your rights and choices

9.1 Access and correction. You may request access to the personal information we hold about you, and ask us to correct it if it is inaccurate, out of date, incomplete, or misleading. Much of your information can be viewed and edited directly in your account settings.

9.2 Deletion. You may close your account and request deletion of your personal information, subject to the exceptions in clause 8.2.

9.3 Location. You can grant or withdraw location permission at any time through your device settings and your account settings. You can also change or remove the suburb you have set.

9.4 Communications. Transactional emails (such as password resets, email confirmation, and security notices) are a necessary part of the Service and cannot be opted out of while you have an account.

9.5 How to make a request. To make any request under this Section, contact us using the details in Section 12. We may need to verify your identity before acting on a request. We will respond within a reasonable period and consistent with our obligations under the Privacy Act.

9.6 Complaints. If you have a concern about how we have handled your personal information, please contact us first so we can try to resolve it. If you are not satisfied, you may lodge a complaint with the Office of the Australian Information Commissioner (OAIC) at oaic.gov.au.

## 10. Children

10.1 The Service is intended for users aged 18 and over. We do not knowingly collect personal information from anyone under 18.

10.2 If we become aware that we have collected personal information from a person under 18, we will take reasonable steps to delete it and close any associated account.

10.3 If you believe a person under 18 has provided us with personal information, please contact us.

## 11. Cookies, local storage, and service worker

11.1 The Service uses cookies, browser local storage, and service worker storage on your device for purposes such as:

keeping you signed in;

remembering preferences (for example, whether you have already seen the location-permission explanation);

enabling the Service to function as an installable progressive web app (PWA), including offline-capable resources.

11.2 We do not use third-party tracking or advertising cookies. We do not engage in cross-site tracking or behavioural advertising.

11.3 Analytics and error reporting (Vercel Analytics, Sentry) may use minimal local storage or anonymous identifiers required to function. They do not use third-party advertising cookies.

11.4 You can control cookies through your browser settings, though disabling them may affect how the Service works.

## 12. Contact us

For privacy questions, requests, complaints, or to make an access/deletion request, contact:

A E Cann Pty Ltd (ABN 98 655 390 284)

hello@mastersettertcg.com

## 13. Changes to this Privacy Policy

13.1 We may update this Privacy Policy from time to time to reflect changes to the Service, our practices, or legal requirements.

13.2 If we make a material change, we will take reasonable steps to notify you — for example, by in-app notice or email — at least 30 days before the change takes effect.

13.3 The "last updated" date and version number at the top of this Privacy Policy indicate when it was last revised. Your continued use of the Service after a change takes effect indicates your acceptance of the updated Privacy Policy.

Note: This Privacy Policy has been prepared with care but has not been reviewed by a lawyer or privacy specialist at the time of publication. A E Cann Pty Ltd intends to obtain professional review as the Service grows. If you have feedback about wording that is unclear, inaccurate, or insufficient, please contact us.
`;
