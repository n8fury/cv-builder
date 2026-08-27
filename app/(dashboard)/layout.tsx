import type { Metadata } from "next";

import "../globals.css";
import { ToastProvider } from "./Toaster";

export const metadata: Metadata = {
  title: "Vitae",
  description: "Tailored, pixel-perfect CVs from one content library",
};

export default function DashboardLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en">
      <body>
        {/* §13: failures surface here as toasts, never silently. */}
        <ToastProvider>{children}</ToastProvider>
      </body>
    </html>
  );
}
