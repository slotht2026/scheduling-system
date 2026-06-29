'use client';

import { useState, useEffect, useCallback } from 'react';

interface Rule {
  id: number;
  key: string;
  value: string;
  label: string;
}

export default function RulesPage() {
  const [rules, setRules] = useState<Rule[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const fetchRules = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/rules', { credentials: 'include' });
      if (res.ok) {
        const data = await res.json();
        setRules(data.rules || []);
      }
    } catch {
      console.error('Failed to fetch rules');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchRules(); }, [fetchRules]);

  const updateValue = (key: string, value: string) => {
    setRules(prev => prev.map(r => r.key === key ? { ...r, value } : r));
  };

  const handleSave = async () => {
    setSaving(true);
    setMessage(null);
    try {
      const res = await fetch('/api/admin/rules', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ rules }),
      });

      if (res.ok) {
        setMessage({ type: 'success', text: '规则保存成功！下次生成排班将使用新规则。' });
      } else {
        const data = await res.json();
        setMessage({ type: 'error', text: data.error || '保存失败' });
      }
    } catch {
      setMessage({ type: 'error', text: '网络错误' });
    } finally {
      setSaving(false);
    }
  };

  // Group rules by category
  const hourRules = rules.filter(r => r.key.includes('hours'));
  const limitRules = rules.filter(r => !r.key.includes('hours'));

  if (loading) {
    return <div className="text-center py-12 text-gray-500">加载中...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-gray-800">排班规则配置</h2>
        <button
          onClick={handleSave}
          disabled={saving}
          className="bg-green-600 text-white px-6 py-2 rounded-lg text-sm font-medium hover:bg-green-700 transition disabled:opacity-50"
        >
          {saving ? '保存中...' : '💾 保存规则'}
        </button>
      </div>

      {message && (
        <div className={`p-4 rounded-lg text-sm ${
          message.type === 'success' ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-red-50 text-red-700 border border-red-200'
        }`}>
          {message.text}
        </div>
      )}

      {/* Hours config */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <h3 className="text-lg font-bold text-gray-800 mb-4">⏰ 班次工时配置</h3>
        <p className="text-sm text-gray-500 mb-4">设置每个班次的工作时长（小时）</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {hourRules.map(rule => (
            <div key={rule.key} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
              <label className="text-sm text-gray-700">{rule.label || rule.key}</label>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  value={rule.value}
                  onChange={e => updateValue(rule.key, e.target.value)}
                  className="w-20 px-3 py-1.5 border border-gray-300 rounded-lg text-sm text-center text-gray-800 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                  min="1"
                  max="24"
                />
                <span className="text-sm text-gray-500">h</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Other rules */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <h3 className="text-lg font-bold text-gray-800 mb-4">📋 排班约束规则</h3>
        <p className="text-sm text-gray-500 mb-4">调整排班算法的核心参数</p>
        <div className="space-y-4">
          {limitRules.map(rule => (
            <div key={rule.key} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
              <div>
                <label className="text-sm font-medium text-gray-700">{rule.label || rule.key}</label>
                <p className="text-xs text-gray-400 mt-0.5 font-mono">{rule.key}</p>
              </div>
              {rule.value === 'true' || rule.value === 'false' ? (
                <select
                  value={rule.value}
                  onChange={e => updateValue(rule.key, e.target.value)}
                  className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm text-gray-800 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                >
                  <option value="true">是</option>
                  <option value="false">否</option>
                </select>
              ) : (
                <input
                  type="number"
                  value={rule.value}
                  onChange={e => updateValue(rule.key, e.target.value)}
                  className="w-24 px-3 py-1.5 border border-gray-300 rounded-lg text-sm text-center text-gray-800 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                  min="0"
                />
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Info */}
      <div className="bg-blue-50 border border-blue-200 rounded-xl p-5">
        <h4 className="font-bold text-blue-800 text-sm mb-2">💡 说明</h4>
        <ul className="text-sm text-blue-700 space-y-1">
          <li>• 修改规则后需点击"保存规则"生效</li>
          <li>• 新规则将在下次生成排班时应用</li>
          <li>• 已生成的排班不受影响</li>
          <li>• 月工时上限建议设为 174（标准）+ 36（加班）= 210h</li>
        </ul>
      </div>
    </div>
  );
}
