'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Search, Bell, Plus } from 'lucide-react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from './ui/dropdown-menu';
import { useRouter } from 'next/navigation';
import { useUserProfile } from '@/hooks/useUserProfile';
import { clearAccessToken } from '@/lib/auth-token';
import { clearUserProfile, profileInitials } from '@/lib/user-profile';

interface HeaderProps {
  onNewTask?: () => void;
}

export default function Header({ onNewTask }: HeaderProps) {
  const router = useRouter();
  const { profile } = useUserProfile();
  const [searchQuery, setSearchQuery] = useState('');
  const initials = profileInitials(profile);
  const displayName =
    profile.fullName.trim() || profile.email || 'Người dùng';

  const handleLogout = () => {
    clearAccessToken();
    clearUserProfile();
    router.push('/login');
  };

  return (
    <header className="bg-white border-b border-gray-200 sticky top-0 z-40 h-16">
      <div className="h-full px-6 flex items-center justify-between gap-4">
        {/* Search Bar */}
        <div className="flex-1 max-w-2xl">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <Input
              type="text"
              placeholder="Tìm kiếm task, project..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 bg-gray-50 border-gray-200 focus:bg-white"
            />
          </div>
        </div>

        {/* Right Section */}
        <div className="flex items-center gap-3">
          {/* New Task Button */}
          <Button
            onClick={onNewTask}
            className="bg-[#004ba8] hover:bg-[#003d8a] text-white gap-2"
          >
            <Plus className="w-4 h-4" />
            <span className="hidden sm:inline">New Task</span>
          </Button>

          {/* Notifications */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="relative p-2 rounded-lg hover:bg-gray-100 transition-colors">
                <Bell className="w-5 h-5 text-gray-700" />
                <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full"></span>
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-80">
              <DropdownMenuLabel>Thông báo</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <div className="max-h-96 overflow-y-auto">
                <DropdownMenuItem className="flex flex-col items-start gap-1 p-4">
                  <div className="font-medium">Task mới được phân công</div>
                  <div className="text-sm text-gray-600">
                    Bạn được giao task "Design new homepage"
                  </div>
                  <div className="text-xs text-gray-400">2 giờ trước</div>
                </DropdownMenuItem>
                <DropdownMenuItem className="flex flex-col items-start gap-1 p-4">
                  <div className="font-medium">Deadline sắp tới</div>
                  <div className="text-sm text-gray-600">
                    "Implement user authentication" đến hạn trong 2 ngày
                  </div>
                  <div className="text-xs text-gray-400">5 giờ trước</div>
                </DropdownMenuItem>
                <DropdownMenuItem className="flex flex-col items-start gap-1 p-4">
                  <div className="font-medium">Comment mới</div>
                  <div className="text-sm text-gray-600">
                    Trần Thị B đã comment trong task của bạn
                  </div>
                  <div className="text-xs text-gray-400">1 ngày trước</div>
                </DropdownMenuItem>
              </div>
              <DropdownMenuSeparator />
              <DropdownMenuItem className="justify-center text-[#004ba8] cursor-pointer">
                Xem tất cả
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          {/* User Avatar */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="flex items-center gap-2 rounded-lg hover:bg-gray-100 p-1 pr-3 transition-colors">
                <div className="w-8 h-8 rounded-full bg-[#004ba8] flex items-center justify-center">
                  <span className="text-white font-medium text-sm">{initials}</span>
                </div>
                <span className="hidden md:inline text-sm font-medium text-gray-700 truncate max-w-[140px]">
                  {displayName}
                </span>
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuLabel>
                <div>
                  <div className="font-medium">{displayName}</div>
                  {profile.email ? (
                    <div className="text-sm text-gray-600 font-normal truncate max-w-[200px]">
                      {profile.email}
                    </div>
                  ) : null}
                </div>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem asChild>
                <Link href="/app/account">Tài khoản</Link>
              </DropdownMenuItem>
              <DropdownMenuItem disabled className="opacity-50">
                Cài đặt (sắp có)
              </DropdownMenuItem>
              <DropdownMenuItem disabled className="opacity-50">
                Trợ giúp (sắp có)
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={handleLogout} className="text-red-600 cursor-pointer">
                Đăng xuất
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </header>
  );
}
