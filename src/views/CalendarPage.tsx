import { Card } from '@/components/ui/card';
import { Calendar } from 'lucide-react';

export default function CalendarPage() {
  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-semibold text-gray-900 mb-2">Calendar</h1>
        <p className="text-gray-600">Xem lịch trình và deadline của các task</p>
      </div>

      <Card className="p-12 text-center">
        <div className="max-w-md mx-auto space-y-4">
          <div className="w-16 h-16 bg-[#004ba8]/10 rounded-full flex items-center justify-center mx-auto">
            <Calendar className="w-8 h-8 text-[#004ba8]" />
          </div>
          <h3 className="text-xl font-semibold text-gray-900">Calendar View</h3>
          <p className="text-gray-600">
            Tính năng Calendar đang được phát triển. Bạn sẽ có thể xem timeline và deadline của các task theo dạng lịch.
          </p>
        </div>
      </Card>
    </div>
  );
}
