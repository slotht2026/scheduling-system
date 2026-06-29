'use client';

import { useState, useEffect } from 'react';

interface StaffMember {
  id: string;
  name: string;
  role: string;
  color: string;
  isDirector: boolean;
  isLeader: boolean;
}

interface GenerateButtonProps {
  year: number;
  month: number;
  staff: StaffMember[];
  onGenerated: () => void;
}

export default function GenerateButton({ year, month, staff, onGenerated }: GenerateButtonProps) {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [selected, setSelected] = useState<string[]>([]);
  const [requireLeader, setRequireLeader] = useState(false);
  const [restAfterNight, setRestAfterNight] = useState(true);
  const [maxConsecutive, setMaxConsecutive] = useState(true);

  // 默认全选
  useEffect(() => {
    if (showModal && selected.length === 0) {
      setSelected(staff.map(s => s.id));
    }
  }, [showModal, staff, selected.length]);

  const toggle = (id: string) => {
    setSelected(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };

  const toggleAll = () => {
    if (selected.length === staff.length) {
      setSelected([]);
    } else {
      setSelected(staff.map(s => s.id));
    }
  };

  const handleGenerate = async () => {
    if (selected.length === 0) {
      alert('请至少选择一人');
      return;
    }

    setShowModal(false);
    setLoading(true);
    setResult(null);

    try {
      const res = await fetch('/api/schedule', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ year, month, staffIds: selected, requireLeader, restAfterNight, maxConsecutive }),
        credentials: 'include',
      });

      const data = await res.json();

      if (!res.ok) {
        setResult(`错误：${data.error}`);
        return;
      }

      const summary = data.hoursSummary
        ?.map((s: { name: string; hours: number }) => `${s.name}: ${s.hours}h`)
        .join(' | ');

      setResult(`✅ ${data.message}（共${data.totalEntries}条记录）\n${summary}`);
      onGenerated();
    } catch {
      setResult('网络错误，请重试');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mb-4">
      <button
        onClick={() => setShowModal(true)}
        disabled={loading}
        className="bg-green-600 text-white px-6 py-2 rounded-lg font-medium hover:bg-green-700 focus:ring-2 focus:ring-green-500 focus:ring-offset-2 transition disabled:opacity-50"
      >
        {loading ? '生成中...' : `生成 ${year}年${month}月 排班`}
      </button>

      {result && (
        <div className="mt-3 p-3 bg-gray-50 rounded-lg text-sm whitespace-pre-line">
          {result}
        </div>
      )}

      {/* 选择排班人员弹窗 */}
      {showModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50" onClick={() => setShowModal(false)}>
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6" onClick={e => e.stopPropagation()}>
            <h3 className="text-lg font-bold text-gray-800 mb-1">选择排班人员</h3>
            <p className="text-sm text-gray-500 mb-4">勾选参与 {year}年{month}月 排班的人员</p>

            <div className="flex items-center justify-between mb-3 pb-2 border-b border-gray-100">
              <label className="flex items-center gap-2 text-sm text-blue-600 cursor-pointer font-medium" onClick={toggleAll}>
                <input type="checkbox" checked={selected.length === staff.length} readOnly className="rounded" />
                全选 / 取消
              </label>
              <span className="text-xs text-gray-400">已选 {selected.length}/{staff.length} 人</span>
            </div>

            <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer mb-2 p-2 bg-amber-50 rounded-lg border border-amber-200">
              <input
                type="checkbox"
                checked={requireLeader}
                onChange={e => setRequireLeader(e.target.checked)}
                className="rounded"
              />
              <span className="font-medium">白班必须含1名Leader（组长/主管）</span>
            </label>

            <div className="grid grid-cols-2 gap-2 mb-3">
              <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer p-2 bg-blue-50 rounded-lg border border-blue-200">
                <input
                  type="checkbox"
                  checked={restAfterNight}
                  onChange={e => setRestAfterNight(e.target.checked)}
                  className="rounded"
                />
                <span>夜班后必须休息1天</span>
              </label>
              <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer p-2 bg-blue-50 rounded-lg border border-blue-200">
                <input
                  type="checkbox"
                  checked={maxConsecutive}
                  onChange={e => setMaxConsecutive(e.target.checked)}
                  className="rounded"
                />
                <span>连续工作不超过5天</span>
              </label>
            </div>

            <div className="space-y-2 max-h-64 overflow-y-auto">
              {staff.map(s => (
                <label key={s.id} className="flex items-center gap-3 p-2 rounded-lg hover:bg-gray-50 cursor-pointer transition">
                  <input
                    type="checkbox"
                    checked={selected.includes(s.id)}
                    onChange={() => toggle(s.id)}
                    className="rounded"
                  />
                  <span className="w-3 h-3 rounded-full" style={{ backgroundColor: s.color }}></span>
                  <span className="text-sm font-medium text-gray-800">{s.name}</span>
                  <span className="text-xs text-gray-400">{s.role}</span>
                  {s.isDirector && <span className="px-1.5 py-0.5 bg-red-100 text-red-700 text-[10px] rounded-full">主管</span>}
                  {s.isLeader && <span className="px-1.5 py-0.5 bg-blue-100 text-blue-700 text-[10px] rounded-full">组长</span>}
                </label>
              ))}
            </div>

            <div className="flex justify-end gap-3 mt-6">
              <button onClick={() => setShowModal(false)} className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800 transition">取消</button>
              <button
                onClick={handleGenerate}
                disabled={selected.length === 0}
                className="px-6 py-2 bg-green-600 text-white text-sm font-medium rounded-lg hover:bg-green-700 transition disabled:opacity-40"
              >
                确认生成排班
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
