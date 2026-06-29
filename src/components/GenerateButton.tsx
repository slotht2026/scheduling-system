'use client';

import { useState } from 'react';

interface GenerateButtonProps {
  year: number;
  month: number;
  onGenerated: () => void;
}

export default function GenerateButton({ year, month, onGenerated }: GenerateButtonProps) {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<string | null>(null);

  const handleGenerate = async () => {
    if (!confirm(`确定要生成 ${year}年${month}月 的排班吗？\n这将覆盖已有的排班数据。`)) {
      return;
    }

    setLoading(true);
    setResult(null);

    try {
      const token = localStorage.getItem('token');
      const res = await fetch('/api/schedule', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ year, month }),
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
        onClick={handleGenerate}
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
    </div>
  );
}
