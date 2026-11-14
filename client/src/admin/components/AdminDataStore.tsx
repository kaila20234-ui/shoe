import { createContext, useCallback, useContext, useEffect, useMemo, useState, type Dispatch, type ReactNode, type SetStateAction } from 'react';
import { api } from '../../shared/api/client';
import type { AuditLog, DeliveryZone, Discount, Order, Product, ReturnRequest, Review, User } from '../../shared/types';

export type CustomerRow = { id: string; name: string; email: string; status: 'active' | 'blocked'; totalSpent: number };

type AdminDataStoreValue = {
  products: Product[];
  setProducts: Dispatch<SetStateAction<Product[]>>;
  orders: Order[];
  setOrders: Dispatch<SetStateAction<Order[]>>;
  customers: CustomerRow[];
  setCustomers: Dispatch<SetStateAction<CustomerRow[]>>;
  discounts: Discount[];
  setDiscounts: Dispatch<SetStateAction<Discount[]>>;
  deliveryZones: DeliveryZone[];
  setDeliveryZones: Dispatch<SetStateAction<DeliveryZone[]>>;
  reviews: Review[];
  setReviews: Dispatch<SetStateAction<Review[]>>;
  returns: ReturnRequest[];
  setReturns: Dispatch<SetStateAction<ReturnRequest[]>>;
  auditLogs: AuditLog[];
  setAuditLogs: Dispatch<SetStateAction<AuditLog[]>>;
  isLoading: boolean;
  loadError: string | null;
  refreshAdminData: () => Promise<void>;
};

const AdminDataStoreContext = createContext<AdminDataStoreValue | null>(null);

export function AdminDataStoreProvider({ children }: { children: ReactNode }) {
  const [products, setProducts] = useState<Product[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [customers, setCustomers] = useState<CustomerRow[]>([]);
  const [discounts, setDiscounts] = useState<Discount[]>([]);
  const [deliveryZones, setDeliveryZones] = useState<DeliveryZone[]>([]);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [returns, setReturns] = useState<ReturnRequest[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const refreshAdminData = useCallback(async () => {
    setIsLoading(true);
    setLoadError(null);
    try {
      const [productResponse, orderResponse, customerResponse, discountResponse, zoneResponse, reviewResponse, returnResponse, auditResponse] = await Promise.all([
        api.get<Product[]>('/admin/products', { params: { page: 1, limit: 100 } }),
        api.get<Order[]>('/admin/orders', { params: { page: 1, limit: 100 } }),
        api.get<User[]>('/admin/customers', { params: { page: 1, limit: 100 } }),
        api.get<Discount[]>('/admin/discounts'),
        api.get<DeliveryZone[]>('/admin/delivery-zones'),
        api.get<Review[]>('/admin/reviews', { params: { page: 1, limit: 100 } }),
        api.get<ReturnRequest[]>('/admin/returns', { params: { page: 1, limit: 100 } }),
        api.get<AuditLog[]>('/audit-logs', { params: { page: 1, limit: 100 } }),
      ]);
      const spentByCustomer = new Map<string, number>();
      for (const order of orderResponse.data) {
        if (order.customerId && order.paymentStatus === 'paid') {
          spentByCustomer.set(order.customerId, (spentByCustomer.get(order.customerId) ?? 0) + order.total);
        }
      }
      setProducts(productResponse.data);
      setOrders(orderResponse.data);
      setCustomers(customerResponse.data.map((user) => ({
        id: user.id,
        name: user.name,
        email: user.email,
        status: user.isActive ? 'active' : 'blocked',
        totalSpent: spentByCustomer.get(user.id) ?? 0,
      })));
      setDiscounts(discountResponse.data);
      setDeliveryZones(zoneResponse.data);
      setReviews(reviewResponse.data);
      setReturns(returnResponse.data);
      setAuditLogs(auditResponse.data);
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : 'Unable to load admin data.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => { void refreshAdminData(); }, [refreshAdminData]);

  const value = useMemo(() => ({
      products, setProducts, orders, setOrders, customers, setCustomers, discounts, setDiscounts,
      deliveryZones, setDeliveryZones, reviews, setReviews, returns, setReturns, auditLogs, setAuditLogs,
      isLoading, loadError, refreshAdminData,
    }), [products, orders, customers, discounts, deliveryZones, reviews, returns, auditLogs, isLoading, loadError, refreshAdminData]);

  return (
    <AdminDataStoreContext.Provider value={value}>
      {children}
    </AdminDataStoreContext.Provider>
  );
}

export function useAdminDataStore() {
  const store = useContext(AdminDataStoreContext);
  if (!store) throw new Error('Admin pages must be rendered inside AdminDataStoreProvider');
  return store;
}
