'use client';

import { useState, useEffect, useCallback } from 'react';

interface Staff {
  id: string;
  name: string;
  role: string;
  color: string;
  is_director: boolean;
  is_leader: boolean;
  sort_order: number;
  active: boolean;
}

const EMPTY_FORM: Staff = {
  id: '', name: '', role: '技术员', color: '#6b7280',
  is_director: false, is_leader: false, sort_order: 0, active: true,
};

const PRESET_COLORS = [
  '#1a73e8', '#e91e63', '#4caf50', '#ff9800', '#9c27b0',
  '#00bcd4', '#795548', '#607d8b', '#f44336', '#3f51b5',
];

export default function TeamPage() {
  const [staff, setStaff] = useState<Staff[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [form, setForm] = useState<Staff>({ ...EMPTY_FORM });
  const [error, setError] = useState('');

  const fetchStaff = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/staff', { credentials: 'include' });
      if (res.ok) {
        const data = await res.json();
        setStaff(data.staff || []);
      }
    } catch {
      console.error('Failed to fetch staff');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchStaff(); }, [fetchStaff]);

  const openAdd = () => {
    setEditMode(false);
    setForm({ ...EMPTY_FORM, sort_order: staff.length + 1 });
    setError('');
    setShowModal(true);
  };

  const openEdit = (s: Staff) => {
    setEditMode(true);
    setForm({ ...s });
    setError('');
    setShowModal(true);
  };

  const handleSubmit = async () => {
    if (!form.id.trim() || !form.name.trim()) {
      setError('ID和姓名必填');
      return;
    }

    try {
      const res = await fetch('/api/admin/staff', {
        method: editMode ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(form),
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data.error);
        return;
      }

      setShowModal(false);
      fetchStaff();
    } catch {
      setError('网络错误');
    }
  };

  const handleDelete = async (s: Staff) => {
    if (!confirm(`确定要删除 ${s.name} 吗？`)) return;

    try {
      const res = await fetch(`/api/admin/staff?id=${s.id}`, {
        method: 'DELETE',
        credentials: 'include',
      });
      const data = await res.json();
      if (!res.ok) {
        alert(data.error);
        return;
      }
      fetchStaff();
    } catch {
      alert('删除失败');
    }
  };

  const toggleActive = async (s: Staff) => {
    try {
      await fetch('/api/admin/staff', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ ...s, active: !s.active }),
      });
      fetchStaff();
    } catch {
      alert('操作失败');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-gray-800">团队成员管理</h2>
        <button
          onClick={openAdd}
          className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 transition"
        >
          + 添加成员
        </button>
      </div>

      {loading ? (
        <div className="text-center py-12 text-gray-500">加载中...</div>
      ) : (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">排序</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">ID</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">姓名</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">角色</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">颜色</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">权限</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">状态</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">操作</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {staff.map(s => (
                <tr key={s.id} className={`hover:bg-gray-50 transition ${!s.active ? 'opacity-50' : ''}`}>
                  <td className="px-4 py-3 text-sm text-gray-600">{s.sort_order}</td>
                  <td className="px-4 py-3 text-sm font-mono text-gray-600">{s.id}</td>
                  <td className="px-4 py-3 text-sm font-medium text-gray-800">
                    <span className="inline-flex items-center gap-2">
                      <span className="w-3 h-3 rounded-full" style={{ backgroundColor: s.color }}></span>
                      {s.name}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-600">{s.role}</td>
                  <td className="px-4 py-3">
                    <span className="inline-block w-6 h-6 rounded-full border border-gray-200" style={{ backgroundColor: s.color }}></span>
                  </td>
                  <td className="px-4 py-3 text-sm">
                    {s.is_director && <span className="px-2 py-0.5 bg-red-100 text-red-700 text-xs rounded-full mr-1">主管</span>}
                    {s.is_leader && <span className="px-2 py-0.5 bg-blue-100 text-blue-700 text-xs rounded-full">组长</span>}
                    {!s.is_director && !s.is_leader && <span className="text-gray-400 text-xs">普通</span>}
                  </td>
                  <td className="px-4 py-3">
                    <button
                      onClick={() => toggleActive(s)}
                      className={`px-2 py-0.5 text-xs rounded-full ${
                        s.active ? 'bg-green-100 text-green-700 hover:bg-green-200' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                      } transition cursor-pointer`}
                    >
                      {s.active ? '在职' : '停用'}
                    </button>
                  </td>
                  <td className="px-4 py-3 text-right space-x-2">
                    <button onClick={() => openEdit(s)} className="text-blue-600 hover:text-blue-800 text-sm font-medium transition">编辑</button>
                    <button onClick={() => handleDelete(s)} className="text-red-600 hover:text-red-800 text-sm font-medium transition">删除</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {staff.length === 0 && (
            <div className="text-center py-12 text-gray-400">暂无成员</div>
          )}
        </div>
      )}

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50" onClick={() => setShowModal(false)}>
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6" onClick={e => e.stopPropagation()}>
            <h3 className="text-lg font-bold text-gray-800 mb-4">{editMode ? '编辑成员' : '添加成员'}</h3>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">人员ID</label>
                <input
                  type="text"
                  value={form.id}
                  onChange={e => setForm({ ...form, id: e.target.value })}
                  disabled={editMode}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-800 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none disabled:bg-gray-100 disabled:text-gray-500"
                  placeholder="如: zhangsan"
                />
                {!editMode && <p className="text-xs text-gray-400 mt-1">唯一标识，创建后不可修改</p>}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">姓名</label>
                <input
                  type="text"
                  value={form.name}
                  onChange={e => setForm({ ...form, name: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-800 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                  placeholder="真实姓名"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">角色</label>
                <input
                  type="text"
                  value={form.role}
                  onChange={e => setForm({ ...form, role: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-800 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                  placeholder="如: 技术员、技术组长"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">颜色标识</label>
                <div className="flex flex-wrap gap-2">
                  {PRESET_COLORS.map(c => (
                    <button
                      key={c}
                      onClick={() => setForm({ ...form, color: c })}
                      className={`w-8 h-8 rounded-full border-2 transition ${form.color === c ? 'border-gray-800 scale-110' : 'border-transparent'}`}
                      style={{ backgroundColor: c }}
                    />
                  ))}
                  <input
                    type="color"
                    value={form.color}
                    onChange={e => setForm({ ...form, color: e.target.value })}
                    className="w-8 h-8 rounded-full cursor-pointer"
                  />
                </div>
              </div>

              <div className="flex items-center gap-4">
                <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={form.is_director}
                    onChange={e => setForm({ ...form, is_director: e.target.checked })}
                    className="rounded"
                  />
                  主管
                </label>
                <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={form.is_leader}
                    onChange={e => setForm({ ...form, is_leader: e.target.checked })}
                    className="rounded"
                  />
                  组长
                </label>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">排序</label>
                <input
                  type="number"
                  value={form.sort_order}
                  onChange={e => setForm({ ...form, sort_order: parseInt(e.target.value) || 0 })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-800 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                />
              </div>

              {error && (
                <div className="bg-red-50 text-red-600 p-3 rounded-lg text-sm">{error}</div>
              )}
            </div>

            <div className="flex justify-end gap-3 mt-6">
              <button
                onClick={() => setShowModal(false)}
                className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800 transition"
              >
                取消
              </button>
              <button
                onClick={handleSubmit}
                className="px-6 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition"
              >
                {editMode ? '保存' : '添加'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
