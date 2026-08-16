export interface OrderItem {
  name: string;
  quantity: number;
  price: number;
}

export interface Order {
  id: string;
  restaurant: {
    name: string;
    address: string;
    phone: string;
    lat: number;
    lng: number;
  };
  customer: {
    name: string;
    address: string;
    phone: string;
    lat: number;
    lng: number;
  };
  items: OrderItem[];
  earnings: number;
  distance: number;
  estimatedPickup: number;
  estimatedDelivery: number;
  otp: string;
  status: 'incoming' | 'accepted' | 'at_restaurant' | 'picked_up' | 'delivering' | 'completed' | 'cancelled';
  createdAt: string;
  completedAt?: string;
  tip: number;
}

export interface DeliveryHistory extends Order {
  rating?: number;
  completedAt: string;
}

const RESTAURANTS = [
  { name: "McDonald's Opéra", address: "25 Bd des Capucines, 75002 Paris", phone: "01 40 07 49 00", lat: 48.8702, lng: 2.3323 },
  { name: "Sushi Shop Bastille", address: "12 Rue de la Roquette, 75011 Paris", phone: "01 43 57 21 00", lat: 48.8534, lng: 2.3732 },
  { name: "Burger King République", address: "42 Pl. de la République, 75010 Paris", phone: "01 42 08 99 00", lat: 48.8675, lng: 2.3634 },
  { name: "Pizza Hut Nation", address: "5 Av. du Trône, 75011 Paris", phone: "01 43 73 55 00", lat: 48.8484, lng: 2.3944 },
  { name: "KFC Châtelet", address: "8 Rue des Halles, 75001 Paris", phone: "01 40 39 04 00", lat: 48.8603, lng: 2.3473 },
  { name: "Noodle House Marais", address: "18 Rue du Temple, 75004 Paris", phone: "01 42 77 11 00", lat: 48.8563, lng: 2.3518 },
  { name: "Le Grec Oberkampf", address: "67 Rue Oberkampf, 75011 Paris", phone: "01 43 38 22 00", lat: 48.8629, lng: 2.3767 },
];

const CUSTOMERS = [
  { name: "Lucas Martin", address: "18 Rue Lepic, 75018 Paris", phone: "06 12 34 56 78", lat: 48.8848, lng: 2.3358 },
  { name: "Sophie Dubois", address: "34 Av. Parmentier, 75011 Paris", phone: "06 23 45 67 89", lat: 48.8614, lng: 2.3773 },
  { name: "Thomas Bernard", address: "7 Rue du Faubourg du Temple, 75010 Paris", phone: "06 34 56 78 90", lat: 48.8669, lng: 2.3637 },
  { name: "Emma Rousseau", address: "52 Rue de Belleville, 75020 Paris", phone: "06 45 67 89 01", lat: 48.8706, lng: 2.3860 },
  { name: "Nathan Petit", address: "3 Rue de la Folie Méricourt, 75011 Paris", phone: "06 56 78 90 12", lat: 48.8646, lng: 2.3706 },
  { name: "Chloé Moreau", address: "28 Bd Voltaire, 75011 Paris", phone: "06 67 89 01 23", lat: 48.8568, lng: 2.3802 },
  { name: "Maxime Durand", address: "15 Rue Amelot, 75011 Paris", phone: "06 78 90 12 34", lat: 48.8596, lng: 2.3663 },
];

const ITEMS_POOL = [
  [
    { name: "Big Mac", quantity: 2, price: 5.50 },
    { name: "McFlurry Oreo", quantity: 1, price: 2.90 },
    { name: "Frites Grandes", quantity: 2, price: 2.50 },
  ],
  [
    { name: "California Roll x8", quantity: 1, price: 9.90 },
    { name: "Sashimi Saumon", quantity: 1, price: 12.50 },
    { name: "Miso Soupe", quantity: 2, price: 3.00 },
  ],
  [
    { name: "Whopper", quantity: 1, price: 7.20 },
    { name: "Onion Rings", quantity: 1, price: 3.50 },
    { name: "Milkshake Chocolat", quantity: 1, price: 4.00 },
  ],
  [
    { name: "Pizza Margherita L", quantity: 1, price: 13.90 },
    { name: "Pizza Regina L", quantity: 1, price: 14.90 },
    { name: "Tiramisu", quantity: 2, price: 4.50 },
  ],
  [
    { name: "Zinger Burger", quantity: 2, price: 6.90 },
    { name: "Coleslaw", quantity: 1, price: 2.50 },
    { name: "Pepsi 50cl", quantity: 2, price: 2.00 },
  ],
];

