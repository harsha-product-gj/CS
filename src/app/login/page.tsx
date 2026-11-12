import { Headset, PackageCheck, Search } from "lucide-react";
import { LoginForm } from "./login-form";
import { BedGlyph, Wordmark } from "@/components/brand";

const POINTS = [
  { icon: Search, text: "Find any customer by mobile, order ID, AWB, name or pincode" },
  { icon: Headset, text: "Track every enquiry and complaint to closure" },
  { icon: PackageCheck, text: "Follow returns, replacements and exchanges end to end" },
];

export default function LoginPage() {
  return (
    <main className="flex min-h-dvh flex-col bg-ds-surface">
      <div className="flex flex-1 gap-6 p-4 md:p-6">
        {/* Brand panel (Intellsys sign-in layout: visual on the left, form on the right) */}
        <section className="relative hidden flex-1 flex-col justify-between overflow-hidden rounded-ds-xxlarge bg-[#FAEED6] p-10 text-[#2b2118] md:flex">
          <Wordmark size={34} />
          <div className="relative z-10 max-w-md">
            <h2 className="mb-6 text-[2rem] leading-[2.4rem] font-semibold text-[#3A6549]" style={{ fontFamily: "var(--font-poetsen)" }}>
              Every customer, every order, one place.
            </h2>
            <ul className="space-y-3 text-[15px]">
              {POINTS.map(({ icon: Icon, text }) => (
                <li key={text} className="flex items-start gap-3">
                  <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-[#FFFDFA] text-[#FE8100]">
                    <Icon size={16} aria-hidden />
                  </span>
                  <span className="pt-0.5">{text}</span>
                </li>
              ))}
            </ul>
          </div>
          <p className="relative z-10 text-sm text-[#3A6549]">SleepyHug customer support</p>
          <BedGlyph className="pointer-events-none absolute -right-16 -bottom-10 w-[420px] opacity-15" />
        </section>

        {/* Sign-in */}
        <section className="flex w-full flex-col items-center justify-center md:w-[440px] md:flex-none">
          <div className="w-full max-w-sm">
            <h1 className="mb-8 flex flex-wrap items-end justify-center gap-x-2 gap-y-1 text-center text-[1.4rem] leading-none font-semibold">
              <span className="pb-[3px]">Welcome to</span>
              <Wordmark size={28} />
            </h1>
            <p className="ds-heading-small mb-6 text-center">Sign in</p>
            <LoginForm />
            <p className="mt-6 text-center text-xs text-ds-text-subtlest">
              No account yet? Ask your admin to add you.
            </p>
          </div>
        </section>
      </div>
    </main>
  );
}
