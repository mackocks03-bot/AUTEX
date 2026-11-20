export type Purchase = {
  status: "completed" | "pending" | "failed";
  paidAt?: number;
  amount?: number;
  orderId?: string;
  reference?: string;
  botId?: string;
};

export type UserPayment = {
  botId?: string;
  amount: number;
  currency: string;
  status: string;
  createdAt: number;
  updatedAt?: number;
  orderId?: string;
  reference?: string;
  selcomTransid?: string;
  palmpesaTransid?: string;
};

export type SupportTicket = {
  uid: string;
  email: string;
  subject: string;
  message: string;
  status: "open" | "closed";
  createdAt: number;
};

export type AppNotification = {
  id?: string;
  title: string;
  message: string;
  imageUrl?: string;
  createdAt: number;
  type?: "deposit_approved" | "deposit_rejected" | "commission" | "withdrawal_approved" | "withdrawal_rejected" | "broadcast" | string;
  read?: boolean;
  meta?: Record<string, string | number | boolean | null>;
};
