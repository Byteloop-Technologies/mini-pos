import React, { useState, useEffect, useCallback, useMemo } from 'react';
import Header from './components/layout/Header';
import PosTab from './components/pos/PosTab';
import ProductsTab from './components/products/ProductsTab';
import SalesTab from './components/sales/SalesTab';
import InventoryTab from './components/inventory/InventoryTab';
import CustomersTab from './components/customers/CustomersTab';
import DashboardTab from './components/dashboard/DashboardTab';
import SettingsTab from './components/settings/SettingsTab';
import { api } from './api';

export default function App() {
  const [activeTab, setActiveTab] = useState('pos');
  const [products, setProducts] = useState([]);
  const [sales, setSales] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [stats, setStats] = useState({
    todaySalesCount: 0,
    todayTotal: 0,
    totalProducts: 0,
    lowStockCount: 0,
    todayGrossProfit: 0,
    totalInventoryRetail: 0,
    totalInventoryCost: 0,
    totalCustomers: 0,
  });

  const loadProducts = useCallback(async () => {
    try {
      const data = await api.products.getAll();
      setProducts(data || []);
    } catch (err) {
      console.error('Failed to load products:', err);
    }
  }, []);

  const loadSales = useCallback(async () => {
    try {
      const data = await api.sales.getAll();
      setSales(data || []);
    } catch (err) {
      console.error('Failed to load sales:', err);
    }
  }, []);

  const loadCustomers = useCallback(async () => {
    try {
      const data = await api.customers.getAll();
      setCustomers(data || []);
    } catch (err) {
      console.error('Failed to load customers:', err);
    }
  }, []);

  const loadStats = useCallback(async () => {
    try {
      const data = await api.sales.getStats();
      if (data) setStats(data);
    } catch (err) {
      console.error('Failed to load stats:', err);
    }
  }, []);

  const refreshAll = useCallback(() => {
    loadProducts();
    loadSales();
    loadCustomers();
    loadStats();
  }, [loadProducts, loadSales, loadCustomers, loadStats]);

  useEffect(() => {
    refreshAll();
  }, [refreshAll]);

  const lowStockProducts = useMemo(() => {
    return products.filter((p) => p.stock <= (p.min_stock || 5));
  }, [products]);

  const handleQuickRestock = async (product) => {
    try {
      await api.products.adjustStock({
        productId: product.id,
        quantity: 20,
        type: 'in',
        reference: 'Quick Restock',
        notes: 'Restocked 20 units from dashboard alert',
      });
      refreshAll();
    } catch (err) {
      alert(`Restock failed: ${err.message}`);
    }
  };

  return (
    <div className="app">
      <Header
        activeTab={activeTab}
        onSelectTab={setActiveTab}
        stats={stats}
      />

      <main className="main">
        {/* POS Tab */}
        <section
          className={`tab-panel ${activeTab === 'pos' ? 'active' : ''}`}
          id="pos-panel"
          role="tabpanel"
        >
          <PosTab
            products={products}
            customers={customers}
            onRefreshProducts={refreshAll}
            onSaleCompleted={refreshAll}
          />
        </section>

        {/* Products Tab */}
        <section
          className={`tab-panel ${activeTab === 'products' ? 'active' : ''}`}
          id="products-panel"
          role="tabpanel"
        >
          <ProductsTab
            products={products}
            onRefresh={refreshAll}
          />
        </section>

        {/* Sales Tab */}
        <section
          className={`tab-panel ${activeTab === 'sales' ? 'active' : ''}`}
          id="sales-panel"
          role="tabpanel"
        >
          <SalesTab
            sales={sales}
            onRefresh={refreshAll}
          />
        </section>

        {/* Inventory Tab */}
        <section
          className={`tab-panel ${activeTab === 'inventory' ? 'active' : ''}`}
          id="inventory-panel"
          role="tabpanel"
        >
          <InventoryTab
            products={products}
            onRefresh={refreshAll}
          />
        </section>

        {/* Customers Tab */}
        <section
          className={`tab-panel ${activeTab === 'customers' ? 'active' : ''}`}
          id="customers-panel"
          role="tabpanel"
        >
          <CustomersTab
            customers={customers}
            onRefresh={refreshAll}
          />
        </section>

        {/* Dashboard Tab */}
        <section
          className={`tab-panel ${activeTab === 'dashboard' ? 'active' : ''}`}
          id="dashboard-panel"
          role="tabpanel"
        >
          <DashboardTab
            stats={stats}
            lowStockProducts={lowStockProducts}
            onQuickRestock={handleQuickRestock}
          />
        </section>

        {/* Settings Tab */}
        <section
          className={`tab-panel ${activeTab === 'settings' ? 'active' : ''}`}
          id="settings-panel"
          role="tabpanel"
        >
          <SettingsTab
            products={products}
            sales={sales}
          />
        </section>
      </main>
    </div>
  );
}
