'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { User, Lock, LogOut, UserX } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Separator } from '@/components/ui/separator';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useUserProfile } from '@/hooks/useUserProfile';
import { saveUserProfile } from '@/lib/user-profile';
import { ApiError } from '@/lib/http';
import { clearAuthSession } from '@/lib/auth-session';
import {
  getCurrentUser,
  updateCurrentUser,
  changePassword,
  deactivateCurrentUser,
} from '@/lib/user-api';

export default function AccountPage() {
  const router = useRouter();
  const { profile, refresh } = useUserProfile();
  const [fullName, setFullName] = useState(profile.fullName);
  const [email, setEmail] = useState(profile.email);
  const [infoSaved, setInfoSaved] = useState(false);
  const [profileError, setProfileError] = useState<string | null>(null);
  const [loadingProfile, setLoadingProfile] = useState(true);
  const [savingProfile, setSavingProfile] = useState(false);

  useEffect(() => {
    setFullName(profile.fullName);
    setEmail(profile.email);
  }, [profile.fullName, profile.email]);

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordMessage, setPasswordMessage] = useState<string | null>(null);
  const [passwordOk, setPasswordOk] = useState(false);
  const [changingPassword, setChangingPassword] = useState(false);
  const [deactivateOpen, setDeactivateOpen] = useState(false);
  const [deactivating, setDeactivating] = useState(false);
  const [deactivateError, setDeactivateError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoadingProfile(true);
      setProfileError(null);
      try {
        const me = await getCurrentUser();
        if (cancelled) return;
        setFullName(me.fullName);
        setEmail(me.email);
        saveUserProfile({ fullName: me.fullName, email: me.email });
        refresh();
      } catch (e) {
        if (cancelled) return;
        if (e instanceof ApiError && e.status === 401) {
          clearAuthSession();
          router.push('/login');
          return;
        }
        setProfileError(
          e instanceof ApiError ? e.message : 'Không tải được hồ sơ từ máy chủ.'
        );
      } finally {
        if (!cancelled) setLoadingProfile(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [router, refresh]);

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setInfoSaved(false);
    setProfileError(null);
    setSavingProfile(true);
    try {
      const updated = await updateCurrentUser({
        fullName: fullName.trim(),
        email: email.trim(),
      });
      saveUserProfile({ fullName: updated.fullName, email: updated.email });
      setFullName(updated.fullName);
      setEmail(updated.email);
      refresh();
      setInfoSaved(true);
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        clearAuthSession();
        router.push('/login');
        return;
      }
      setProfileError(err instanceof ApiError ? err.message : 'Không lưu được hồ sơ.');
    } finally {
      setSavingProfile(false);
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordMessage(null);
    setPasswordOk(false);
    if (newPassword !== confirmPassword) {
      setPasswordMessage('Mật khẩu mới và xác nhận không khớp.');
      return;
    }
    if (newPassword.length < 8) {
      setPasswordMessage('Mật khẩu mới nên có ít nhất 8 ký tự.');
      return;
    }
    if (!currentPassword) {
      setPasswordMessage('Nhập mật khẩu hiện tại.');
      return;
    }
    setChangingPassword(true);
    try {
      await changePassword({
        currentPassword,
        newPassword,
        confirmPassword,
      });
      setPasswordOk(true);
      setPasswordMessage('Đã đổi mật khẩu thành công.');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        clearAuthSession();
        router.push('/login');
        return;
      }
      setPasswordMessage(
        err instanceof ApiError ? err.message : 'Đổi mật khẩu thất bại.'
      );
    } finally {
      setChangingPassword(false);
    }
  };

  const handleLogout = () => {
    clearAuthSession();
    router.push('/login');
  };

  const handleDeactivateAccount = async () => {
    setDeactivateError(null);
    setDeactivating(true);
    try {
      await deactivateCurrentUser();
      clearAuthSession();
      setDeactivateOpen(false);
      router.push('/login');
    } catch (err) {
      setDeactivateError(
        err instanceof ApiError ? err.message : 'Không vô hiệu hóa được tài khoản.'
      );
    } finally {
      setDeactivating(false);
    }
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
              Đồng bộ với API <code className="text-xs bg-gray-100 px-1 rounded">GET/PUT /enflow/users/me</code>.
            </p>
            {loadingProfile ? (
              <p className="text-sm text-gray-500">Đang tải hồ sơ…</p>
            ) : null}
            {profileError && !loadingProfile ? (
              <Alert variant="destructive" className="mb-4">
                <AlertDescription>{profileError}</AlertDescription>
              </Alert>
            ) : null}
            <form onSubmit={(e) => void handleSaveProfile(e)} className="space-y-4">
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
                  disabled={loadingProfile || savingProfile}
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
                  disabled={loadingProfile || savingProfile}
                />
              </div>
              <Button
                type="submit"
                className="bg-[#004ba8] hover:bg-[#003d8a]"
                disabled={loadingProfile || savingProfile}
              >
                {savingProfile ? 'Đang lưu…' : 'Lưu thông tin'}
              </Button>
            </form>
          </Card>
        </TabsContent>

        <TabsContent value="security" className="mt-6 space-y-6">
          <Card className="p-6">
            <h2 className="font-semibold text-gray-900 mb-2">Đổi mật khẩu</h2>
            <p className="text-sm text-gray-600 mb-6">
              Gọi <code className="text-xs bg-gray-100 px-1 rounded">PATCH /enflow/users/me/change-password</code>.
            </p>
            <form onSubmit={(e) => void handleChangePassword(e)} className="space-y-4">
              {passwordMessage ? (
                <Alert variant={passwordOk ? 'default' : 'destructive'}>
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
                  disabled={changingPassword}
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
                  disabled={changingPassword}
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
                  disabled={changingPassword}
                />
              </div>
              <Button type="submit" variant="secondary" disabled={changingPassword}>
                {changingPassword ? 'Đang cập nhật…' : 'Cập nhật mật khẩu'}
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

          <Card className="p-6 border-red-200 bg-red-50/40">
            <h2 className="font-semibold text-red-950 mb-2">Xóa tài khoản</h2>
            <p className="text-sm text-red-900/90 mb-2">
              Vô hiệu hóa tài khoản vĩnh viễn theo API{' '}
              <code className="text-xs bg-white/80 px-1 rounded">PATCH /enflow/users/me/deactivate</code>.
              Bạn sẽ không thể đăng nhập lại bằng tài khoản này.
            </p>
            {deactivateError ? (
              <Alert variant="destructive" className="mb-4">
                <AlertDescription>{deactivateError}</AlertDescription>
              </Alert>
            ) : null}
            <Button
              type="button"
              variant="destructive"
              className="gap-2"
              onClick={() => {
                setDeactivateError(null);
                setDeactivateOpen(true);
              }}
            >
              <UserX className="w-4 h-4" />
              Xóa tài khoản
            </Button>
          </Card>

          <AlertDialog open={deactivateOpen} onOpenChange={setDeactivateOpen}>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Vô hiệu hóa tài khoản?</AlertDialogTitle>
                <AlertDialogDescription>
                  Hành động này không thể hoàn tác. Tài khoản sẽ bị vô hiệu hóa trên máy chủ.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel disabled={deactivating}>Hủy</AlertDialogCancel>
                <AlertDialogAction
                  className="bg-red-600 hover:bg-red-700"
                  onClick={(e) => {
                    e.preventDefault();
                    void handleDeactivateAccount();
                  }}
                  disabled={deactivating}
                >
                  {deactivating ? 'Đang xử lý…' : 'Xác nhận xóa tài khoản'}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </TabsContent>
      </Tabs>
    </div>
  );
}
