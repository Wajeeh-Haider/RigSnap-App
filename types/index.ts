export interface User {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  phone: string;
  role: 'trucker' | 'provider';
  profileImage?: string;
  rating: number;
  joinDate: string;
  location: string;
  language: string;
  // Trucker specific
  truckType?: string;
  licenseNumber?: string;
  requestRadius?: number; // New field for truckers
  // Provider specific
  services?: string[];
  serviceRadius?: number;
  certifications?: string[];
}

export interface ServiceRequest {
  id: string;
  truckerId: string;
  truckerName: string;
  truckerPhone: string;
  serviceType: 'towing' | 'repair' | 'mechanic' | 'tire_repair' | 'truck_wash' | 'hose_repair';
  description: string;
  location: string;
  coordinates: {
    latitude: number;
    longitude: number;
  };
  status: 'pending' | 'accepted' | 'in_progress' | 'completed' | 'cancelled';
  urgency: 'low' | 'medium' | 'high';
  createdAt: string;
  acceptedAt?: string;
  completedAt?: string;
  cancelledAt?: string;
  providerId?: string;
  providerName?: string;
  leadFeeCharged: boolean;
  estimatedCost?: number;
  actualCost?: number;
  photos?: string[];
  cancellationReason?: string;
  cancelledBy?: 'trucker' | 'provider';
}

export interface Lead {
  id: string;
  requestId: string;
  userId: string;
  userRole: 'trucker' | 'provider';
  amount: number;
  status: 'pending' | 'charged' | 'refunded';
  createdAt: string;
  description: string;
}

export interface ChatMessage {
  id: string;
  requestId: string;
  senderId: string;
  senderName: string;
  senderRole?: 'trucker' | 'provider';
  content: string;
  timestamp: string;
  messageType: 'text' | 'location' | 'image' | 'system';
  isRead: boolean;
}

export interface Chat {
  id: string;
  requestId: string;
  truckerId: string;
  truckerName: string;
  providerId: string;
  providerName: string;
  lastMessage?: string;
  lastMessageTime?: string;
  unreadCount: number;
  isActive: boolean;
}