'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { User, Lock, LogOut } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Separator } from '@/components/ui/separator';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useUserProfile } from '@/hooks/useUserProfile';
import { clearUserProfile, saveUserProfile } from '@/lib/user-profile';
import { clearAccessToken } from '@/lib/auth-token';

export default function AccountPage() {
  const router = useRouter();
  const { profile, refresh } = useUserProfile();
  const [fullName, setFullName] = useState(profile.fullName);
  const [email, setEmail] = useState(profile.email);
  const [infoSaved, setInfoSaved] = useState(false);

  useEffect(() => {
    setFullName(profile.fullName);
    setEmail(profile.email);
  }, [profile.fullName, profile.email]);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordMessage, setPasswordMessage] = useState<string | null>(null);

  const handleSaveProfile = (e: React.FormEvent) => {
    e.preventDefault();
    setInfoSaved(false);
    saveUserProfile({ fullName: fullName.trim(), email: email.trim() });
    refresh();
    setInfoSaved(true);
  };

  const handleChangePassword = (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordMessage(null);
    if (newPassword !== confirmPassword) {
      setPasswordMessage('Mật khẩu mới và xác nhận không khớp.');
      return;
    }
    if (newPassword.length < 8) {
      setPasswordMessage('Mật khẩu mới nên có ít nhất 8 ký tự.');
      return;
    }
    setPasswordMessage(
      'Chức năng đổi mật khẩu sẽ gọi API backend khi bạn có endpoint (ví dụ PUT /enflow/auth/password).'
    );
    setCurrentPassword('');
    setNewPassword('');
    setConfirmPassword('');
  };

  const handleLogout = () => {
    clearAccessToken();
    clearUserProfile();
    router.push('/login');
  };

  return (
    <div className="p-6 max-w-3xl mx-auto space-y-6">
      <div>
        <h1 className="text-3xl font-semibold text-gray-900 mb-1">Tài khoản</h1>
        <p className="text-gray-600">Quản lý thông tin cá nhân và bảo mật</p>
      </div>

      <Tabs defaultValue="profile" className="w-full">
        <TabsList className="grid w-full max-w-md grid-cols-2">
          <TabsTrigger value="profile" className="gap-2">
            <User className="w-4 h-4" />
            Hồ sơ
          </TabsTrigger>
          <TabsTrigger value="security" className="gap-2">
            <Lock className="w-4 h-4" />
            Bảo mật
          </TabsTrigger>
        </TabsList>

        <TabsContent value="profile" className="mt-6">
          <Card className="p-6">
            <h2 className="font-semibold text-gray-900 mb-4">Thông tin cá nhân</h2>
            <p className="text-sm text-gray-600 mb-6">
              Dữ liệu lưu trên trình duyệt và đồng bộ từ JWT sau đăng nhập. Khi có API{' '}
              <code className="text-xs bg-gray-100 px-1 rounded">/me</code> có thể tải/ghi
              từ máy chủ.
            </p>
            <form onSubmit={handleSaveProfile} className="space-y-4">
              {infoSaved ? (
                <Alert>
                  <AlertDescription>Đã lưu thông tin.</AlertDescription>
                </Alert>
              ) : null}
              <div className="space-y-2">
                <Label htmlFor="acc-fullName">Họ và tên</Label>
                <Input
                  id="acc-fullName"
                  value={fullName}
                  onChange={(e) => {
                    setFullName(e.target.value);
                    setInfoSaved(false);
                  }}
                  autoComplete="name"
                  className="bg-input-background"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="acc-email">Email</Label>
                <Input
                  id="acc-email"
                  type="email"
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value);
                    setInfoSaved(false);
                  }}
                  autoComplete="email"
                  className="bg-input-background"
                />
              </div>
              <Button type="submit" className="bg-[#004ba8] hover:bg-[#003d8a]">
                Lưu thông tin
              </Button>
            </form>
          </Card>
        </TabsContent>

        <TabsContent value="security" className="mt-6 space-y-6">
          <Card className="p-6">
            <h2 className="font-semibold text-gray-900 mb-2">Đổi mật khẩu</h2>
            <p className="text-sm text-gray-600 mb-6">
              Form sẵn sàng để nối API; hiện chỉ kiểm tra input phía client.
            </p>
            <form onSubmit={handleChangePassword} className="space-y-4">
              {passwordMessage ? (
                <Alert variant={passwordMessage.startsWith('Chức năng') ? 'default' : 'destructive'}>
                  <AlertDescription>{passwordMessage}</AlertDescription>
                </Alert>
              ) : null}
              <div className="space-y-2">
                <Label htmlFor="acc-current-pw">Mật khẩu hiện tại</Label>
                <Input
                  id="acc-current-pw"
                  type="password"
                  autoComplete="current-password"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  className="bg-input-background"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="acc-new-pw">Mật khẩu mới</Label>
                <Input
                  id="acc-new-pw"
                  type="password"
                  autoComplete="new-password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="bg-input-background"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="acc-confirm-pw">Xác nhận mật khẩu mới</Label>
                <Input
                  id="acc-confirm-pw"
                  type="password"
                  autoComplete="new-password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="bg-input-background"
                />
              </div>
              <Button type="submit" variant="secondary">
                Cập nhật mật khẩu
              </Button>
            </form>
          </Card>

          <Card className="p-6 border-red-100">
            <h2 className="font-semibold text-gray-900 mb-2">Phiên đăng nhập</h2>
            <p className="text-sm text-gray-600 mb-4">
              Đăng xuất khỏi thiết bị này. Bạn cần đăng nhập lại để dùng ứng dụng.
            </p>
            <Separator className="mb-4" />
            <Button
              type="button"
              variant="destructive"
              className="gap-2"
              onClick={handleLogout}
            >
              <LogOut className="w-4 h-4" />
              Đăng xuất
            </Button>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
