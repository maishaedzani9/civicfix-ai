import { AuthForm } from "@/components/auth-form";
export default function Page() {
  return (
    <main className="grid min-h-screen place-items-center p-5">
      <AuthForm mode="reset" />
    </main>
  );
}
