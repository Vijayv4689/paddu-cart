// ─────────────────────────────────────────────────────────────────────────────
// Paddu Point — WebSocket Database Adapter
// Connects to the real-time sync server so phone + laptop share the same data.
// Falls back gracefully if the server is unreachable.
// ─────────────────────────────────────────────────────────────────────────────

// ── Local state cache (mirrors server state) ─────────────────────────────────
let state = {
  menu: [],
  orders: [],
  feedback: [],
  settings: {
    upiId: 'BHARATPE2M0L0E1O2Y57508@unitype',
    payeeName: 'G J SIDDARTH',
    merchantCategoryCode: '5812',
    whatsappNumber: '+919880243924',
    preparationTime: '15',
    baseUrl: ''
  }
};

// ── Subscriber pools ─────────────────────────────────────────────────────────
const menuSubscribers = new Set();
const orderSubscribers = new Set();
const singleOrderSubscribers = new Map(); // orderId → Set<callback>
const settingsSubscribers = new Set();
const connectionSubscribers = new Set(); // for UI connection indicator

// ── WebSocket connection ─────────────────────────────────────────────────────
let ws = null;
let connected = false;
let reconnectTimer = null;
let requestIdCounter = 0;
const pendingRequests = new Map(); // requestId → { resolve, reject, timeout }

function getWsUrl() {
  const protocol = location.protocol === 'https:' ? 'wss:' : 'ws:';
  return `${protocol}//${location.host}/api/ws`;
}

function connect() {
  if (ws && (ws.readyState === WebSocket.CONNECTING || ws.readyState === WebSocket.OPEN)) {
    return; // Already connected or connecting
  }

  try {
    ws = new WebSocket(getWsUrl());
  } catch (e) {
    console.error('[Paddu Sync] Failed to create WebSocket:', e);
    scheduleReconnect();
    return;
  }

  ws.onopen = () => {
    connected = true;
    console.log('[Paddu Sync] ✅ Connected to sync server');
    notifyConnectionSubscribers();
    // Clear any pending reconnect
    if (reconnectTimer) {
      clearTimeout(reconnectTimer);
      reconnectTimer = null;
    }
  };

  ws.onmessage = (event) => {
    try {
      const msg = JSON.parse(event.data);
      handleServerMessage(msg);
    } catch (e) {
      console.error('[Paddu Sync] Bad message from server:', e);
    }
  };

  ws.onclose = () => {
    connected = false;
    console.log('[Paddu Sync] ❌ Disconnected from sync server');
    notifyConnectionSubscribers();
    scheduleReconnect();
  };

  ws.onerror = (err) => {
    console.error('[Paddu Sync] WebSocket error:', err);
    // onclose will fire after this, which handles reconnection
  };
}

function scheduleReconnect() {
  if (reconnectTimer) return;
  reconnectTimer = setTimeout(() => {
    reconnectTimer = null;
    console.log('[Paddu Sync] 🔄 Reconnecting...');
    connect();
  }, 2000);
}

function notifyConnectionSubscribers() {
  connectionSubscribers.forEach((cb) => cb(connected));
}

// ── Request/Response pattern for operations that return data ──────────────────
function sendRequest(type, payload) {
  return new Promise((resolve, reject) => {
    if (!ws || ws.readyState !== WebSocket.OPEN) {
      reject(new Error('Not connected to sync server'));
      return;
    }

    const reqId = ++requestIdCounter;
    const timeout = setTimeout(() => {
      pendingRequests.delete(reqId);
      reject(new Error('Request timed out'));
    }, 15000);

    pendingRequests.set(reqId, { resolve, reject, timeout });

    ws.send(JSON.stringify({ ...payload, type, requestId: reqId }));
  });
}

// Fire-and-forget send (for mutations where we don't need a specific response)
function sendMessage(type, payload) {
  if (!ws || ws.readyState !== WebSocket.OPEN) {
    console.warn('[Paddu Sync] Cannot send — not connected');
    return false;
  }
  ws.send(JSON.stringify({ ...payload, type }));
  return true;
}

// ── Server message handler ───────────────────────────────────────────────────
function handleServerMessage(msg) {
  // Resolve any pending request with matching requestId
  if (msg.requestId && pendingRequests.has(msg.requestId)) {
    const pending = pendingRequests.get(msg.requestId);
    clearTimeout(pending.timeout);
    pendingRequests.delete(msg.requestId);
    pending.resolve(msg);
    // Don't return — still process the state update below
  }

  switch (msg.type) {
    case 'STATE':
      // Full state snapshot (received on first connect)
      state.menu = msg.data.menu || [];
      state.orders = msg.data.orders || [];
      state.feedback = msg.data.feedback || [];
      state.settings = msg.data.settings || state.settings;
      // Notify ALL subscribers
      menuSubscribers.forEach((cb) => cb(state.menu));
      orderSubscribers.forEach((cb) => cb(state.orders));
      settingsSubscribers.forEach((cb) => cb(state.settings));
      notifySingleOrderSubscribers();
      break;

    case 'MENU_UPDATED':
      state.menu = msg.menu;
      menuSubscribers.forEach((cb) => cb(state.menu));
      break;

    case 'ORDERS_UPDATED':
      state.orders = msg.orders;
      orderSubscribers.forEach((cb) => cb(state.orders));
      notifySingleOrderSubscribers();
      break;

    case 'SETTINGS_UPDATED':
      state.settings = msg.settings;
      settingsSubscribers.forEach((cb) => cb(state.settings));
      break;

    case 'FEEDBACK_UPDATED':
      state.feedback = msg.feedback;
      break;

    case 'ORDER_CREATED':
      // Handled by pendingRequests above
      break;

    case 'FEEDBACK_CREATED':
      // Handled by pendingRequests above
      break;

    default:
      break;
  }
}

