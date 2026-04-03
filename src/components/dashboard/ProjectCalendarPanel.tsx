import { Card } from '@/components/ui/card';
import { Calendar } from 'lucide-react';

type Props = {
  scopeLabel?: string;
};

export default function ProjectCalendarPanel({ scopeLabel }: Props) {
  return (
    <Card className="p-12 text-center">
      <div className="max-w-md mx-auto space-y-4">
        <div className="w-16 h-16 bg-[#004ba8]/10 rounded-full flex items-center justify-center mx-auto">
          <Calendar className="w-8 h-8 text-[#004ba8]" />
        </div>
        <h3 className="text-xl font-semibold text-gray-900">Lịch dự án</h3>
        <p className="text-gray-600">
          Xem deadline và timeline task theo dạng lịch. Tính năng đang phát triển; hiện đang
          {scopeLabel ? ` hiển thị theo ${scopeLabel}` : ' hiển thị theo dự án hiện tại'}.
        </p>
      </div>
    </Card>
  );
}
