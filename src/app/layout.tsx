import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: '排班系统 - 医院IT硬件外包服务',
  description: '医院IT硬件外包服务团队排班管理系统',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="zh-CN">
      <body className="bg-gray-50 min-h-screen">
        {children}
      </body>
    </html>
  );
}
