'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import LoginPage from './components/LoginPage';

export default function HomePage() {
  const router = useRouter();
  const [isCheckingAuth, setIsCheckingAuth] = useState(true);

  // 检查登录状态和角色
  useEffect(() => {
    try {
      const loggedIn = localStorage.getItem('isLoggedIn');
      const userRole = localStorage.getItem('userRole');

      if (loggedIn === 'true' && userRole) {
        // 根据角色跳转到不同页面
        switch (userRole) {
          case 'workshop':
            router.push('/workshop');
            break;
          case 'management':
            router.push('/management');
            break;
          case 'purchasing':
            router.push('/purchasing');
            break;
          case 'admin':
            router.push('/admin');
            break;
          default:
            // 无效角色，清除登录状态
            localStorage.removeItem('isLoggedIn');
            localStorage.removeItem('userRole');
            localStorage.removeItem('username');
            localStorage.removeItem('loginTime');
        }
      }
    } catch (error) {
      console.error('检查登录状态失败:', error);
    } finally {
      setIsCheckingAuth(false);
    }
  }, [router]);

  const handleLoginSuccess = () => {
    // 登录成功后，重新检查角色并跳转
    const userRole = localStorage.getItem('userRole');
    if (userRole) {
      switch (userRole) {
        case 'workshop':
          router.push('/workshop');
          break;
        case 'management':
          router.push('/management');
          break;
        case 'purchasing':
          router.push('/purchasing');
          break;
        case 'admin':
          router.push('/admin');
          break;
      }
    }
  };

  // 检查中显示加载界面
  if (isCheckingAuth) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-slate-100 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950 flex items-center justify-center">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          <p className="mt-3 text-slate-600 dark:text-slate-400">加载中...</p>
        </div>
      </div>
    );
  }

  // 未登录显示登录界面
  return <LoginPage onLoginSuccess={handleLoginSuccess} />;
}
