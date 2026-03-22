import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Mail, Phone } from 'lucide-react';

type TeamMember = {
  id: string;
  name: string;
  email: string;
  phone: string;
  role: string;
  avatar: string;
  status: 'online' | 'away' | 'offline';
};

const teamMembers: TeamMember[] = [];

export default function TeamPage() {
  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-semibold text-gray-900 mb-2">Team</h1>
        <p className="text-gray-600">Quản lý thành viên trong team</p>
      </div>

      {teamMembers.length === 0 ? (
        <Card className="p-12 text-center text-gray-600">
          Chưa có thành viên. Kết nối API để tải team và thống kê task theo thành viên.
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {teamMembers.map((member) => (
            <Card key={member.id} className="p-6 hover:shadow-lg transition-shadow">
              <div className="space-y-4">
                <div className="flex items-start gap-4">
                  <div className="relative">
                    <img
                      src={member.avatar}
                      alt={member.name}
                      className="w-16 h-16 rounded-full"
                    />
                    <div
                      className={`absolute bottom-0 right-0 w-4 h-4 rounded-full border-2 border-white ${
                        member.status === 'online'
                          ? 'bg-green-500'
                          : member.status === 'away'
                            ? 'bg-yellow-500'
                            : 'bg-gray-400'
                      }`}
                    ></div>
                  </div>
                  <div className="flex-1">
                    <h3 className="font-semibold text-gray-900">{member.name}</h3>
                    <p className="text-sm text-gray-600">{member.role}</p>
                    <Badge
                      variant="secondary"
                      className={
                        member.status === 'online'
                          ? 'bg-green-100 text-green-700 mt-2'
                          : member.status === 'away'
                            ? 'bg-yellow-100 text-yellow-700 mt-2'
                            : 'bg-gray-100 text-gray-700 mt-2'
                      }
                    >
                      {member.status === 'online'
                        ? 'Đang online'
                        : member.status === 'away'
                          ? 'Vắng mặt'
                          : 'Offline'}
                    </Badge>
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-sm text-gray-600">
                    <Mail className="w-4 h-4" />
                    <span>{member.email}</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm text-gray-600">
                    <Phone className="w-4 h-4" />
                    <span>{member.phone}</span>
                  </div>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
