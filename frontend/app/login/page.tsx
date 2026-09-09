import { AuthForm } from "@/components/auth-form";
import { SiteHeader } from "@/components/site-header";
export default function LoginPage() { return <main className="min-h-screen"><SiteHeader compact /><section className="mx-auto grid min-h-[calc(100vh-4rem)] max-w-7xl place-items-center px-5 py-12"><AuthForm mode="login" /></section></main>; }
