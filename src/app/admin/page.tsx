'use client';

import Link from 'next/link';

export default function AdminPage() {
  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold text-gray-800">管理后台</h2>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Link href="/admin/team" className="group">
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 hover:shadow-md transition">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center text-2xl">👥</div>
              <div>
                <h3 className="text-lg font-bold text-gray-800 group-hover:text-blue-600 transition">团队成员管理</h3>
                <p className="text-sm text-gray-500 mt-1">添加、编辑、删除排班人员，设置角色和颜色标识</p>
              </div>
            </div>
          </div>
        </Link>

        <Link href="/admin/rules" className="group">
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 hover:shadow-md transition">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-green-100 rounded-xl flex items-center justify-center text-2xl">⚙️</div>
              <div>
                <h3 className="text-lg font-bold text-gray-800 group-hover:text-green-600 transition">排班规则配置</h3>
                <p className="text-sm text-gray-500 mt-1">调整班次工时、人数要求、连续工作限制等参数</p>
              </div>
            </div>
          </div>
        </Link>
      </div>
    </div>
  );
}
