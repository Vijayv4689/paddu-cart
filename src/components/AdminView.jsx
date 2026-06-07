import React, { useState, useEffect } from 'react';
import { useOrder } from '../context/OrderContext';
import { mockDbService as dbService } from '../services/mockDbAdapter';
import { QRCodeSVG } from 'qrcode.react';
import { Plus, Trash2, Edit2, Settings, ListFilter, Printer, LogOut, CheckCircle, Clock, Star, MessageSquare, X } from 'lucide-react';

export const AdminView = () => {
  const {
    menu,
    orders,
    updateOrderStatus,
    updateMenuItem,
    deleteMenuItem,
    settings,
    updateSettings
  } = useOrder();

  const [isAuthenticated, setIsAuthenticated] = useState(
    () => sessionStorage.getItem('paddu_admin_auth') === 'true'
  );
  const [password, setPassword] = useState('');
  const [activeTab, setActiveTab] = useState('orders'); // 'orders' | 'menu' | 'qrs' | 'settings' | 'feedback'
  
  // Menu Item Editor Modal state
  const [showItemModal, setShowItemModal] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [itemName, setItemName] = useState('');
  const [itemPrice, setItemPrice] = useState('');
  const [itemCategory, setItemCategory] = useState('Plain');
  const [itemDesc, setItemDesc] = useState('');
  const [itemAvailable, setItemAvailable] = useState(true);
  const [itemImage, setItemImage] = useState('');

  // Settings form state
  const [settingsUpi, setSettingsUpi] = useState(settings.upiId);
  const [settingsWhatsapp, setSettingsWhatsapp] = useState(settings.whatsappNumber);
  const [settingsPrepTime, setSettingsPrepTime] = useState(settings.preparationTime);
  const [settingsBaseUrl, setSettingsBaseUrl] = useState(settings.baseUrl || '');

  // QR printing state
  const [selectedPrintTable, setSelectedPrintTable] = useState(null);

  // Feedback list state
  const [feedbacks, setFeedbacks] = useState([]);

  // Sync settings inputs when global state loads
  useEffect(() => {
    setSettingsUpi(settings.upiId);
    setSettingsWhatsapp(settings.whatsappNumber);
    setSettingsPrepTime(settings.preparationTime);
    setSettingsBaseUrl(settings.baseUrl || '');
  }, [settings]);

  // Load feedback list in Admin View
  useEffect(() => {
    if (activeTab === 'feedback' && isAuthenticated) {
      const fetchFeedback = async () => {
        const data = await dbService.getFeedback();
        setFeedbacks(data.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp)));
      };
      fetchFeedback();
    }
  }, [activeTab, isAuthenticated]);

  const handleLogin = (e) => {
    e.preventDefault();
    if (password === 'admin123' || password === 'admin') {
      setIsAuthenticated(true);
      sessionStorage.setItem('paddu_admin_auth', 'true');
    } else {
      alert('Incorrect credentials! Use password: admin');
    }
  };

  const handleLogout = () => {
    setIsAuthenticated(false);
    sessionStorage.removeItem('paddu_admin_auth');
  };

  // Menu Modal Actions
  const handleOpenAddModal = () => {
    setEditingItem(null);
    setItemName('');
    setItemPrice('');
    setItemCategory('Plain');
    setItemDesc('');
    setItemAvailable(true);
    setItemImage('');
    setShowItemModal(true);
  };

  const handleOpenEditModal = (item) => {
    setEditingItem(item);
    setItemName(item.name);
    setItemPrice(item.price);
    setItemCategory(item.category);
    setItemDesc(item.description);
    setItemAvailable(item.available);
    setItemImage(item.image || '');
    setShowItemModal(true);
  };

  const handleSaveMenuItem = async (e) => {
    e.preventDefault();
    if (!itemName || !itemPrice) {
      alert('Please fill name and price!');
      return;
    }
    const itemData = {
      name: itemName,
      price: Number(itemPrice),
      category: itemCategory,
      description: itemDesc,
      available: itemAvailable,
      image: itemImage
    };
    if (editingItem) {
      itemData.id = editingItem.id;
    }
    const success = await updateMenuItem(itemData);
    if (success) {
      setShowItemModal(false);
    }
  };

  const handleImageChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      if (file.size > 1.5 * 1024 * 1024) {
        alert('Image is too large! Please upload a file smaller than 1.5MB.');
        return;
      }
      const reader = new FileReader();
      reader.onloadend = () => {
        setItemImage(reader.result);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleDeleteItem = async (itemId) => {
    if (confirm('Are you sure you want to delete this menu item?')) {
      await deleteMenuItem(itemId);
    }
  };

  const handleToggleAvailability = async (item) => {
    await updateMenuItem({
      ...item,
      available: !item.available
    });
  };

  // Settings Save
  const handleSaveSettings = async (e) => {
    e.preventDefault();
    const success = await updateSettings({
      upiId: settingsUpi,
      whatsappNumber: settingsWhatsapp,
      preparationTime: settingsPrepTime,
      baseUrl: settingsBaseUrl,
      // Preserve the merchant identity fields so the UPI deep-link stays P2M compliant
      // (matching payee name + MCC = no "declined for security reasons" prompt).
      payeeName: settings.payeeName || 'G J SIDDARTH',
      merchantCategoryCode: settings.merchantCategoryCode || '5812'
    });
    if (success) {
      alert('Settings updated successfully!');
    }
  };

  // Add auto-reset for print target
  useEffect(() => {
    const handleAfterPrint = () => setSelectedPrintTable(null);
    window.addEventListener('afterprint', handleAfterPrint);
    return () => window.removeEventListener('afterprint', handleAfterPrint);
  }, []);

  // Table QR print generator
  const triggerPrintQR = (tableNum) => {
    setSelectedPrintTable(tableNum);
    setTimeout(() => {
      window.print();
    }, 100);
  };

  // Filter orders by status columns
  const pendingOrders = orders.filter(o => o.status === 'Pending').sort((a,b) => new Date(a.timestamp) - new Date(b.timestamp));
  const preparingOrders = orders.filter(o => o.status === 'Preparing').sort((a,b) => new Date(a.timestamp) - new Date(b.timestamp));
  const readyDeliveredOrders = orders.filter(o => o.status === 'Ready' || o.status === 'Delivered').sort((a,b) => new Date(b.timestamp) - new Date(a.timestamp));

  // Average feedback score
  const avgRating = feedbacks.length > 0 
    ? (feedbacks.reduce((sum, f) => sum + f.rating, 0) / feedbacks.length).toFixed(1) 
    : '0.0';

  if (!isAuthenticated) {
    return (
      <main className="main-content">
        <div className="admin-login-card">
          <h3>🔐 Admin Login</h3>
          <form onSubmit={handleLogin}>
            <div className="form-group">
              <label htmlFor="admin-pass">Access Password</label>
              <input
                id="admin-pass"
                type="password"
                className="form-input"
                placeholder="Enter password (default: admin)"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
                required
              />
            </div>
            <button type="submit" className="admin-login-btn">
              Login to Dashboard
            </button>
          </form>
        </div>
      </main>
    );
  }

  // Define QR target URL pointing to table ordering site
  const getTableQrUrl = (tableNum) => {
    const base = settings.baseUrl || (typeof window !== 'undefined' ? window.location.origin : 'http://localhost:5173');
    return tableNum ? `${base}?table=${tableNum}` : base;
  };

  return (
    <main className="admin-portal">
      {/* Admin Navbar */}
      <nav className="admin-navbar">
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <h2 style={{ fontSize: '22px' }}>👨‍🍳 Paddu Point Admin</h2>
        </div>
        <div className="admin-nav-tabs">
          <button 
            className={`admin-tab-btn ${activeTab === 'orders' ? 'active' : ''}`}
            onClick={() => setActiveTab('orders')}
          >
            Orders ({pendingOrders.length + preparingOrders.length})
          </button>
          <button 
            className={`admin-tab-btn ${activeTab === 'menu' ? 'active' : ''}`}
            onClick={() => setActiveTab('menu')}
          >
            Edit Menu
          </button>
          <button 
            className={`admin-tab-btn ${activeTab === 'qrs' ? 'active' : ''}`}
            onClick={() => setActiveTab('qrs')}
          >
            Cart QR Stand
          </button>
          <button 
            className={`admin-tab-btn ${activeTab === 'feedback' ? 'active' : ''}`}
            onClick={() => setActiveTab('feedback')}
          >
            Reviews
          </button>
          <button 
            className={`admin-tab-btn ${activeTab === 'settings' ? 'active' : ''}`}
            onClick={() => setActiveTab('settings')}
          >
            <Settings size={16} />
          </button>
          <button className="icon-btn" onClick={handleLogout} title="Logout">
            <LogOut size={16} />
          </button>
        </div>
      </nav>

      {/* VIEW: LIVE ORDERS BOARD */}
      {activeTab === 'orders' && (
        <section className="orders-board">
          {/* Column 1: Pending Orders */}
          <div className="order-column">
            <div className="column-header">
              <h4>🕒 Pending Orders</h4>
              <span className="column-count">{pendingOrders.length}</span>
            </div>
            {pendingOrders.length === 0 ? (
              <div style={{ padding: '20px', color: 'var(--text-muted)', fontSize: '13px', textAlign: 'center' }}>
                No incoming orders
              </div>
            ) : (
              pendingOrders.map(order => (
                <div key={order.id} className="order-card">
                  <div className="order-card-header">
                    <div>
                      <span className="order-card-title">Order #{order.orderNumber}</span>
                      <div className="order-details-meta" style={{ fontSize: '11px' }}>
                        {new Date(order.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </div>
                    </div>
                    <span className={`order-card-type-badge ${order.orderType === 'dine-in' ? 'dine-in' : 'parcel'}`}>
                      {order.orderType === 'dine-in' ? (order.tableNumber ? `Eat Here (${order.tableNumber})` : 'Eat Here') : 'Takeaway'}
                    </span>
                  </div>

                  <div className="order-card-items">
                    {order.items.map(item => (
                      <div key={item.id} className="order-card-item-row">
                        <span>{item.quantity}x {item.name}</span>
                        <span>₹{item.price * item.quantity}</span>
                      </div>
                    ))}
                  </div>

                  <div className="order-card-footer">
                    <span className="order-card-total">₹{order.totalPrice}</span>
                    <button 
                      className="action-sm-btn prepare"
                      onClick={() => updateOrderStatus(order.id, 'Preparing')}
                    >
                      Accept & Cook
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Column 2: Preparing Orders */}
          <div className="order-column">
            <div className="column-header">
              <h4>🔥 Roast on Tawa</h4>
              <span className="column-count">{preparingOrders.length}</span>
            </div>
            {preparingOrders.length === 0 ? (
              <div style={{ padding: '20px', color: 'var(--text-muted)', fontSize: '13px', textAlign: 'center' }}>
                No active cooking
              </div>
            ) : (
              preparingOrders.map(order => (
                <div key={order.id} className="order-card">
                  <div className="order-card-header">
                    <div>
                      <span className="order-card-title">Order #{order.orderNumber}</span>
                      <div className="order-details-meta" style={{ fontSize: '11px', color: 'var(--warning)' }}>
                        Cooking started
                      </div>
                    </div>
                    <span className={`order-card-type-badge ${order.orderType === 'dine-in' ? 'dine-in' : 'parcel'}`}>
                      {order.orderType === 'dine-in' ? (order.tableNumber ? `Eat Here (${order.tableNumber})` : 'Eat Here') : 'Takeaway'}
                    </span>
                  </div>

                  <div className="order-card-items">
                    {order.items.map(item => (
                      <div key={item.id} className="order-card-item-row">
                        <span>{item.quantity}x {item.name}</span>
                      </div>
                    ))}
                  </div>

                  <div className="order-card-footer">
                    <span className="order-card-total">₹{order.totalPrice}</span>
                    <button 
                      className="action-sm-btn ready"
                      onClick={() => updateOrderStatus(order.id, 'Ready')}
                    >
                      Mark Ready
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Column 3: Ready / Delivered Orders */}
          <div className="order-column">
            <div className="column-header">
              <h4>✅ Ready / Delivered</h4>
              <span className="column-count">{readyDeliveredOrders.length}</span>
            </div>
            {readyDeliveredOrders.length === 0 ? (
              <div style={{ padding: '20px', color: 'var(--text-muted)', fontSize: '13px', textAlign: 'center' }}>
                No completed orders
              </div>
            ) : (
              readyDeliveredOrders.map(order => (
                <div key={order.id} className="order-card" style={{ opacity: order.status === 'Delivered' ? 0.7 : 1 }}>
                  <div className="order-card-header">
                    <div>
                      <span className="order-card-title">Order #{order.orderNumber}</span>
                      <span style={{ 
                        fontSize: '11px', 
                        marginLeft: '8px',
                        padding: '2px 6px',
                        borderRadius: '4px',
                        fontWeight: 700,
                        backgroundColor: order.status === 'Ready' ? 'var(--success-light)' : 'var(--border-color)',
                        color: order.status === 'Ready' ? 'var(--success)' : 'var(--text-color)'
                      }}>
                        {order.status}
                      </span>
                    </div>
                    <span className={`order-card-type-badge ${order.orderType === 'dine-in' ? 'dine-in' : 'parcel'}`}>
                      {order.orderType === 'dine-in' ? (order.tableNumber ? `Eat Here (${order.tableNumber})` : 'Eat Here') : 'Takeaway'}
                    </span>
                  </div>

                  <div className="order-card-items">
                    {order.items.map(item => (
                      <div key={item.id} className="order-card-item-row">
                        <span>{item.quantity}x {item.name}</span>
                      </div>
                    ))}
                  </div>

                  <div className="order-card-footer">
                    <span className="order-card-total">₹{order.totalPrice}</span>
                    {order.status === 'Ready' ? (
                      <button 
                        className="action-sm-btn deliver"
                        onClick={() => updateOrderStatus(order.id, 'Delivered')}
                      >
                        Serve / Deliver
                      </button>
                    ) : (
                      <span style={{ fontSize: '12px', color: 'var(--text-muted)', fontWeight: 600 }}>
                        Closed
                      </span>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </section>
      )}

      {/* VIEW: MENU MANAGEMENT */}
      {activeTab === 'menu' && (
        <section>
          <div className="menu-manager-header">
            <h3>📖 Menu Varieties</h3>
            <button className="btn-primary" onClick={handleOpenAddModal}>
              <Plus size={16} /> Add New Paddu
            </button>
          </div>

          <div className="menu-manager-list">
            {menu.map(item => (
              <div key={item.id} className="menu-manager-item">
                <div className="menu-manager-item-info">
                  {item.image ? (
                    <img src={item.image} alt={item.name} className="menu-manager-item-img" />
                  ) : (
                    <div className="menu-manager-item-img-fallback">
                      🥞
                    </div>
                  )}
                  <div>
                    <span className="menu-manager-item-name">{item.name}</span>
                    <div className="menu-manager-item-price">
                      ₹{item.price} • <span style={{ color: 'var(--primary)', fontWeight: 600 }}>{item.category}</span>
                    </div>
                  </div>
                </div>

                <div className="menu-manager-item-actions">
                  <span style={{ fontSize: '13px', fontWeight: 600 }}>
                    {item.available ? 'Available' : 'Sold Out'}
                  </span>
                  
                  {/* Availability Toggle Slider */}
                  <label className="switch">
                    <input
                      type="checkbox"
                      checked={item.available}
                      onChange={() => handleToggleAvailability(item)}
                    />
                    <span className="slider"></span>
                  </label>

                  <button className="btn-icon-action edit" onClick={() => handleOpenEditModal(item)} title="Edit">
                    <Edit2 size={16} />
                  </button>
                  <button className="btn-icon-action delete" onClick={() => handleDeleteItem(item.id)} title="Delete">
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
            ))}
          </div>

          {/* Add/Edit Modal */}
          {showItemModal && (
            <div className="modal-backdrop">
              <div className="modal-content" style={{ textAlign: 'left', maxWidth: '450px' }}>
                <button className="modal-close" onClick={() => setShowItemModal(false)}>
                  <X size={18} />
                </button>
                
                <h3 style={{ marginBottom: '16px' }}>
                  {editingItem ? '✏️ Edit Menu Item' : '🥞 Add New Paddu'}
                </h3>

                <form onSubmit={handleSaveMenuItem}>
                  <div className="form-group">
                    <label>Paddu Name*</label>
                    <input
                      type="text"
                      className="form-input"
                      value={itemName}
                      onChange={(e) => setItemName(e.target.value)}
                      placeholder="e.g. Masala Paddu"
                      required
                    />
                  </div>

                  <div className="form-group">
                    <label>Price (₹)*</label>
                    <input
                      type="number"
                      className="form-input"
                      value={itemPrice}
                      onChange={(e) => setItemPrice(e.target.value)}
                      placeholder="e.g. 50"
                      required
                    />
                  </div>

                  <div className="form-group">
                    <label>Category</label>
                    <select
                      className="table-select-input"
                      value={itemCategory}
                      onChange={(e) => setItemCategory(e.target.value)}
                    >
                      <option value="Plain">Plain</option>
                      <option value="Masala">Masala</option>
                      <option value="Cheese">Cheese</option>
                      <option value="Onion">Onion</option>
                      <option value="Corn">Corn</option>
                      <option value="Sweet">Sweet</option>
                    </select>
                  </div>

                  <div className="form-group">
                    <label>Short Description</label>
                    <textarea
                      className="feedback-textarea"
                      style={{ height: '60px' }}
                      value={itemDesc}
                      onChange={(e) => setItemDesc(e.target.value)}
                      placeholder="e.g. Stuffed with crunchy onion and cheese..."
                    />
                  </div>

                  <div className="form-group">
                    <label>Paddu Image (JPEG/PNG)</label>
                    <input
                      type="file"
                      accept="image/*"
                      className="form-input"
                      onChange={handleImageChange}
                      style={{ padding: '8px' }}
                    />
                    {itemImage && (
                      <div style={{ marginTop: '10px', display: 'flex', gap: '10px', alignItems: 'center' }}>
                        <img 
                          src={itemImage} 
                          alt="Preview" 
                          style={{ width: '60px', height: '60px', borderRadius: '8px', objectFit: 'cover', border: '1px solid var(--border-color)' }} 
                        />
                        <button 
                          type="button" 
                          className="action-sm-btn prepare" 
                          onClick={() => setItemImage('')}
                          style={{ borderColor: 'red', color: 'red', background: 'none' }}
                        >
                          Remove Preview
                        </button>
                      </div>
                    )}
                  </div>

                  <div className="form-group" style={{ flexDirection: 'row', alignItems: 'center', gap: '10px' }}>
                    <label>Mark Available Immediately</label>
                    <label className="switch">
                      <input
                        type="checkbox"
                        checked={itemAvailable}
                        onChange={(e) => setItemAvailable(e.target.checked)}
                      />
                      <span className="slider"></span>
                    </label>
                  </div>

                  <button type="submit" className="place-order-btn mt-4">
                    Save Paddu Item
                  </button>
                </form>
              </div>
            </div>
          )}
        </section>
      )}

      {/* VIEW: CART STAND QR GENERATOR */}
      {activeTab === 'qrs' && (
        <section className="qr-generator-section" style={{ maxWidth: '600px', margin: '0 auto' }}>
          <div style={{ textAlign: 'center', marginBottom: '20px' }}>
            <h3>🖨️ Cart QR Stand Generator</h3>
            <p className="order-details-meta">Print this banner and place it on your street food cart stand. Customers scan it to open the menu and place orders.</p>
          </div>

          <div className="qr-card" style={{ padding: '24px', maxWidth: '350px', margin: '0 auto', gap: '16px' }}>
            <span className="qr-card-title" style={{ fontSize: '18px' }}>Paddu Point Order QR</span>
            <div style={{ backgroundColor: 'white', padding: '16px', borderRadius: '12px', border: '1px solid var(--border-color)', boxShadow: 'var(--shadow-sm)' }}>
              <QRCodeSVG value={getTableQrUrl('')} size={180} level="H" />
            </div>
            <div style={{ fontSize: '12px', color: 'var(--text-muted)', wordBreak: 'break-all' }}>
              {getTableQrUrl('')}
            </div>

            {getTableQrUrl('').includes('localhost') && (
              <div style={{
                padding: '12px',
                backgroundColor: 'var(--warning-light)',
                border: '1px solid var(--warning)',
                borderRadius: '8px',
                fontSize: '12px',
                color: 'var(--text-color)',
                textAlign: 'left',
                lineHeight: '1.4'
              }}>
                <b>⚠️ Localhost Warning:</b> This QR code points to <code>localhost</code>. It works on this computer, but scanning it with your mobile phone will <b>not</b> open the website.
                <br /><br />
                <b>How to test on your phone:</b>
                <ol style={{ marginLeft: '16px', marginTop: '6px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <li>Connect your phone and computer to the <b>same Wi-Fi</b>.</li>
                  <li>Find your computer's Wi-Fi IP address (e.g., <code>192.168.1.15</code>).</li>
                  <li>Go to the <b>⚙️ Settings</b> tab in this dashboard, and change the <b>App Base URL</b> to <code>http://YOUR_IP:5173</code> (e.g. <code>http://192.168.1.15:5173</code>) and save.</li>
                </ol>
              </div>
            )}

            <button 
              className="place-order-btn" 
              onClick={() => triggerPrintQR('CART')}
              style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px' }}
            >
              <Printer size={18} /> Print Cart QR Stand
            </button>
          </div>

          {/* Secret QR Target for Printing Integration */}
          {selectedPrintTable && (
            <div className="print-qr-target" style={{ padding: '40px', border: '2px solid var(--border-color)', borderRadius: '16px' }}>
              <div style={{ fontSize: '50px', marginBottom: '10px' }}>🍘</div>
              <h2 style={{ fontFamily: 'var(--font-primary)', fontSize: '36px', color: 'var(--primary)' }}>PADDU POINT</h2>
              <p style={{ fontWeight: '700', fontSize: '18px', color: 'var(--text-color)', marginTop: '8px' }}>Scan to View Menu & Order Hot Paddus!</p>
              
              <div style={{ margin: '40px 0', display: 'inline-block', background: 'white', padding: '20px', borderRadius: '16px', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}>
                <QRCodeSVG value={getTableQrUrl('')} size={280} level="H" />
              </div>

              <p style={{ fontWeight: '800', fontSize: '20px', color: 'var(--primary)' }}>📲 No App Download Needed</p>
              <p style={{ color: 'var(--text-muted)', fontSize: '15px', marginTop: '8px' }}>Browse Paddu Varieties • Select Quantity • Pay with UPI</p>
              <div style={{ marginTop: '20px', fontSize: '12px', color: 'var(--text-muted)', borderTop: '1px dashed var(--border-color)', paddingTop: '15px' }}>
                We will call out your Token Number or Name when your order is cooked fresh!
              </div>
            </div>
          )}
        </section>
      )}

      {/* VIEW: REVIEWS & FEEDBACK */}
      {activeTab === 'feedback' && (
        <section>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <h3>⭐ Customer Reviews</h3>
            <div style={{ background: 'var(--secondary-light)', padding: '6px 14px', borderRadius: '20px', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Star size={16} fill="var(--secondary)" color="var(--secondary)" />
              <span style={{ fontWeight: 800, color: 'var(--text-color)' }}>{avgRating} Avg Rating</span>
            </div>
          </div>

          {feedbacks.length === 0 ? (
            <div className="empty-state">
              <span className="empty-state-icon">⭐</span>
              <p>No customer reviews received yet.</p>
            </div>
          ) : (
            <div className="feedback-list">
              {feedbacks.map(fb => (
                <div key={fb.id} className="feedback-card">
                  <div className="feedback-card-header">
                    <span style={{ fontWeight: 700, fontSize: '14px' }}>Order #{fb.orderNumber}</span>
                    <div className="feedback-card-stars">
                      {Array.from({ length: 5 }).map((_, i) => (
                        <Star 
                          key={i} 
                          size={14} 
                          fill={i < fb.rating ? 'var(--secondary)' : 'none'} 
                          color={i < fb.rating ? 'var(--secondary)' : 'var(--border-color)'} 
                        />
                      ))}
                    </div>
                  </div>
                  <p className="feedback-card-comment">"{fb.comment || 'Only rating, no comment.'}"</p>
                  <div className="feedback-card-time" style={{ textAlign: 'right', marginTop: '6px' }}>
                    {new Date(fb.timestamp).toLocaleDateString()} {new Date(fb.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      )}

      {/* VIEW: SETTINGS */}
      {activeTab === 'settings' && (
        <section>
          <h3 style={{ marginBottom: '16px' }}>⚙️ Food Cart Configuration</h3>
          <div className="order-settings-card" style={{ background: 'var(--card-bg)' }}>
            <form onSubmit={handleSaveSettings}>
              <div className="form-group">
                <label>Merchant UPI ID (for receiving payments)</label>
                <input
                  type="text"
                  className="form-input"
                  value={settingsUpi}
                  onChange={(e) => setSettingsUpi(e.target.value)}
                  placeholder="e.g. yourname@okaxis"
                  required
                />
                <span className="order-details-meta" style={{ fontSize: '11px' }}>
                  Customer payments will go directly into the bank account linked to this UPI address.
                </span>
              </div>

              <div className="form-group">
                <label>WhatsApp Alert Mobile Number</label>
                <input
                  type="text"
                  className="form-input"
                  value={settingsWhatsapp}
                  onChange={(e) => setSettingsWhatsapp(e.target.value)}
                  placeholder="e.g. +919876543210"
                  required
                />
                <span className="order-details-meta" style={{ fontSize: '11px' }}>
                  Mobile number (with country code) that will open in the customer's WhatsApp for sending receipt notifications.
                </span>
              </div>

              <div className="form-group">
                <label>Average Prep Time for Takeaway (minutes)</label>
                <input
                  type="number"
                  className="form-input"
                  value={settingsPrepTime}
                  onChange={(e) => setSettingsPrepTime(e.target.value)}
                  placeholder="e.g. 15"
                  required
                />
                <span className="order-details-meta" style={{ fontSize: '11px' }}>
                  Shown to takeaway customers on checkout.
                </span>
              </div>

              <div className="form-group">
                <label>App Base URL (for QR stand generation)</label>
                <input
                  type="text"
                  className="form-input"
                  value={settingsBaseUrl}
                  onChange={(e) => setSettingsBaseUrl(e.target.value)}
                  placeholder="e.g. http://192.168.1.15:5173"
                  required
                />
                <span className="order-details-meta" style={{ fontSize: '11px' }}>
                  <b>Crucial for mobile testing!</b> Set this to your computer's local Wi-Fi IP address (e.g., `http://192.168.x.x:5173`) so scanned phone cameras can reach your computer. In production, change it to your actual domain name.
                </span>
              </div>

              <button type="submit" className="place-order-btn mt-4">
                Update Settings
              </button>
            </form>
          </div>
        </section>
      )}
    </main>
  );
};


