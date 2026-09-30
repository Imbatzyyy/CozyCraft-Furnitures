// A small, first-party handoff: no React, auth session, analytics or payment API
// is required in the external browser. The app verifies the actual order status.
(() => {
  const params = new URLSearchParams(location.search);
  const launch = new URLSearchParams(location.hash.slice(1));
  const order = params.get('order') || launch.get('order') || '';
  const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  const message = document.getElementById('message');
  const action = document.getElementById('continue');
  const note = document.getElementById('note');
  const heading = document.getElementById('heading');
  const navigate = (target) => {
    action.href = target;
    action.hidden = false;
    // Finish loading the fallback before asking the OS to open another app.
    // Otherwise a blocked custom scheme can leave Safari's document loading.
    const open = () => {
      try { location.replace(target); } catch { /* Keep the explicit tap fallback. */ }
    };
    if (document.readyState === 'complete') open();
    else window.addEventListener('load', open, { once: true });
  };
  if (!uuid.test(order)) {
    message.textContent = 'This payment link is incomplete. Return to CozyCraft and open My Orders to check your order.';
    note.textContent = 'No payment or order has been changed.';
    return;
  }
  const checkout = launch.get('checkout');
  if (checkout) {
    let url;
    try { url = new URL(checkout); } catch { /* Rejected below. */ }
    if (!url || url.protocol !== 'https:' || url.username || url.password || url.port ||
        !['checkout.paymongo.com', 'payments.paymongo.com'].includes(url.hostname)) {
      message.textContent = 'This secure payment link is not valid. Please reopen payment from My Orders.';
      note.textContent = 'No payment or order has been changed.';
      return;
    }
    // Existing sessions can still carry the old website return URL. Remember
    // only this exact order, for one hour, in the same first-party browser.
    // This is a navigation preference, never authorization or proof of payment.
    const key = `cozycraft-native-payment-return:${order}`;
    const value = String(Date.now() + 60 * 60 * 1000);
    for (const storageName of ['sessionStorage', 'localStorage']) {
      try { window[storageName].setItem(key, value); } catch { /* Private browsing may deny storage. */ }
    }
    heading.textContent = 'Your secure checkout.';
    message.textContent = 'Opening PayMongo. Once you finish, Return to merchant will bring you back to the app.';
    action.textContent = 'Continue to secure payment →';
    note.textContent = 'Your original order and payment deadline stay unchanged.';
    // Checkout URLs can contain provider fragments. Keep them out of HTTP logs,
    // referrers and this page's browser history.
    history.replaceState(null, '', location.pathname);
    navigate(url.href);
    return;
  }
  const payment = params.get('payment');
  if (!['success', 'cancelled'].includes(payment)) {
    message.textContent = 'Return to CozyCraft and open My Orders to check your payment.';
    note.textContent = 'No payment or order has been changed.';
    return;
  }
  message.textContent = payment === 'success'
    ? 'Your payment result will be checked securely in the app. Tap below if it does not open automatically.'
    : 'Return to your order in the app. An unfinished payment stays available until its original deadline.';
  navigate(`com.cozycraft.furniture://payment/return?payment=${payment}&order=${encodeURIComponent(order)}`);
})();
