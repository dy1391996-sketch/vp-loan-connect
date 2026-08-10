import type { NextConfig } from "next";

/**
 * Origins the browser is allowed to submit a checkout form to.
 * Cashfree hosted checkout is reached by a top-level form POST carrying
 * `payment_session_id`; without these entries the browser blocks the submission
 * ("Sending form data to … violates … form-action") and the payment page never opens.
 */
const CHECKOUT_FORM_ACTION_ORIGINS = [
  "'self'",
  "https://api.cashfree.com",
  "https://sandbox.cashfree.com",
  "https://payments.cashfree.com",
  "https://payments-test.cashfree.com",
  "https://api.razorpay.com",
  "https://secure.payu.in",
  "https://test.payu.in",
  "https://*.phonepe.com",
  "https://api.phonepe.com",
  "https://api-preprod.phonepe.com",
].join(" ");

const CONTENT_SECURITY_POLICY = [
  "default-src 'self'",
  "base-uri 'self'",
  `form-action ${CHECKOUT_FORM_ACTION_ORIGINS}`,
  "frame-ancestors 'none'",
  "object-src 'none'",
  "img-src 'self' data: https:",
  "font-src 'self' data:",
  "style-src 'self' 'unsafe-inline'",
  "script-src 'self' 'unsafe-inline' https://checkout.razorpay.com https://cdn.razorpay.com https://sdk.cashfree.com https://verify.msg91.com https://verify.phone91.com https://www.googletagmanager.com https://www.google.com https://www.gstatic.com",
  "connect-src 'self' https://api.razorpay.com https://*.razorpay.com https://api.cashfree.com https://sandbox.cashfree.com https://*.cashfree.com https://api.phonepe.com https://api-preprod.phonepe.com https://*.phonepe.com https://secure.payu.in https://test.payu.in https://*.msg91.com https://*.phone91.com https://www.googletagmanager.com https://*.google-analytics.com https://*.analytics.google.com https://www.google.com",
  "frame-src https://api.razorpay.com https://*.razorpay.com https://sdk.cashfree.com https://*.cashfree.com https://*.phonepe.com https://secure.payu.in https://test.payu.in https://*.msg91.com https://*.phone91.com https://www.google.com https://recaptcha.google.com",
  "upgrade-insecure-requests",
].join("; ");

const nextConfig: NextConfig = {
  poweredByHeader: false,
  serverExternalPackages: ["@react-pdf/renderer"],
  async redirects() {
    return [
      {
        source: "/:path*",
        has: [{ type: "host", value: "vploanconnect.in" }],
        destination: "https://www.vploanconnect.in/:path*",
        permanent: true,
      },
    ];
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
          // Allow Razorpay Standard Checkout popups/modals to work.
          { key: "Cross-Origin-Opener-Policy", value: "same-origin-allow-popups" },
          { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
          { key: "Content-Security-Policy", value: CONTENT_SECURITY_POLICY },
        ],
      },
      {
        source: "/og.jpg",
        headers: [{ key: "Cache-Control", value: "public, max-age=31536000, immutable" }],
      },
    ];
  },
};

export default nextConfig;
