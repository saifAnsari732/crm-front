import axios from 'axios';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5001/api';
const RAZORPAY_KEY_ID =
  process.env.REACT_APP_RAZORPAY_KEY_ID ||
  process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID ||
  'rzp_live_TNdSmDOKSX2g6I';

// 📜 Load Razorpay Checkout SDK Script
export const loadRazorpaySDK = () => {
  return new Promise((resolve) => {
    if (window.Razorpay) {
      resolve(true);
      return;
    }
    const script = document.createElement('script');
    script.src = 'https://checkout.razorpay.com/v1/checkout.js';
    script.async = true;
    script.onload = () => resolve(true);
    script.onerror = () => resolve(false);
    document.body.appendChild(script);
  });
};

// 💳 Initiate Razorpay Checkout with Live Keys & Coupon Support
export const initiateRazorpayCheckout = async ({
  plan = 'pro',
  billingCycle = 'monthly',
  seats = 10,
  employeeSeats = 0,
  managerSeats = 0,
  addonType = 'none',
  organizationId = '',
  userName = '',
  userEmail = '',
  userPhone = '',
  companyName = 'TrackPro SaaS',
  couponCode = '',
  onSuccess = () => {},
  onFailure = () => {},
}) => {
  try {
    // 1. Ensure Razorpay SDK script is loaded
    const resLoaded = await loadRazorpaySDK();
    if (!resLoaded) {
      alert('Failed to load Razorpay Payment Gateway SDK. Please check your internet connection.');
      onFailure({ message: 'SDK load failed' });
      return;
    }

    // 2. Create Order on Backend Server (handles exact 5% OFF on Yearly, Seat Addons and Coupon deductions)
    const token = localStorage.getItem('token');
    const headers = token ? { Authorization: `Bearer ${token}` } : {};

    const response = await axios.post(
      `${API_URL}/payment/create-order`,
      {
        plan,
        billingCycle,
        seats,
        employeeSeats,
        managerSeats,
        addonType,
        organizationId,
        userEmail,
        userName,
        couponCode,
      },
      { headers }
    );

    if (!response.data || !response.data.success) {
      throw new Error(response.data?.message || 'Order creation failed');
    }

    const { orderId, amount, currency, keyId } = response.data;
    const razorpayKey = keyId || RAZORPAY_KEY_ID;

    const isAddon = ['employee_addon', 'manager_addon', 'seat_addon', 'addon'].includes(plan);
    const descriptionText = isAddon
      ? `Staff Top-Up: ${employeeSeats > 0 ? `${employeeSeats} Employee(s)` : ''} ${managerSeats > 0 ? `${managerSeats} Manager(s)` : ''} (${companyName})`
      : `${plan.toUpperCase()} Plan Subscription (${billingCycle.toUpperCase()} - ${billingCycle === 'yearly' ? '5% OFF' : 'Standard'})`;

    // 3. Configure Razorpay Popup Options
    const options = {
      key: razorpayKey,
      amount: amount,
      currency: currency || 'INR',
      name: companyName || 'TrackPro SaaS Platform',
      description: descriptionText,
      image: '/images/superCompanyLOGO.png',
      order_id: orderId,
      handler: async function (paymentResponse) {
        try {
          // 4. Verify Payment Signature on Backend Server
          const verifyRes = await axios.post(
            `${API_URL}/payment/verify-payment`,
            {
              razorpay_order_id: paymentResponse.razorpay_order_id,
              razorpay_payment_id: paymentResponse.razorpay_payment_id,
              razorpay_signature: paymentResponse.razorpay_signature,
              organizationId,
              plan,
              billingCycle,
              seats,
              employeeSeats,
              managerSeats,
              addonType,
              couponCode,
            },
            { headers }
          );

          if (verifyRes.data && verifyRes.data.success) {
            onSuccess(verifyRes.data);
          } else {
            alert('Payment Signature Verification Failed!');
            onFailure(verifyRes.data);
          }
        } catch (verifyErr) {
          console.error('🔥 Payment Verification Error:', verifyErr);
          alert('Error verifying payment: ' + (verifyErr.response?.data?.message || verifyErr.message));
          onFailure(verifyErr);
        }
      },
      prefill: {
        name: userName || 'Admin',
        email: userEmail || 'admin@company.com',
        contact: userPhone || '+919511450914',
      },
      notes: {
        plan,
        billingCycle,
        companyName,
        couponCode,
      },
      theme: {
        color: '#059669', // Emerald Green brand primary
      },
      modal: {
        ondismiss: function () {
          console.log('Payment checkout popup closed by user');
        },
      },
    };

    const rzp = new window.Razorpay(options);
    rzp.on('payment.failed', function (paymentFailResponse) {
      console.error('Payment Failed:', paymentFailResponse.error);
      alert(`Payment Failed: ${paymentFailResponse.error.description}`);
      onFailure(paymentFailResponse.error);
    });

    rzp.open();
  } catch (err) {
    console.error('🔥 Razorpay Checkout Error:', err);
    alert('Failed to launch Razorpay Checkout: ' + (err.response?.data?.message || err.message));
    onFailure(err);
  }
};
