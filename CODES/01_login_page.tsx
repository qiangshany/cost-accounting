'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { Lock, Building2 } from 'lucide-react';

// 账号配置
const ACCOUNTS = {
  '碱车间': { password: 'xinlong', role: 'workshop' },
  '氯车间': { password: 'xinlong', role: 'workshop' },
  '生产管理部': { password: 'xinlong', role: 'management' },
  '采购部': { password: 'xinlong', role: 'purchasing' },
  'admin': { password: 'xinlong', role: 'admin' },
};

interface LoginPageProps {
  onLoginSuccess: () => void;
}

export default function LoginPage({ onLoginSuccess }: LoginPageProps) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!username || !password) {
      toast.error('请输入账号和密码');
      return;
    }

    setIsLoading(true);
    await new Promise(resolve => setTimeout(resolve, 800));

    const account = ACCOUNTS[username as keyof typeof ACCOUNTS];

    if (account && account.password === password) {
      toast.success('登录成功');
      localStorage.setItem('isLoggedIn', 'true');
      localStorage.setItem('userRole', account.role);
      localStorage.setItem('username', username);
      localStorage.setItem('loginTime', new Date().toISOString());
      setTimeout(() => onLoginSuccess(), 100);
    } else {
      toast.error('账号或密码错误');
    }

    setIsLoading(false);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-slate-100 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950 flex items-center justify-center p-4">
      <Card className="w-full max-w-md shadow-lg border-slate-200 dark:border-slate-800">
        <CardHeader className="space-y-4 text-center pb-6">
          <div className="flex justify-center">
            <div className="p-4 bg-blue-100 dark:bg-blue-900/30 rounded-2xl">
              <Building2 className="w-12 h-12 text-blue-600 dark:text-blue-400" />
            </div>
          </div>
          <div>
            <CardTitle className="text-2xl font-bold text-slate-800 dark:text-slate-100">
              成本核算系统
            </CardTitle>
            <CardDescription className="text-slate-500 dark:text-slate-400 mt-2">
              请输入账号和密码登录
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleLogin} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="username" className="text-sm font-medium text-slate-600 dark:text-slate-400">
                账号
              </Label>
              <Input
                id="username"
                type="text"
                placeholder="请输入账号"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="h-11 bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700"
                disabled={isLoading}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password" className="text-sm font-medium text-slate-600 dark:text-slate-400">
                密码
              </Label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                <Input
                  id="password"
                  type="password"
                  placeholder="请输入密码"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="h-11 bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 pl-10"
                  disabled={isLoading}
                />
              </div>
            </div>
            <Button
              type="submit"
              className="w-full h-11 bg-blue-600 hover:bg-blue-700 text-white shadow-md"
              disabled={isLoading}
            >
              {isLoading ? '登录中...' : '登录'}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
