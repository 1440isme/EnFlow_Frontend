'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { LayoutDashboard, CheckSquare, Folder, Users, Calendar, BarChart3 } from 'lucide-react';

export default function Sidebar() {
  const pathname = usePathname();

  const menuItems = [
    { icon: LayoutDashboard, label: 'Dashboard', path: '/app/dashboard' },
    { icon: CheckSquare, label: 'My Tasks', path: '/app/my-tasks' },
    { icon: Folder, label: 'Projects', path: '/app/projects' },
    { icon: Users, label: 'Team', path: '/app/team' },
    { icon: Calendar, label: 'Calendar', path: '/app/calendar' },
    { icon: BarChart3, label: 'Reports', path: '/app/reports' },
  ];

  return (
    <aside className="w-64 bg-white border-r border-gray-200 h-screen sticky top-0 flex flex-col">
      {/* Logo */}
      <div className="p-6 border-b border-gray-200">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-[#004ba8] rounded-lg flex items-center justify-center">
            <span className="text-white font-bold">E</span>
          </div>
          <span className="text-xl font-semibold text-gray-900">EnFlow</span>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-4 space-y-1">
        {menuItems.map((item) => {
          const isActive = pathname === item.path;
          return (
            <Link
              key={item.path}
              href={item.path}
              className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${
                isActive
                  ? 'bg-[#e6f0fb] text-[#004ba8] font-medium'
                  : 'text-gray-700 hover:bg-gray-100'
              }`}
            >
              <item.icon className={`w-5 h-5 ${isActive ? 'stroke-[2.5]' : ''}`} />
              <span>{item.label}</span>
            </Link>
          );
        })}
      </nav>

      {/* Bottom Section */}
      <div className="p-4 border-t border-gray-200">
        <div className="bg-[#004ba8]/5 rounded-lg p-4">
          <h4 className="font-medium text-gray-900 mb-1">Nâng cấp Pro</h4>
          <p className="text-sm text-gray-600 mb-3">
            Mở khóa tính năng cao cấp
          </p>
          <button className="w-full bg-[#004ba8] text-white px-4 py-2 rounded-lg hover:bg-[#003d8a] transition-colors">
            Nâng cấp
          </button>
        </div>
      </div>
    </aside>
  );
}
