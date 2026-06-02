export interface Profile {
  id: string;
  role: 'buyer' | 'seller';
  business_name: string;
  description: string;
  logo_url: string;
  contact_email: string;
  address: string;
  created_at: string;
  updated_at: string;
}

export interface Product {
  id: string;
  profile_id: string;
  name: string;
  description: string;
  price: number;
  stock: number;
  image_url: string;
  created_at: string;
  profiles?: Profile; // When joined
}

export interface SellerAd {
  id: string;
  profile_id: string;
  title: string;
  description: string;
  product_ids: string[];
  image_url: string;
  is_active: boolean;
  created_at: string;
  profiles?: Profile;   // When joined
  products?: Product[];  // Resolved from product_ids
}

export interface Order {
  id: string;
  buyer_id: string;
  product_id: string;
  seller_id: string;
  quantity: number;
  unit_price: number;
  total_price: number;
  status: 'pending' | 'confirmed' | 'shipped' | 'delivered' | 'cancelled';
  note: string | null;
  delivery_date: string | null;
  created_at: string;
  updated_at: string;
  products?: Product;
  profiles?: Profile;
}

export interface CartItem {
  id: string;
  buyer_id: string;
  product_id: string;
  quantity: number;
  added_at: string;
  products?: Product & { profiles?: Profile };
}
