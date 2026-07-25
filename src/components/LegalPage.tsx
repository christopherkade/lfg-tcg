"use client";

import { Box, Typography } from "@mui/material";
import type { LegalSection } from "@/lib/legal/content";

interface LegalPageProps {
  title: string;
  sections: LegalSection[];
}

/** Shared renderer for the /terms and /privacy pages — plain long-form
 * content, styled with theme tokens (not Tailwind's default palette,
 * which this app doesn't define) so it matches light/dark mode. */
export function LegalPage({ title, sections }: LegalPageProps) {
  return (
    <Box
      sx={{ bgcolor: "background.default" }}
      className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-6 px-6 py-12"
    >
      <Typography
        component="h1"
        sx={{ fontSize: "1.5rem", fontWeight: 700, color: "text.primary" }}
      >
        {title}
      </Typography>
      <div className="flex flex-col gap-6">
        {sections.map((section) => (
          <section key={section.heading} className="flex flex-col gap-2">
            <Typography
              component="h2"
              sx={{ fontSize: "1rem", fontWeight: 600, color: "text.primary" }}
            >
              {section.heading}
            </Typography>
            <Typography
              sx={{ fontSize: "0.875rem", lineHeight: 1.6, color: "text.secondary" }}
            >
              {section.body}
            </Typography>
          </section>
        ))}
      </div>
    </Box>
  );
}