function notifySingleOrderSubscribers() {
  singleOrderSubscribers.forEach((callbacks, orderId) => {
    const order = state.orders.find((o) => o.id === orderId);
    if (order) {
      callbacks.forEach((cb) => cb(order));
    }
  });
}

// ── Initialize connection on module load ─────────────────────────────────────
if (typeof window !== 'undefined') {
  connect();
}

// ─────────────────────────────────────────────────────────────────────────────
// PUBLIC API — Same interface as before, now backed by WebSocket
// ─────────────────────────────────────────────────────────────────────────────

export const dbService = {

  // ── Connection status ────────────────────────────────────────────────────
  isConnected: () => connected,

  subscribeConnection: (callback) => {
    connectionSubscribers.add(callback);
    callback(connected); // Immediately report current status
    return () => connectionSubscribers.delete(callback);
  },

  // ── Menu ─────────────────────────────────────────────────────────────────
  getMenu: async () => {
    return state.menu;
  },

  subscribeMenu: (callback) => {
    menuSubscribers.add(callback);
    // Fire immediately with current cached state
    callback(state.menu);
    return () => menuSubscribers.delete(callback);
  },

  updateMenuItem: async (item) => {
    try {
      await sendRequest('UPDATE_MENU_ITEM', { item });
      return true;
    } catch (e) {
      console.error('[Paddu Sync] updateMenuItem failed:', e);
      return false;
    }
  },

  deleteMenuItem: async (itemId) => {
    try {
      sendMessage('DELETE_MENU_ITEM', { itemId });
      return true;
    } catch (e) {
      console.error('[Paddu Sync] deleteMenuItem failed:', e);
      return false;
    }
  },

  // ── Orders ───────────────────────────────────────────────────────────────
  createOrder: async (orderData) => {
    try {
      const response = await sendRequest('CREATE_ORDER', { orderData });
      return response.order; // { id, orderNumber, timestamp, status, ... }
    } catch (e) {
      console.error('[Paddu Sync] createOrder failed:', e);
      return null;
    }
  },

  getOrders: async () => {
    return state.orders;
  },

  subscribeToOrders: (callback) => {
    orderSubscribers.add(callback);
    callback(state.orders);
    return () => orderSubscribers.delete(callback);
  },

  subscribeToOrder: (orderId, callback) => {
    if (!singleOrderSubscribers.has(orderId)) {
      singleOrderSubscribers.set(orderId, new Set());
    }
    singleOrderSubscribers.get(orderId).add(callback);

    // Fire immediately if we already have this order
    const order = state.orders.find((o) => o.id === orderId);
    if (order) callback(order);

    return () => {
      const subs = singleOrderSubscribers.get(orderId);
      if (subs) {
        subs.delete(callback);
        if (subs.size === 0) singleOrderSubscribers.delete(orderId);
      }
    };
  },

  updateOrderStatus: async (orderId, status) => {
    try {
      sendMessage('UPDATE_ORDER_STATUS', { orderId, status });
      return true;
    } catch (e) {
      console.error('[Paddu Sync] updateOrderStatus failed:', e);
      return false;
    }
  },

  // ── Settings ─────────────────────────────────────────────────────────────
  getSettings: async () => {
    return state.settings;
  },

  subscribeSettings: (callback) => {
    settingsSubscribers.add(callback);
    callback(state.settings);
    return () => settingsSubscribers.delete(callback);
  },

  saveSettings: async (settings) => {
    try {
      sendMessage('SAVE_SETTINGS', { settings });
      return true;
    } catch (e) {
      console.error('[Paddu Sync] saveSettings failed:', e);
      return false;
    }
  },

  // ── Feedback ─────────────────────────────────────────────────────────────
  submitFeedback: async (feedbackData) => {
    try {
      const response = await sendRequest('SUBMIT_FEEDBACK', { feedbackData });
      return response.feedback;
    } catch (e) {
      console.error('[Paddu Sync] submitFeedback failed:', e);
      return null;
    }
  },

  getFeedback: async () => {
    return state.feedback;
  }
};

// Legacy export for backward compatibility
export const DB_MODE = 'websocket';


