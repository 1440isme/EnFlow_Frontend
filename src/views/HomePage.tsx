import Link from 'next/link';
import { CheckCircle2, Users, BarChart3, Zap } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function HomePage() {
  const features = [
    {
      icon: CheckCircle2,
      title: 'Quản lý Task hiệu quả',
      description: 'Theo dõi và quản lý công việc một cách dễ dàng với giao diện trực quan',
    },
    {
      icon: Users,
      title: 'Cộng tác nhóm',
      description: 'Phân công và theo dõi tiến độ của team members trong thời gian thực',
    },
    {
      icon: BarChart3,
      title: 'Báo cáo & Phân tích',
      description: 'Theo dõi hiệu suất và tiến độ dự án với dashboard và báo cáo chi tiết',
    },
    {
      icon: Zap,
      title: 'Tăng năng suất',
      description: 'Workflow được tối ưu hóa giúp team làm việc nhanh hơn và hiệu quả hơn',
    },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-white via-blue-50/30 to-white">
      {/* Header */}
      <header className="border-b bg-white/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="container mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-[#004ba8] rounded-lg flex items-center justify-center">
              <span className="text-white font-bold">E</span>
            </div>
            <span className="text-xl font-semibold text-gray-900">EnFlow</span>
          </div>
          <nav className="hidden md:flex items-center gap-8">
            <a href="#features" className="text-gray-600 hover:text-[#004ba8] transition-colors">
              Tính năng
            </a>
            <a href="#about" className="text-gray-600 hover:text-[#004ba8] transition-colors">
              Về chúng tôi
            </a>
            <Link href="/login">
              <Button variant="outline" className="border-[#004ba8] text-[#004ba8] hover:bg-[#004ba8] hover:text-white">
                Đăng nhập
              </Button>
            </Link>
          </nav>
        </div>
      </header>

      {/* Hero Section */}
      <section className="container mx-auto px-6 py-20 md:py-32">
        <div className="max-w-4xl mx-auto text-center">
          <h1 className="text-5xl md:text-6xl font-bold text-gray-900 mb-6">
            Quản lý công việc{' '}
            <span className="text-[#004ba8]">hiệu quả</span>
          </h1>
          <p className="text-xl text-gray-600 mb-8 leading-relaxed">
            EnFlow giúp team của bạn tổ chức, theo dõi và hoàn thành công việc nhanh chóng hơn.
            Giao diện đơn giản, mạnh mẽ và dễ sử dụng.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link href="/login">
              <Button className="bg-[#004ba8] hover:bg-[#003d8a] text-white px-8 py-6 text-lg">
                Bắt đầu ngay
              </Button>
            </Link>
            <Button variant="outline" className="px-8 py-6 text-lg">
              Xem demo
            </Button>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="bg-white py-20">
        <div className="container mx-auto px-6">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold text-gray-900 mb-4">
              Tính năng nổi bật
            </h2>
            <p className="text-lg text-gray-600">
              Mọi thứ bạn cần để quản lý dự án hiệu quả
            </p>
          </div>
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8">
            {features.map((feature, index) => (
              <div
                key={index}
                className="p-6 rounded-xl border border-gray-200 hover:border-[#004ba8] hover:shadow-lg transition-all"
              >
                <div className="w-12 h-12 bg-[#004ba8]/10 rounded-lg flex items-center justify-center mb-4">
                  <feature.icon className="w-6 h-6 text-[#004ba8]" />
                </div>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">
                  {feature.title}
                </h3>
                <p className="text-gray-600">
                  {feature.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 bg-gradient-to-r from-[#004ba8] to-[#0066cc]">
        <div className="container mx-auto px-6 text-center">
          <h2 className="text-4xl font-bold text-white mb-6">
            Sẵn sàng tăng năng suất làm việc?
          </h2>
          <p className="text-xl text-blue-100 mb-8">
            Tham gia cùng hàng ngàn team đang sử dụng EnFlow
          </p>
          <Link href="/login">
            <Button className="bg-white text-[#004ba8] hover:bg-gray-100 px-8 py-6 text-lg">
              Dùng thử miễn phí
            </Button>
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-gray-900 text-gray-400 py-12">
        <div className="container mx-auto px-6 text-center">
          <div className="flex items-center justify-center gap-2 mb-4">
            <div className="w-6 h-6 bg-[#004ba8] rounded flex items-center justify-center">
              <span className="text-white text-sm font-bold">E</span>
            </div>
            <span className="text-white font-semibold">EnFlow</span>
          </div>
          <p>© 2026 EnFlow. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
}