function generateOTP(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).substr(2, 5);
}

export function generateMockOrder(): Order {
  const restaurant = RESTAURANTS[Math.floor(Math.random() * RESTAURANTS.length)];
  const customer = CUSTOMERS[Math.floor(Math.random() * CUSTOMERS.length)];
  const items = ITEMS_POOL[Math.floor(Math.random() * ITEMS_POOL.length)];
  const distance = parseFloat((Math.random() * 4 + 0.8).toFixed(1));
  const subtotal = items.reduce((sum, i) => sum + i.price * i.quantity, 0);
  const tip = parseFloat((Math.random() * 3 + 0.5).toFixed(2));
  const earnings = parseFloat((subtotal * 0.12 + distance * 0.45 + tip).toFixed(2));

  return {
    id: generateId(),
    restaurant,
    customer,
    items,
    earnings,
    distance,
    estimatedPickup: Math.floor(Math.random() * 8 + 3),
    estimatedDelivery: Math.floor(distance * 3 + 5),
    otp: generateOTP(),
    status: 'incoming',
    createdAt: new Date().toISOString(),
    tip,
  };
}

export const MOCK_HISTORY: DeliveryHistory[] = [
  {
    id: 'hist001',
    restaurant: RESTAURANTS[0],
    customer: CUSTOMERS[0],
    items: ITEMS_POOL[0],
    earnings: 8.75,
    distance: 2.3,
    estimatedPickup: 5,
    estimatedDelivery: 12,
    otp: '481923',
    status: 'completed',
    createdAt: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
    completedAt: new Date(Date.now() - 1.5 * 60 * 60 * 1000).toISOString(),
    tip: 2.00,
    rating: 5,
  },
  {
    id: 'hist002',
    restaurant: RESTAURANTS[1],
    customer: CUSTOMERS[1],
    items: ITEMS_POOL[1],
    earnings: 11.20,
    distance: 3.1,
    estimatedPickup: 8,
    estimatedDelivery: 15,
    otp: '729341',
    status: 'completed',
    createdAt: new Date(Date.now() - 4 * 60 * 60 * 1000).toISOString(),
    completedAt: new Date(Date.now() - 3.4 * 60 * 60 * 1000).toISOString(),
    tip: 1.50,
    rating: 4,
  },
  {
    id: 'hist003',
    restaurant: RESTAURANTS[2],
    customer: CUSTOMERS[2],
    items: ITEMS_POOL[2],
    earnings: 9.40,
    distance: 1.9,
    estimatedPickup: 4,
    estimatedDelivery: 10,
    otp: '563018',
    status: 'completed',
    createdAt: new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString(),
    completedAt: new Date(Date.now() - 5.6 * 60 * 60 * 1000).toISOString(),
    tip: 0.50,
    rating: 5,
  },
  {
    id: 'hist004',
    restaurant: RESTAURANTS[3],
    customer: CUSTOMERS[3],
    items: ITEMS_POOL[3],
    earnings: 14.85,
    distance: 4.2,
    estimatedPickup: 10,
    estimatedDelivery: 20,
    otp: '847201',
    status: 'completed',
    createdAt: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
    completedAt: new Date(Date.now() - 23.5 * 60 * 60 * 1000).toISOString(),
    tip: 3.00,
    rating: 5,
  },
  {
    id: 'hist005',
    restaurant: RESTAURANTS[4],
    customer: CUSTOMERS[4],
    items: ITEMS_POOL[4],
    earnings: 7.60,
    distance: 1.5,
    estimatedPickup: 3,
    estimatedDelivery: 8,
    otp: '193847',
    status: 'completed',
    createdAt: new Date(Date.now() - 26 * 60 * 60 * 1000).toISOString(),
    completedAt: new Date(Date.now() - 25.8 * 60 * 60 * 1000).toISOString(),
    tip: 1.00,
    rating: 4,
  },
];
