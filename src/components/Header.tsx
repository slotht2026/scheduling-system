'use client';

interface User {
  id: number;
  username: string;
  name: string;
  role: string;
  staffId: string;
}

interface HeaderProps {
  user: User | null;
  onLogout: () => void;
}

export default function Header({ user, onLogout }: HeaderProps) {
  return (
    <header className="bg-white shadow-sm border-b border-gray-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          <div className="flex items-center gap-3">
            <span className="text-2xl">🏥</span>
            <div>
              <h1 className="text-xl font-bold text-gray-800">智能排班系统</h1>
              <span className="text-xs text-gray-500">医院IT硬件外包服务 · 7×24小时技术支持</span>
            </div>
          </div>

          <div className="flex items-center gap-4">
            {user ? (
              <>
                <div className="text-sm">
                  <span className="text-gray-500">欢迎，</span>
                  <span className="font-medium text-gray-800 ml-1">{user.name}</span>
                  {user.role === 'admin' && (
                    <span className="ml-2 px-2 py-0.5 bg-blue-100 text-blue-700 text-xs rounded-full">管理员</span>
                  )}
                </div>
                {user.role === 'admin' && (
                  <a href="/admin" className="text-sm text-blue-600 hover:text-blue-800 font-medium transition">⚙️ 管理后台</a>
                )}
                <button onClick={onLogout} className="text-sm text-gray-500 hover:text-red-600 transition">退出登录</button>
              </>
            ) : (
              <a href="/login" className="text-sm text-blue-600 hover:text-blue-800 font-medium transition">管理员登录</a>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}
