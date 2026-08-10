/**
 * Content-Security-Policy for every page.
 *
 * form-action MUST include the Cashfree API hosts: the Cashfree v3 JS SDK
 * navigates to its hosted checkout by submitting an HTML form to
 * https://api.cashfree.com/pg/view/sessions/checkout (sandbox equivalent on
 * sandbox.cashfree.com). If form-action omits these hosts the browser silently
 * blocks the submission and checkout never opens (infinite spinner).
 */

const FORM_ACTION = [
  "'self'",
  // Cashfree hosted checkout (v3 SDK submits a form to navigate).
  "https://api.cashfree.com",
  "https://sandbox.cashfree.com",
  "https://*.cashfree.com",
  // PayU hosted form post.
  "https://secure.payu.in",
  "https://test.payu.in",
  // PhonePe redirect flows.
  "https://*.phonepe.com",
  "https://api.phonepe.com",
  "https://api-preprod.phonepe.com",
];

const SCRIPT_SRC = [
  "'self'",
  "'unsafe-inline'",
  "https://checkout.razorpay.com",
  "https://sdk.cashfree.com",
  "https://verify.msg91.com",
  "https://verify.phone91.com",
  "https://www.google.com",
  "https://www.gstatic.com",
];

const CONNECT_SRC = [
  "'self'",
  "https://api.razorpay.com",
  "https://*.razorpay.com",
  "https://api.cashfree.com",
  "https://sandbox.cashfree.com",
  "https://*.cashfree.com",
  "https://api.phonepe.com",
  "https://api-preprod.phonepe.com",
  "https://*.phonepe.com",
  "https://secure.payu.in",
  "https://test.payu.in",
  "https://*.msg91.com",
  "https://*.phone91.com",
  "https://www.google.com",
];

const FRAME_SRC = [
  "https://api.razorpay.com",
  "https://*.razorpay.com",
  "https://sdk.cashfree.com",
  "https://*.cashfree.com",
  "https://*.phonepe.com",
  "https://secure.payu.in",
  "https://test.payu.in",
  "https://*.msg91.com",
  "https://*.phone91.com",
  "https://www.google.com",
  "https://recaptcha.google.com",
];

export const CONTENT_SECURITY_POLICY = [
  "default-src 'self'",
  "base-uri 'self'",
  `form-action ${FORM_ACTION.join(" ")}`,
  "frame-ancestors 'none'",
  "object-src 'none'",
  "img-src 'self' data: https:",
  "font-src 'self' data:",
  "style-src 'self' 'unsafe-inline'",
  `script-src ${SCRIPT_SRC.join(" ")}`,
  `connect-src ${CONNECT_SRC.join(" ")}`,
  `frame-src ${FRAME_SRC.join(" ")}`,
  "upgrade-insecure-requests",
].join("; ");
