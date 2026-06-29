'use client';

import { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';

interface User {
  id: number;
  username: string;
  name: string;
  role: string;
  staffId: string;
}

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [user, setUser] = useState<User | null>(null);

  useEffect(() => {
    const storedUser = localStorage.getItem('user');
    if (!storedUser) {
      router.replace('/login');
      return;
    }
    const parsed = JSON.parse(storedUser);
    if (parsed.role !== 'admin') {
      router.replace('/');
      return;
    }
    setUser(parsed);
  }, [router]);

  if (!user) {
    return <div className="min-h-screen flex items-center justify-center text-gray-500">加载中...</div>;
  }

  const navItems = [
    { href: '/admin', label: '管理首页', icon: '🏠' },
    { href: '/admin/team', label: '团队成员', icon: '👥' },
    { href: '/admin/rules', label: '排班规则', icon: '⚙️' },
  ];

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center gap-6">
              <Link href="/" className="flex items-center gap-2 text-gray-600 hover:text-gray-800 transition">
                <span className="text-xl">←</span>
                <span className="text-sm">返回首页</span>
              </Link>
              <div className="h-6 w-px bg-gray-300"></div>
              <h1 className="text-xl font-bold text-gray-800">⚙️ 管理后台</h1>
            </div>
            <div className="text-sm text-gray-500">
              管理员：{user.name}
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <nav className="flex gap-2 mb-6">
          {navItems.map(item => (
            <Link
              key={item.href}
              href={item.href}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition ${
                pathname === item.href
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'bg-white text-gray-600 hover:bg-gray-100 border border-gray-200'
              }`}
            >
              {item.icon} {item.label}
            </Link>
          ))}
        </nav>
        {children}
      </div>
    </div>
  );
}
