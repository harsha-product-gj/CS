import { LoginForm } from "./login-form";
import { Brand } from "@/components/shell/top-bar";

export default function LoginPage() {
  return (
    <main className="flex min-h-dvh items-center justify-center bg-ds-surface-sunken px-4">
      <div className="w-full max-w-sm rounded-ds-large border border-ds-border bg-ds-surface p-6">
        <div className="mb-6">
          <Brand />
        </div>
        <h1 className="ds-heading-medium">Sign in</h1>
        <p className="mb-6 text-ds-text-subtle">Customer support workspace</p>
        <LoginForm />
      </div>
    </main>
  );
}
