# VP Loan Connect Admin Manual

## Access

Open `/admin/login` and sign in with an active administrator account. Sessions expire after eight hours and are revocable. Never share admin credentials or reuse the bootstrap password.

## Roles

| Role | Intended access |
|---|---|
| `SUPER_ADMIN` | Full operational administration |
| `ADMIN` | CRM, exports, payments, reports, refunds and settings |
| `ANALYST` | Read-only operational dashboards |
| `SUPPORT` | Lead review and permitted follow-up updates |

Sensitive APIs enforce their own role allowlists in addition to route protection.

## Dashboard

`/admin` shows operational counts for lead, assessment, payment and report states. Use it to identify new work, payment/report failures and follow-up queues.

## Leads

`/admin/leads` supports search by name, mobile or city and filtering by lead stage. Mobile numbers are redacted in list views.

Open a lead to review:

- Contact and location.
- Assessment answers and free readiness result.
- Service, marketing and lender-referral consent history.
- Orders, payments and report status.
- Referral attribution.
- Last-contacted time and internal notes.

Permitted CRM stages are New Lead, OTP Verified, Assessment Started/Completed, Free Result Viewed, Payment Pending, Paid, Report Processing/Delivered, Consultation Requested, Lender Referral Requested, Referred, Application Submitted, Approved, Rejected, Follow-up Later and Opted Out.

Use “mark contacted” only after a real contact attempt. Never place passwords, OTPs, full card details, Aadhaar data or unnecessary sensitive information in notes.

## CSV export

Only `SUPER_ADMIN` and `ADMIN` may export. The action is audited. Store exports in approved encrypted storage, share them only with authorized staff and delete local copies according to the retention policy.

## Payments and refunds

`/admin/payments` shows order/payment states. Before refunding:

1. Confirm the captured payment reference and refundable balance.
2. Confirm the reason is allowed by the refund policy.
3. Enter the exact amount and a detailed reason.
4. Explicitly confirm the action.
5. Verify the provider refund reference and audit record.

Duplicate payment and system-failure cases may be refundable. Delivered personalized reports are normally non-refundable except for technical error, duplicate payment or applicable law.

## Reports

`/admin/reports` shows queued, processing, ready, delivered and failed reports. Regeneration is restricted to paid reports and writes an audit event. Do not email or share a report outside the verified customer workflow.

## Referrals

`/admin/referrals` shows reward status and validation timing. Rewards apply only to completed, non-refunded qualifying purchases. Review suspicious duplicate identities, self-attribution attempts, repeated payment behavior and refund patterns before approval.

## Settings

Authorized admins can configure:

- Credit Health Action Plan referral reward.
- Validation period.
- Minimum payout threshold.
- Milestone bonuses at 5, 10 and 25 successful referrals.

Changes are audited. Use approved business values and avoid retroactive manual changes without a documented reason.

## Consent and opt-out

Marketing consent is optional. If a user sends STOP, the platform records withdrawal and promotional messaging must cease. Service messages tied to a requested assessment/payment/report remain separate. Never override an opt-out merely to improve conversion.

## Lender referrals

No lender should be displayed or receive data until verification, active legal agreement, logo permission and product approval are recorded. A separate explicit lender-referral request/consent is required.

## Daily operations

- Review failed OTP/payment/report events.
- Review new opt-outs and deletion requests.
- Deliver or regenerate paid reports.
- Process consultations and referral requests.
- Review refund and referral-reward exceptions.
- Monitor audit logs and unusual login/export activity.

## Incident response

If unauthorized access, secret exposure, suspicious exports or payment abuse is suspected:

1. Revoke affected sessions and credentials.
2. Disable the affected provider route/account where necessary.
3. Preserve audit evidence without exposing customer data.
4. Notify the designated owner/security and grievance contacts.
5. Follow legal breach-assessment and notification requirements.

