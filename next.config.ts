import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  poweredByHeader: false,
  serverExternalPackages: ["@react-pdf/renderer"],
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
          { key: "Content-Security-Policy", value: "default-src 'self'; base-uri 'self'; form-action 'self' https://secure.payu.in https://test.payu.in https://*.phonepe.com https://api.phonepe.com https://api-preprod.phonepe.com; frame-ancestors 'none'; object-src 'none'; img-src 'self' data: https:; font-src 'self' data:; style-src 'self' 'unsafe-inline'; script-src 'self' 'unsafe-inline' https://checkout.razorpay.com https://sdk.cashfree.com https://verify.msg91.com https://verify.phone91.com https://www.google.com https://www.gstatic.com; connect-src 'self' https://api.razorpay.com https://*.razorpay.com https://api.cashfree.com https://sandbox.cashfree.com https://*.cashfree.com https://api.phonepe.com https://api-preprod.phonepe.com https://*.phonepe.com https://secure.payu.in https://test.payu.in https://*.msg91.com https://*.phone91.com https://www.google.com; frame-src https://api.razorpay.com https://*.razorpay.com https://sdk.cashfree.com https://*.cashfree.com https://*.phonepe.com https://secure.payu.in https://test.payu.in https://*.msg91.com https://*.phone91.com https://www.google.com https://recaptcha.google.com; upgrade-insecure-requests" },
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
