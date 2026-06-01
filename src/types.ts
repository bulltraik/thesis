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
