import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "VP Loan Connect",
    short_name: "VP Loan",
    description: "Smart Profile Check Before Your Loan Application",
    start_url: "/",
    display: "standalone",
    background_color: "#ffffff",
    theme_color: "#061521",
    icons: [{ src: "/icon.svg", sizes: "any", type: "image/svg+xml" }],
  };
}
