'use client';

import { useRouter } from 'next/navigation';

interface User {
  id: number;
  username: string;
  name: string;
  role: string;
  staffId: string;
}

interface HeaderProps {
  user: User;
}

export default function Header({ user }: HeaderProps) {
  const router = useRouter();

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    document.cookie = 'token=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT';
    router.push('/login');
  };

  return (
    <header className="bg-white shadow-sm border-b border-gray-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          <div className="flex items-center">
            <h1 className="text-xl font-bold text-gray-800">排班系统</h1>
            <span className="ml-3 text-sm text-gray-500">医院IT硬件外包服务</span>
          </div>

          <div className="flex items-center gap-4">
            <div className="text-sm">
              <span className="text-gray-500">欢迎，</span>
              <span className="font-medium text-gray-800 ml-1">{user.name}</span>
              {user.role === 'admin' && (
                <span className="ml-2 px-2 py-0.5 bg-blue-100 text-blue-700 text-xs rounded-full">
                  管理员
                </span>
              )}
            </div>
            <button
              onClick={handleLogout}
              className="text-sm text-gray-500 hover:text-red-600 transition"
            >
              退出登录
            </button>
          </div>
        </div>
      </div>
    </header>
  );
}
