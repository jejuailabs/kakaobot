import { DemoAdminProvider } from "@/features/admin/admin-context";
import { demoAdmin } from "@/lib/shared/demo-admin";

export default function DemoAdminLayout({ children }: LayoutProps<"/[locale]/demo/admin">) {
  return <DemoAdminProvider initial={demoAdmin()}>{children}</DemoAdminProvider>;
}
