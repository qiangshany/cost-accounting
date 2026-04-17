'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { Lock, Building2, User, Eye, EyeOff, Shield, Factory, ShoppingCart, BarChart3, Settings } from 'lucide-react';

// 账号配置
const ACCOUNTS: Record<string, { password: string; role: string; roleName: string }> = {
  '碱车间': { password: 'xinlong', role: 'workshop', roleName: '碱车间' },
  '氯车间': { password: 'xinlong', role: 'workshop', roleName: '氯车间' },
  '生产管理部': { password: 'xinlong', role: 'management', roleName: '生产管理部' },
  '采购部': { password: 'xinlong', role: 'purchasing', roleName: '采购部' },
  'admin': { password: 'xinlong', role: 'admin', roleName: '系统管理员' },
};

// 角色图标映射
const ROLE_ICONS: Record<string, React.ElementType> = {
  workshop: Factory,
  management: Settings,
  purchasing: ShoppingCart,
  admin: Shield,
};

// 角色颜色映射
const ROLE_COLORS: Record<string, { bg: string; text: string; border: string; icon: string }> = {
  workshop: {
    bg: 'bg-blue-50 dark:bg-blue-950/30',
    text: 'text-blue-600 dark:text-blue-400',
    border: 'border-blue-200 dark:border-blue-800',
    icon: 'bg-blue-100 dark:bg-blue-900/50'
  },
  management: {
    bg: 'bg-emerald-50 dark:bg-emerald-950/30',
    text: 'text-emerald-600 dark:text-emerald-400',
    border: 'border-emerald-200 dark:border-emerald-800',
    icon: 'bg-emerald-100 dark:bg-emerald-900/50'
  },
  purchasing: {
    bg: 'bg-amber-50 dark:bg-amber-950/30',
    text: 'text-amber-600 dark:text-amber-400',
    border: 'border-amber-200 dark:border-amber-800',
    icon: 'bg-amber-100 dark:bg-amber-900/50'
  },
  admin: {
    bg: 'bg-violet-50 dark:bg-violet-950/30',
    text: 'text-violet-600 dark:text-violet-400',
    border: 'border-violet-200 dark:border-violet-800',
    icon: 'bg-violet-100 dark:bg-violet-900/50'
  },
};

interface LoginPageProps {
  onLoginSuccess: () => void;
}

