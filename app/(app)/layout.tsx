import { auth } from "@/auth";
import { redirect } from "next/navigation";
import Link from "next/link";
import { signOut } from "@/auth";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  if (!session) redirect("/login");

  return (
    <div className="min-h-screen flex flex-col">
      <header className="border-b border-gray-200 bg-white">
        <div className="mx-auto flex max-w-4xl items-center justify-between px-4 py-3">
          <Link href="/" className="text-lg font-bold text-brand-600">
            LanTrainer
          </Link>
          <nav className="flex items-center gap-4 text-sm">
            <Link href="/practice" className="text-gray-600 hover:text-gray-900">
              今日练习
            </Link>
            <Link href="/history" className="text-gray-600 hover:text-gray-900">
              历史
            </Link>
            <Link href="/settings" className="text-gray-600 hover:text-gray-900">
              设置
            </Link>
            <form
              action={async () => {
                "use server";
                await signOut({ redirectTo: "/login" });
              }}
            >
              <button type="submit" className="text-gray-400 hover:text-gray-600">
                退出
              </button>
            </form>
          </nav>
        </div>
      </header>
      <main className="mx-auto w-full max-w-4xl flex-1 px-4 py-8">
        {children}
      </main>
    </div>
  );
}
