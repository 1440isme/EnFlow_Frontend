import DashboardLayout from '@/views/DashboardLayout';
import RequireAuth from '@/components/auth/RequireAuth';

export default function AppSectionLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <RequireAuth>
      <DashboardLayout>{children}</DashboardLayout>
    </RequireAuth>
  );
}
