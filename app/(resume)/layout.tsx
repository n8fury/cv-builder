/**
 * Root layout for the resume document (SPEC §7, §8).
 *
 * Deliberately its own root layout rather than a child of the dashboard's:
 * the editor chrome's Tailwind stylesheet — preflight included — must never
 * reach this document. Everything the resume renders with comes from
 * components/resume/*.css, which the Puppeteer export path loads verbatim.
 */
import "@/components/resume/fonts.css";
import "@/components/resume/resume.css";

export default function ResumeLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
