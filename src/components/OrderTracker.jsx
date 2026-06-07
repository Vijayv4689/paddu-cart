import React, { useState } from 'react';
import { useOrder } from '../context/OrderContext';
import { QRCodeSVG } from 'qrcode.react';
import { Check, Clock, Utensils, MessageSquare, CreditCard, ChevronRight, X, Star, Copy } from 'lucide-react';

export const OrderTracker = ({ onBackToMenu }) => {
  const { currentOrder, clearCurrentOrder, settings, submitFeedback } = useOrder();
  const [showUpiModal, setShowUpiModal] = useState(false);
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState('');
  const [feedbackSuccess, setFeedbackSuccess] = useState(false);
  const [hasOpenedPayment, setHasOpenedPayment] = useState(false);
  const [isPaymentConfirmed, setIsPaymentConfirmed] = useState(false);
  const [copied, setCopied] = useState(false);

  const handleCopyUpi = () => {
    navigator.clipboard.writeText(settings.upiId);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Custom confetti dots for order success celebration
  const [confettiDots, setConfettiDots] = useState([]);
  React.useEffect(() => {
    const dots = [];
    const colors = ['#ff6600', '#ffb300', '#4caf50', '#2196f3', '#e91e63'];
    for (let i = 0; i < 40; i++) {
      dots.push({
        id: i,
        left: `${Math.random() * 100}%`,
        color: colors[Math.floor(Math.random() * colors.length)],
        delay: `${Math.random() * 1.5}s`,
        drift: `${(Math.random() - 0.5) * 60}px`
      });
    }
    setConfettiDots(dots);
  }, []);

  if (!currentOrder) {
    return (
      <main className="main-content">
        <div className="empty-state">
          <span className="empty-state-icon">🔍</span>
          <h3>No Active Order</h3>
          <p>You don't have any active orders right now.</p>
          <button className="btn-primary mt-4" onClick={onBackToMenu}>
            Browse Menu
          </button>
        </div>
      </main>
    );
  }

  // Determine current active status index
  const statuses = ['Pending', 'Preparing', 'Ready', 'Delivered'];
  const currentStatusIndex = statuses.indexOf(currentOrder.status);

  // Generate UPI payment deep links
  // Use the registered merchant payee name (must match name on UPI handle) — mismatched names
  // are the #1 cause of "payment declined for security reasons" when paying from Bank Account.
  const payName = settings.payeeName || 'Paddu Point';
  const cleanUpiId = settings.upiId.replace(/\s+/g, '');
  // Merchant Category Code: tells the UPI rails this is a P2M (merchant) txn, not P2P.
  // 5812 = Eating Places & Restaurants. Required for BharatPe / merchant UPI IDs.
  const mcc = settings.merchantCategoryCode || '5812';
  // Link for QR Code (includes amount, MCC, and transaction note — fully P2M compliant)
  const upiQrLink = `upi://pay?pa=${cleanUpiId}&pn=${encodeURIComponent(payName)}&am=${currentOrder.totalPrice}&cu=INR&mc=${mcc}&tn=Order${currentOrder.orderNumber}`;
  // Link for direct mobile app launch (uses MCC so bank rails treat it as merchant payment)
  const upiMobileLink = `upi://pay?pa=${cleanUpiId}&pn=${encodeURIComponent(payName)}&cu=INR&mc=${mcc}`;

  // Generate WhatsApp message text
  const getWhatsAppLink = () => {
    const itemsText = currentOrder.items
      .map(item => `• ${item.quantity}x ${item.name} (₹${item.price})`)
      .join('\n');
    
    const typeText = currentOrder.orderType === 'dine-in' 
      ? `Eat Here (Standing${currentOrder.tableNumber ? `, Name: ${currentOrder.tableNumber}` : ''})` 
      : 'Parcel / Takeaway';

    const text = `🍽️ *NEW ORDER - PADDU POINT*\n` +
      `---------------------------------\n` +
      `*Order Number:* #${currentOrder.orderNumber}\n` +
      `*Order Type:* ${typeText}\n` +
      `*Total Price:* ₹${currentOrder.totalPrice}\n\n` +
      `*Items Ordered:*\n${itemsText}\n` +
      `---------------------------------\n` +
      `*Status:* ${currentOrder.status}\n` +
      `Please confirm my order. Thank you!`;

    const cleanPhone = settings.whatsappNumber.replace(/[^0-9+]/g, '');
    return `https://wa.me/${cleanPhone}?text=${encodeURIComponent(text)}`;
  };

  // Generate platform-specific direct launch link for GPay, PhonePe, or Paytm
  const getAppUpiLink = (app) => {
    const isAndroid = /Android/.test(navigator.userAgent);
    const isIOS = /iPhone|iPad|iPod/.test(navigator.userAgent);
    const payName = settings.payeeName || 'Paddu Point';
    const cleanUpiId = settings.upiId.replace(/\s+/g, '');
    const mcc = settings.merchantCategoryCode || '5812';

    // P2M-compliant query: payee name MUST match registered merchant name on the UPI handle,
    // and we include &mc= (Merchant Category Code) so bank rails recognise this as a merchant
    // payment instead of a P2P transfer (which is what triggers the "declined for security
    // reasons" prompt when the user chooses Bank Account as the funding source).
    const query = `pa=${cleanUpiId}&pn=${encodeURIComponent(payName)}&am=${currentOrder.totalPrice}&cu=INR&mc=${mcc}&tn=Order${currentOrder.orderNumber}`;
    
    if (isAndroid) {
      switch (app) {
        case 'gpay':
          return `intent://pay?${query}#Intent;scheme=upi;package=com.google.android.apps.nbu.paisa.user;end`;
        case 'phonepe':
          return `intent://pay?${query}#Intent;scheme=upi;package=com.phonepe.app;end`;
        case 'paytm':
          return `intent://pay?${query}#Intent;scheme=upi;package=net.one97.paytm;end`;
        default:
          return `upi://pay?${query}`;
      }
    } else if (isIOS) {
      switch (app) {
        case 'gpay':
          return `gpay://upi/pay?${query}`;
        case 'phonepe':
          return `phonepe://upi/pay?${query}`;
        case 'paytm':
          return `paytmmp://upi/pay?${query}`;
        default:
          return `upi://pay?${query}`;
      }
    } else {
      return `upi://pay?${query}`;
    }
  };

  const handleFeedbackSubmit = async (e) => {
    e.preventDefault();
    if (rating === 0) {
      alert('Please select a star rating!');
      return;
    }
    const success = await submitFeedback(rating, comment);
    if (success) {
      setFeedbackSuccess(true);
    }
  };

  // Helper to format timestamps
  const getFormattedTime = (status) => {
    const timeField = `time_${status.toLowerCase()}`;
    if (!currentOrder[timeField]) return '';
    const date = new Date(currentOrder[timeField]);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div className="tracker-container" style={{ position: 'relative' }}>
      {/* Confetti Overlay */}
      <div className="confetti-overlay">
        {confettiDots.map(dot => (
          <div
            key={dot.id}
            className="confetti-dot"
            style={{
              left: dot.left,
              backgroundColor: dot.color,
              animationDelay: dot.delay,
              '--drift': dot.drift
            }}
          />
        ))}
      </div>
      {/* Success Banner */}
      <div className="order-success-card">
        <div className="animated-success-icon">
          <Check size={32} />
        </div>
        <h3>Order Placed Successfully!</h3>
        <p className="order-details-meta">Show this order number to the food cart vendor</p>
        <div className="order-number">#{currentOrder.orderNumber}</div>
        <p className="order-details-meta">
          {currentOrder.orderType === 'dine-in' ? (
            <span>📍 Eat Here (Standing) {currentOrder.tableNumber && <span>- <b>{currentOrder.tableNumber}</b></span>}</span>
          ) : (
            <span>🛍️ Parcel - Est. Prep time: <b>{settings.preparationTime} mins</b></span>
          )}
        </p>
      </div>

      {/* Progress Steps Card */}
      <div className="steps-progress">
        <h3 style={{ fontSize: '17px', borderBottom: '1px solid var(--border-color)', paddingBottom: '10px' }}>
          Live Order Status
        </h3>
        
        {statuses.map((status, index) => {
          const isCompleted = index < currentStatusIndex;
          const isActive = index === currentStatusIndex;
          const isPending = index > currentStatusIndex;
          
          let statusText = '';
          switch (status) {
            case 'Pending':
              statusText = 'Order received by Paddu Point';
              break;
            case 'Preparing':
              statusText = 'Paddus are being roasted fresh on the tawa';
              break;
            case 'Ready':
              statusText = currentOrder.orderType === 'dine-in' 
                ? 'Roasting complete! Collect your hot plate from the cart!' 
                : 'Your parcel is packed and ready for pickup!';
              break;
            case 'Delivered':
              statusText = 'Hope you enjoyed the hot paddus!';
              break;
          }

          return (
            <div 
              key={status} 
              className={`progress-step ${isCompleted ? 'completed' : ''} ${isActive ? 'active' : ''}`}
            >
              <div className="step-indicator">
                {isCompleted ? <Check size={18} /> : index + 1}
              </div>
              <div className="step-content">
                <div className="step-title" style={{ color: isActive ? 'var(--primary)' : 'var(--text-color)' }}>
                  {status}
                  {isActive && <span style={{ fontSize: '12px', marginLeft: '8px', color: 'var(--text-muted)' }}>(Current)</span>}
                </div>
                <div className="step-time" style={{ fontSize: '13px' }}>{statusText}</div>
                {(isCompleted || isActive) && currentOrder[`time_${status.toLowerCase()}`] && (
                  <div style={{ fontSize: '11px', color: 'var(--primary)', fontWeight: 500, marginTop: '2px' }}>
                    {getFormattedTime(status)}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Cart Summary Breakdown */}
      <div className="order-success-card" style={{ textAlign: 'left' }}>
        <h4 style={{ fontSize: '15px', marginBottom: '12px', borderBottom: '1px solid var(--border-color)', paddingBottom: '8px' }}>
          Items Bill Summary
        </h4>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {currentOrder.items.map(item => (
            <div key={item.id} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '14px' }}>
              <span>{item.quantity}x {item.name}</span>
              <span style={{ fontWeight: 600 }}>₹{item.price * item.quantity}</span>
            </div>
          ))}
          <div style={{ borderTop: '1px dashed var(--border-color)', paddingTop: '8px', marginTop: '4px', display: 'flex', justifyContent: 'space-between', fontWeight: 800 }}>
            <span>Total Paid/Payable</span>
            <span style={{ color: 'var(--primary)' }}>₹{currentOrder.totalPrice}</span>
          </div>
        </div>
      </div>

      {/* Payment and WhatsApp Action Bar */}
      <div className="payment-section">
        <h3>Pay & Notify</h3>
        <p className="order-details-meta" style={{ marginBottom: '16px' }}>
          Complete the UPI payment first, then verify and send your order details to the vendor's WhatsApp.
        </p>

        <div className="payment-methods" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {/* Step 1 */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <span style={{ fontSize: '13px', fontWeight: '700', color: 'var(--text-color)', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span style={{ background: 'var(--primary)', color: 'white', borderRadius: '50%', width: '20px', height: '20px', display: 'flex', alignItems: 'center', justifySelf: 'center', justifyContent: 'center', fontSize: '11px' }}>1</span>
              Settle Payment via UPI
            </span>
            <button 
              className="payment-btn upi" 
              onClick={() => { setShowUpiModal(true); setHasOpenedPayment(true); }}
              style={{ padding: '12px' }}
            >
              <CreditCard size={18} /> Pay with UPI / Scan QR
            </button>
          </div>

          {/* Step 2 */}
          <div style={{ 
            display: 'flex', 
            flexDirection: 'column', 
            gap: '8px', 
            opacity: hasOpenedPayment ? 1 : 0.5,
            pointerEvents: hasOpenedPayment ? 'auto' : 'none',
            transition: 'all 0.3s ease',
            borderTop: '1px dashed var(--border-color)',
            paddingTop: '12px'
          }}>
            <span style={{ fontSize: '13px', fontWeight: '700', color: 'var(--text-color)', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span style={{ background: hasOpenedPayment ? 'var(--primary)' : 'var(--border-color)', color: 'white', borderRadius: '50%', width: '20px', height: '20px', display: 'flex', alignItems: 'center', justifySelf: 'center', justifyContent: 'center', fontSize: '11px' }}>2</span>
              Confirm Payment & Send to WhatsApp
            </span>
            
            <label style={{ 
              display: 'flex', 
              alignItems: 'center', 
              gap: '10px', 
              fontSize: '13px', 
              cursor: hasOpenedPayment ? 'pointer' : 'default',
              color: 'var(--text-color)',
              background: 'var(--bg-secondary)',
              padding: '10px',
              borderRadius: '8px',
              border: '1px solid var(--border-color)'
            }}>
              <input 
                type="checkbox" 
                checked={isPaymentConfirmed} 
                disabled={!hasOpenedPayment}
                onChange={(e) => setIsPaymentConfirmed(e.target.checked)}
                style={{ width: '18px', height: '18px', cursor: hasOpenedPayment ? 'pointer' : 'default' }}
              />
              <span style={{ fontWeight: 600 }}>I have completed the payment of ₹{currentOrder.totalPrice}</span>
            </label>
            
            <button 
              className="payment-btn whatsapp" 
              disabled={!isPaymentConfirmed}
              onClick={() => window.open(getWhatsAppLink(), '_blank')}
              style={{ 
                opacity: isPaymentConfirmed ? 1 : 0.6,
                cursor: isPaymentConfirmed ? 'pointer' : 'not-allowed',
                padding: '12px'
              }}
            >
              <MessageSquare size={18} /> Send Order to WhatsApp
            </button>
          </div>
        </div>
      </div>

      {/* Customer Feedback Card */}
      {(currentOrder.status === 'Ready' || currentOrder.status === 'Delivered') && (
        <div className="feedback-section">
          <h3>How was your Paddu?</h3>
          <p className="order-details-meta">Help us improve by leaving a rating</p>
          
          {feedbackSuccess ? (
            <div style={{ color: 'var(--success)', fontWeight: 700, marginTop: '16px' }}>
              🌟 Thank you for your feedback! Enjoy your food!
            </div>
          ) : currentOrder.feedbackSubmitted ? (
            <div style={{ color: 'var(--text-muted)', fontWeight: 600, marginTop: '16px' }}>
              Feedback already submitted. Thank you!
            </div>
          ) : (
            <form onSubmit={handleFeedbackSubmit} className="mt-2">
              <div className="rating-stars">
                {[1, 2, 3, 4, 5].map(star => (
                  <button
                    type="button"
                    key={star}
                    className={`star-btn ${rating >= star ? 'active' : ''}`}
                    onClick={() => setRating(star)}
                  >
                    ★
                  </button>
                ))}
              </div>
              <textarea
                className="feedback-textarea"
                placeholder="Write your feedback here (e.g. paddus were very crispy!)..."
                value={comment}
                onChange={(e) => setComment(e.target.value)}
              />
              <button type="submit" className="feedback-submit-btn">
                Submit Review
              </button>
            </form>
          )}
        </div>
      )}

      {/* Back to Menu / Order New Button */}
      <button 
        className="payment-btn cash" 
        style={{ marginTop: '10px', background: 'var(--card-bg)' }}
        onClick={() => {
          if (currentOrder.status === 'Delivered') {
            clearCurrentOrder();
          }
          onBackToMenu();
        }}
      >
        {currentOrder.status === 'Delivered' ? 'Order Something Else' : 'Order More Items'}
      </button>

      {/* UPI QR Payment Modal Pop-up */}
      {showUpiModal && (
        <div className="modal-backdrop">
          <div className="modal-content">
            <button className="modal-close" onClick={() => setShowUpiModal(false)}>
              <X size={18} />
            </button>
            
            <h3 style={{ fontSize: '18px', color: 'var(--text-color)' }}>UPI QR Payment</h3>
            <p className="order-details-meta">Scan or Click to pay directly</p>
            
            {/* Clickable UPI link for mobile, QR for desktop */}
            <div className="upi-qr-wrapper">
              <QRCodeSVG value={upiQrLink} size={200} level="H" />
            </div>

            <div className="upi-meta-info" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
              <div>Amount to Pay: <b style={{ fontSize: '18px', color: 'var(--primary)' }}>₹{currentOrder.totalPrice}</b></div>
              
              <div style={{ 
                display: 'flex', 
                alignItems: 'center', 
                gap: '8px', 
                background: 'var(--bg-secondary)', 
                padding: '8px 12px', 
                borderRadius: '8px', 
                border: '1px solid var(--border-color)', 
                marginTop: '4px',
                width: '100%',
                justifyContent: 'space-between'
              }}>
                <span style={{ fontSize: '12px', wordBreak: 'break-all', color: 'var(--text-color)' }}>
                  UPI ID: <b>{settings.upiId}</b>
                </span>
                <button 
                  onClick={handleCopyUpi} 
                  style={{ 
                    background: 'none', 
                    border: 'none', 
                    color: 'var(--primary)', 
                    cursor: 'pointer', 
                    display: 'flex', 
                    alignItems: 'center',
                    padding: '4px'
                  }}
                  title="Copy UPI ID"
                >
                  {copied ? <Check size={16} color="var(--success)" /> : <Copy size={16} />}
                </button>
              </div>
              {copied && <span style={{ fontSize: '11px', color: 'var(--success)', fontWeight: '700' }}>UPI ID Copied!</span>}
            </div>

            {/* Decline Helper Advice */}
            <div style={{
              margin: '12px 0',
              padding: '10px',
              backgroundColor: 'hsl(35, 100%, 96%)',
              border: '1px solid hsl(35, 100%, 88%)',
              borderRadius: '8px',
              fontSize: '11px',
              color: 'hsl(35, 80%, 25%)',
              textAlign: 'left',
              lineHeight: '1.5'
            }}>
              <b>💡 If payment is declined when choosing &quot;Bank Account&quot;:</b>
              <ol style={{ paddingLeft: '18px', margin: '6px 0 0 0' }}>
                <li>Tap <b>Scan QR</b> above (most reliable — uses merchant rails).</li>
                <li>Or, in your UPI app, choose <b>UPI Lite</b> / <b>Wallet</b> as the payment source instead of Bank Account.</li>
                <li>Or, copy the UPI ID below and pay from <b>Pay to UPI ID</b> option directly.</li>
              </ol>
            </div>

            <div className="upi-app-selector" style={{ marginTop: '16px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <div style={{ fontSize: '13px', fontWeight: '700', color: 'var(--text-color)', marginBottom: '4px', textAlign: 'center' }}>
                Open Payment App on your Phone:
              </div>
              
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                <a
                  href={getAppUpiLink('gpay')}
                  onClick={() => setHasOpenedPayment(true)}
                  style={{ 
                    textDecoration: 'none', 
                    display: 'flex', 
                    alignItems: 'center', 
                    justifyContent: 'center', 
                    background: '#1a73e8', 
                    color: 'white', 
                    padding: '10px', 
                    borderRadius: '8px', 
                    fontWeight: '700',
                    fontSize: '12px',
                    textAlign: 'center'
                  }}
                >
                  Google Pay
                </a>

                <a
                  href={getAppUpiLink('phonepe')}
                  onClick={() => setHasOpenedPayment(true)}
                  style={{ 
                    textDecoration: 'none', 
                    display: 'flex', 
                    alignItems: 'center', 
                    justifyContent: 'center', 
                    background: '#5f259f', 
                    color: 'white', 
                    padding: '10px', 
                    borderRadius: '8px', 
                    fontWeight: '700',
                    fontSize: '12px',
                    textAlign: 'center'
                  }}
                >
                  PhonePe
                </a>

                <a
                  href={getAppUpiLink('paytm')}
                  onClick={() => setHasOpenedPayment(true)}
                  style={{ 
                    textDecoration: 'none', 
                    display: 'flex', 
                    alignItems: 'center', 
                    justifyContent: 'center', 
                    background: '#0099ff', 
                    color: 'white', 
                    padding: '10px', 
                    borderRadius: '8px', 
                    fontWeight: '700',
                    fontSize: '12px',
                    textAlign: 'center'
                  }}
                >
                  Paytm
                </a>

                <a
                  href={getAppUpiLink('other')}
                  onClick={() => setHasOpenedPayment(true)}
                  style={{ 
                    textDecoration: 'none', 
                    display: 'flex', 
                    alignItems: 'center', 
                    justifyContent: 'center', 
                    background: 'var(--bg-secondary)', 
                    color: 'var(--text-color)', 
                    padding: '10px', 
                    borderRadius: '8px', 
                    fontWeight: '700',
                    fontSize: '12px',
                    border: '1px solid var(--border-color)',
                    textAlign: 'center'
                  }}
                >
                  Other App
                </a>
              </div>
              
              <p className="order-details-meta mt-2" style={{ fontSize: '11px', color: 'var(--primary)', fontWeight: '700', textAlign: 'center' }}>
                💡 Note: Google Pay/PhonePe will open with the exact amount (₹{currentOrder.totalPrice}) pre-filled automatically.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

