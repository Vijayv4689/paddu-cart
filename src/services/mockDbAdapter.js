// src/services/mockDbAdapter.js
// A lightweight mock of the original WebSocket‑backed dbAdapter.
// It stores data in localStorage so the static build can persist state across page reloads.

// Keys used in localStorage
const MENU_KEY = 'paddu_menu';
const ORDERS_KEY = 'paddu_orders';
const SETTINGS_KEY = 'paddu_settings';
const CONNECTION_KEY = 'paddu_connection';
const FEEDBACK_KEY = 'paddu_feedback';

// Helper to safely parse JSON from localStorage
function getStored(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch (e) {
    console.error('[mockDbAdapter] Failed to parse', key, e);
    return fallback;
  }
}

function setStored(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (e) {
    console.error('[mockDbAdapter] Failed to store', key, e);
  }
}

// Initial seed – if nothing stored yet, fall back to empty structures.
if (!localStorage.getItem(MENU_KEY)) setStored(MENU_KEY, []);
if (!localStorage.getItem(ORDERS_KEY)) setStored(ORDERS_KEY, []);
if (!localStorage.getItem(SETTINGS_KEY))
  setStored(SETTINGS_KEY, { upiId: 'BHARATPE2M0L0E1O2Y57508@unitype', payeeName: 'G J SIDDARTH', merchantCategoryCode: '5812', whatsappNumber: '+919880243924', preparationTime: '15' });
if (!localStorage.getItem(CONNECTION_KEY)) setStored(CONNECTION_KEY, true);
if (!localStorage.getItem(FEEDBACK_KEY)) setStored(FEEDBACK_KEY, []);

// One-time migration: force-upgrade returning customers whose browsers cached the OLD
// personal UPI ID (which triggered the "payment declined for security reasons" prompt
// when paying from a Bank Account). Bump the version to roll out future fixes.
const SETTINGS_VERSION_KEY = 'paddu_settings_version';
const CURRENT_SETTINGS_VERSION = '2';
if (localStorage.getItem(SETTINGS_VERSION_KEY) !== CURRENT_SETTINGS_VERSION) {
  const existing = getStored(SETTINGS_KEY, {}) || {};
  setStored(SETTINGS_KEY, {
    ...existing,
    upiId: 'BHARATPE2M0L0E1O2Y57508@unitype',
    payeeName: 'G J SIDDARTH',
    merchantCategoryCode: '5812',
    whatsappNumber: '+919880243924'
  });
  localStorage.setItem(SETTINGS_VERSION_KEY, CURRENT_SETTINGS_VERSION);
}

// Subscription pools – simple Set of callbacks
const menuSubs = new Set();
const ordersSubs = new Set();
const singleOrderSubs = new Map(); // orderId -> Set(callback)
const settingsSubs = new Set();
const connectionSubs = new Set();

function notify(set, data) {
  set.forEach(cb => {
    try { cb(data); } catch (e) { console.error('[mockDbAdapter] subscriber error', e); }
  });
}

function notifySingleOrder(orderId, order) {
  const set = singleOrderSubs.get(orderId);
  if (set) {
    set.forEach(cb => {
      try { cb(order); } catch (e) { console.error('[mockDbAdapter] single order subscriber error', e); }
    });
  }
}

export const mockDbService = {
  // ---------- Connection ----------
  isConnected: () => getStored(CONNECTION_KEY, true),
  subscribeConnection: cb => {
    connectionSubs.add(cb);
    cb(true);
    return () => connectionSubs.delete(cb);
  },

  // ---------- Menu ----------
  subscribeMenu: cb => {
    menuSubs.add(cb);
    cb(getStored(MENU_KEY, []));
    return () => menuSubs.delete(cb);
  },
  // Update a single menu item (used by admin UI)
  updateMenuItem: async item => {
    const menu = getStored(MENU_KEY, []);
    const idx = menu.findIndex(i => i.id === item.id);
    if (idx >= 0) menu[idx] = { ...menu[idx], ...item };
    else menu.push(item);
    setStored(MENU_KEY, menu);
    notify(menuSubs, menu);
    return true;
  },
  deleteMenuItem: async id => {
    let menu = getStored(MENU_KEY, []);
    menu = menu.filter(i => i.id !== id);
    setStored(MENU_KEY, menu);
    notify(menuSubs, menu);
    return true;
  },

  // ---------- Orders ----------
  subscribeToOrders: cb => {
    ordersSubs.add(cb);
    cb(getStored(ORDERS_KEY, []));
    return () => ordersSubs.delete(cb);
  },
  subscribeToOrder: (orderId, cb) => {
    if (!singleOrderSubs.has(orderId)) singleOrderSubs.set(orderId, new Set());
    const set = singleOrderSubs.get(orderId);
    set.add(cb);
    const orders = getStored(ORDERS_KEY, []);
    const order = orders.find(o => o.id === orderId);
    if (order) cb(order);
    return () => {
      set.delete(cb);
      if (set.size === 0) singleOrderSubs.delete(orderId);
    };
  },
  createOrder: async orderData => {
    const orders = getStored(ORDERS_KEY, []);
    const newOrder = {
      id: 'order_' + Date.now(),
      orderNumber: 'PD' + Math.floor(1000 + Math.random() * 9000),
      timestamp: new Date().toISOString(),
      status: 'pending',
      ...orderData,
    };
    orders.push(newOrder);
    setStored(ORDERS_KEY, orders);
    notify(ordersSubs, orders);
    // also notify any single‑order listeners
    notifySingleOrder(newOrder.id, newOrder);
    return newOrder;
  },
  updateOrderStatus: async (orderId, status) => {
    const orders = getStored(ORDERS_KEY, []);
    const order = orders.find(o => o.id === orderId);
    if (order) {
      order.status = status;
      setStored(ORDERS_KEY, orders);
      notify(ordersSubs, orders);
      notifySingleOrder(orderId, order);
    }
    return true;
  },

  // ---------- Settings ----------
  subscribeSettings: cb => {
    settingsSubs.add(cb);
    cb(getStored(SETTINGS_KEY, {}));
    return () => settingsSubs.delete(cb);
  },
  saveSettings: async newSettings => {
    const current = getStored(SETTINGS_KEY, {});
    const merged = { ...current, ...newSettings };
    setStored(SETTINGS_KEY, merged);
    notify(settingsSubs, merged);
    return true;
  },

  // ---------- Feedback ----------
  submitFeedback: async feedbackData => {
    const feedbacks = getStored(FEEDBACK_KEY, []);
    const fb = {
      id: 'f_' + Date.now(),
      timestamp: new Date().toISOString(),
      ...feedbackData
    };
    feedbacks.push(fb);
    setStored(FEEDBACK_KEY, feedbacks);
    
    // Mark order as feedback-submitted in local orders storage
    if (feedbackData.orderId) {
      const orders = getStored(ORDERS_KEY, []);
      const oi = orders.findIndex((o) => o.id === feedbackData.orderId);
      if (oi > -1) {
        orders[oi].feedbackSubmitted = true;
        setStored(ORDERS_KEY, orders);
        notify(ordersSubs, orders);
        notifySingleOrder(feedbackData.orderId, orders[oi]);
      }
    }
    
    console.log('[mockDbAdapter] feedback received & stored', fb);
    return fb;
  },
  getFeedback: async () => {
    return getStored(FEEDBACK_KEY, []);
  }
};


