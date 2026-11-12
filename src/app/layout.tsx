import type { Metadata } from "next";
import { Inter, Poetsen_One } from "next/font/google";
import "./globals.css";

const inter = Inter({ variable: "--font-inter", subsets: ["latin"] });
const poetsen = Poetsen_One({ variable: "--font-poetsen", weight: "400", subsets: ["latin"] });

export const metadata: Metadata = {
  title: "SleepyHug CS",
  description: "Customer support workspace for SleepyHug",
};

// Applies the saved theme and sidebar state before first paint (no flash).
const BOOT = `(function(){try{var d=document.documentElement,t=localStorage.getItem('sh-theme')||'light';
var m=t==='system'?(matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light'):t;
d.setAttribute('data-color-mode',m);d.setAttribute('data-theme-pref',t);
if(localStorage.getItem('sh-sidebar')==='collapsed')d.setAttribute('data-sidebar','collapsed');}catch(e){}})();`;

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      data-color-mode="light"
      suppressHydrationWarning
      className={`${inter.variable} ${poetsen.variable} h-full antialiased`}
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: BOOT }} />
      </head>
      <body className="min-h-full">{children}</body>
    </html>
  );
}
