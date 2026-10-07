import type { Metadata } from "next";
import { ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import "./globals.css";

export const metadata: Metadata = {
  title: "Craftmarket — Admin",
  description: "Craftmarket marketplace administration.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}<ToastContainer position="top-right" autoClose={3500} newestOnTop pauseOnFocusLoss closeOnClick theme="light" /></body></html>;
}
