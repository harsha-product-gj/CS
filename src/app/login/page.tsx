import { LoginForm } from "./login-form";

export default function LoginPage() {
  return (
    <main className="flex flex-1 items-center justify-center px-4">
      <div className="w-full max-w-sm rounded-lg border border-stone-200 bg-white p-6 shadow-sm">
        <h1 className="text-lg font-semibold">SleepyHug CS</h1>
        <p className="mb-6 text-sm text-stone-500">Sign in to the support workspace</p>
        <LoginForm />
      </div>
    </main>
  );
}
