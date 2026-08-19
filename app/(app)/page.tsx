import { auth } from "@/auth";
import { redirect } from "next/navigation";
import Link from "next/link";

export default async function HomePage() {
  const session = await auth();
  if (!session) redirect("/login");

  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <h1 className="text-4xl font-bold text-gray-900 mb-4">
        每日外语口语练习
      </h1>
      <p className="text-lg text-gray-500 mb-8 max-w-md">
        每天一篇场景文章，限时朗读，AI 即时评分。坚持练习，口语进步看得见。
      </p>
      <Link href="/practice" className="btn-primary text-base px-8 py-3">
        开始今日练习 →
      </Link>
      <div className="mt-12 grid grid-cols-3 gap-6 text-left w-full max-w-2xl">
        {[
          { icon: "📖", title: "每日新文章", desc: "根据你的练习场景自动生成，每天不重复" },
          { icon: "⏱️", title: "限时挑战", desc: "倒计时朗读，模拟真实口语压力" },
          { icon: "🎯", title: "AI 精准打分", desc: "覆盖率、流利度、准确率三维度评分" },
        ].map((item) => (
          <div key={item.title} className="card">
            <div className="text-2xl mb-2">{item.icon}</div>
            <h3 className="font-semibold mb-1">{item.title}</h3>
            <p className="text-sm text-gray-500">{item.desc}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