export default function LoginPage({ onLoginSuccess }: LoginPageProps) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [selectedRole, setSelectedRole] = useState<string | null>(null);
  const [isFormVisible, setIsFormVisible] = useState(false);

  // 动画效果：组件挂载时显示表单
  useEffect(() => {
    const timer = setTimeout(() => setIsFormVisible(true), 100);
    return () => clearTimeout(timer);
  }, []);

  const handleRoleSelect = (role: string) => {
    setSelectedRole(role);
    // 自动填充对应账号
    const roleAccount = Object.entries(ACCOUNTS).find(([_, account]) => account.role === role);
    if (roleAccount) {
      setUsername(roleAccount[0]);
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!username || !password) {
      toast.error('请输入账号和密码');
      return;
    }

    setIsLoading(true);

    // 模拟登录验证延迟
    await new Promise(resolve => setTimeout(resolve, 600));

    const account = ACCOUNTS[username as keyof typeof ACCOUNTS];

    if (account && account.password === password) {
      toast.success('登录成功，欢迎回来！');

      // 保存登录状态和角色到 localStorage
      try {
        localStorage.setItem('isLoggedIn', 'true');
        localStorage.setItem('userRole', account.role);
        localStorage.setItem('username', username);
        localStorage.setItem('loginTime', new Date().toISOString());
      } catch (error) {
        console.error('保存登录状态失败:', error);
      }

      setTimeout(() => {
        onLoginSuccess();
      }, 100);
    } else {
      toast.error('账号或密码错误，请重试');
    }

    setIsLoading(false);
  };

  return (
    <div className="min-h-screen relative overflow-hidden">
      {/* 背景装饰 */}
      <div className="absolute inset-0 bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 dark:from-slate-950 dark:via-slate-900 dark:to-indigo-950">
        {/* 装饰性几何图形 */}
        <div className="absolute top-0 left-0 w-96 h-96 bg-blue-500/5 rounded-full blur-3xl"></div>
        <div className="absolute bottom-0 right-0 w-96 h-96 bg-indigo-500/5 rounded-full blur-3xl"></div>
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-blue-400/3 rounded-full blur-3xl"></div>
        
        {/* 网格背景 */}
        <div className="absolute inset-0 bg-[linear-gradient(to_right,#00000008_1px,transparent_1px),linear-gradient(to_bottom,#00000008_1px,transparent_1px)] bg-[size:24px_24px]"></div>
      </div>

      {/* 主要内容 */}
      <div className="relative z-10 flex min-h-screen items-center justify-center p-4">
        <div className={`w-full max-w-5xl transition-all duration-700 ${isFormVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}>
          {/* 顶部标题 */}
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center p-4 mb-4 bg-white/80 dark:bg-slate-900/80 rounded-2xl shadow-lg backdrop-blur-sm border border-slate-200/50 dark:border-slate-800/50">
              <Building2 className="w-14 h-14 text-blue-600 dark:text-blue-400" />
            </div>
            <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-600 to-indigo-600 dark:from-blue-400 dark:to-indigo-400 bg-clip-text text-transparent">
              氯碱厂成本管理系统
            </h1>
            <p className="mt-2 text-slate-500 dark:text-slate-400 text-sm">
              工业生产成本核算与精细化管理平台
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-start">
            {/* 左侧：角色选择 */}
            <Card className="shadow-xl border-slate-200/50 dark:border-slate-800/50 bg-white/80 dark:bg-slate-900/80 backdrop-blur-sm">
              <CardHeader className="pb-4">
                <CardTitle className="flex items-center gap-2 text-lg font-semibold">
                  <User className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                  选择登录角色
                </CardTitle>
                <CardDescription>
                  点击下方图标快速选择您的身份
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {/* 角色选择卡片 */}
                {[
                  { role: 'workshop', name: '车间填报', description: '碱车间 / 氯车间' },
                  { role: 'purchasing', name: '采购部', description: '原材料价格管理' },
                  { role: 'management', name: '生产管理部', description: '费用填报与成本汇总' },
                  { role: 'admin', name: '系统管理员', description: '数据管理与分析报表' },
                ].map((item) => {
                  const Icon = ROLE_ICONS[item.role];
                  const colors = ROLE_COLORS[item.role];
                  const isSelected = selectedRole === item.role;

                  return (
                    <button
                      key={item.role}
                      type="button"
                      onClick={() => handleRoleSelect(item.role)}
                      className={`w-full p-4 rounded-xl transition-all duration-200 flex items-center gap-4 text-left border-2 ${
                        isSelected
                          ? `${colors.bg} ${colors.border} shadow-md`
                          : 'bg-white dark:bg-slate-800/50 border-transparent hover:border-slate-200 dark:hover:border-slate-700 hover:shadow-sm'
                      }`}
                    >
                      <div className={`p-3 rounded-xl ${colors.icon}`}>
                        <Icon className={`w-6 h-6 ${colors.text}`} />
                      </div>
                      <div className="flex-1">
                        <div className="font-semibold text-slate-800 dark:text-slate-100">
                          {item.name}
                        </div>
                        <div className="text-sm text-slate-500 dark:text-slate-400">
                          {item.description}
                        </div>
                      </div>
                      {isSelected && (
                        <div className={`w-6 h-6 rounded-full ${colors.bg} flex items-center justify-center`}>
                          <div className={`w-2 h-2 rounded-full ${colors.text}`}></div>
                        </div>
                      )}
                    </button>
                  );
                })}
              </CardContent>
            </Card>

            {/* 右侧：登录表单 */}
            <Card className="shadow-xl border-slate-200/50 dark:border-slate-800/50 bg-white/80 dark:bg-slate-900/80 backdrop-blur-sm">
              <CardHeader className="pb-4">
                <CardTitle className="flex items-center gap-2 text-lg font-semibold">
                  <Lock className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                  账号登录
                </CardTitle>
                <CardDescription>
                  {selectedRole ? `已选择：${ROLE_COLORS[selectedRole] ? Object.values(ACCOUNTS).find(a => a.role === selectedRole)?.roleName : ''}` : '请输入您的账号信息'}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleLogin} className="space-y-5">
                  {/* 账号输入 */}
                  <div className="space-y-2">
                    <Label htmlFor="username" className="text-sm font-medium text-slate-700 dark:text-slate-300">
                      账号
                    </Label>
                    <div className="relative">
                      <User className="absolute left-3.5 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400 z-10" />
                      <Input
                        id="username"
                        type="text"
                        placeholder="请输入账号"
                        value={username}
                        onChange={(e) => setUsername(e.target.value)}
                        className="h-12 pl-11 bg-white dark:bg-slate-800/50 border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-100 placeholder:text-slate-400 focus:border-blue-500 focus:ring-blue-500/20"
                        disabled={isLoading}
                        autoComplete="username"
                      />
                    </div>
                  </div>

                  {/* 密码输入 */}
                  <div className="space-y-2">
                    <Label htmlFor="password" className="text-sm font-medium text-slate-700 dark:text-slate-300">
                      密码
                    </Label>
                    <div className="relative">
                      <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400 z-10" />
                      <Input
                        id="password"
                        type={showPassword ? 'text' : 'password'}
                        placeholder="请输入密码"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        className="h-12 pl-11 pr-11 bg-white dark:bg-slate-800/50 border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-100 placeholder:text-slate-400 focus:border-blue-500 focus:ring-blue-500/20"
                        disabled={isLoading}
                        autoComplete="current-password"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors"
                      >
                        {showPassword ? (
                          <EyeOff className="w-5 h-5" />
                        ) : (
                          <Eye className="w-5 h-5" />
                        )}
                      </button>
                    </div>
                  </div>

                  {/* 登录按钮 */}
                  <Button
                    type="submit"
                    className="w-full h-12 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white shadow-lg shadow-blue-500/25 font-medium text-base transition-all duration-200 disabled:opacity-50"
                    disabled={isLoading}
                  >
                    {isLoading ? (
                      <div className="flex items-center gap-2">
                        <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                        <span>登录中...</span>
                      </div>
                    ) : (
                      '登 录'
                    )}
                  </Button>

                  {/* 提示信息 */}
                  <div className="text-center text-xs text-slate-400 dark:text-slate-500 space-y-1">
                    <p>默认密码：xinlong</p>
                    <p>如有疑问请联系系统管理员</p>
                  </div>
                </form>
              </CardContent>
            </Card>
          </div>

          {/* 底部信息 */}
          <div className="mt-8 text-center">
            <p className="text-xs text-slate-400 dark:text-slate-500">
              © 2024 氯碱厂成本管理系统 · 工业4.0智能制造
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
