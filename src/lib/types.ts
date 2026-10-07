export interface User {
  _id: string;
  name: string;
  email: string;
  mobile: string;
  role: "buyer" | "creator" | "admin";
  isVerified: boolean;
  createdAt: string;
  payoutMethod?: "paypal" | "upi" | null;
  paypalEmail?: string | null;
  upiId?: string | null;
  paymentIds?: string[];
}

export interface Software {
  _id: string;
  title: string;
  description: string;
  creator: Pick<User, "_id" | "name" | "email" | "mobile"> | string;
  images: string[];
  video: string;
  liveDemoUrl?: string;
  pdfDocument?: string;
  projectArchiveAvailable: boolean;
  githubUsername: string;
  gitRepository: string;
  languages: string[];
  price: number;
  status: "pending" | "approved" | "rejected";
  totalSales: number;
  totalRevenue: number;
  platformType: string;
  createdAt: string;
  updatedAt?: string;
}

export interface Order {
  _id: string;
  buyer: User | string;
  creator: User | string;
  software: { title: string; price: number } | string;
  amount: number;
  platformFee: number;
  creatorEarning: number;
  status: "created" | "paid" | "failed";
  creatorPayoutStatus: "pending" | "paid";
  creatorPayoutReference: string | null;
  creatorPayoutAt: string | null;
  createdAt: string;
}

export interface DashboardStats {
  totalUsers: number;
  totalCreators: number;
  totalBuyers: number;
  totalSoftware: number;
  totalOrders: number;
  totalRevenue: number;
  platformEarnings: number;
}

export interface ContactSubmission {
  _id: string;
  name: string;
  phone: string;
  email: string;
  subject: string;
  query: string;
  status: "new" | "in-progress" | "resolved";
  createdAt: string;
}
