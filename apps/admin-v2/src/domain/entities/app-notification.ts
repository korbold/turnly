export interface AppNotification {
  id: string;
  type: string;
  title: string;
  body: string;
  actionType: string | null;
  actionId: string | null;
  tenantId: string | null;
  tenantName: string | null;
  icon: string | null;
  readAt: Date | null;
  createdAt: Date;
}
