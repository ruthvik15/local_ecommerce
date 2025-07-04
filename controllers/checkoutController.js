const Cart = require("../models/cart");
const Product = require("../models/product");
const Order = require("../models/order");
const cityCoords = require("../utils/cityCoordinates");
const getDistanceKm = require("../utils/distance");
const razorpay = require("../utils/razorpay");
const crypto = require("crypto");

async function showCheckoutPage(req, res) {
  const cart = await Cart.findOne({ user: req.user._id }).populate("items.product");

  if (!cart || cart.items.length === 0) {
    return res.redirect("/cart");
  }

  const firstLocation = cart.items[0].product.location.toLowerCase();
  const allSameLocation = cart.items.every(
    item => item.product.location.toLowerCase() === firstLocation
  );

  if (!allSameLocation) {
    return res.status(400).send("All items in your cart must be from the same city to proceed to checkout.");
  }

  res.render("checkout", {
    user: req.user,
    cart,
    cartLocation: firstLocation
  });
}

async function processCheckout(req, res) {
  try {
    const { deliveryDate, deliverySlot, latitude, longitude, paymentMethod, address, phone } = req.body;
    const userId = req.user._id;
    const cart = await Cart.findOne({ user: userId }).populate("items.product");
    if (!cart || cart.items.length === 0) {
      return res.status(400).json({ error: "Cart is empty" });
    }

    for (const item of cart.items) {
      const product = item.product;
      const productCoords = cityCoords[product.location.toLowerCase()];
      const distance = getDistanceKm(
        parseFloat(latitude),
        parseFloat(longitude),
        productCoords.lat,
        productCoords.lng
      );

      if (distance > 20) {
        return res.status(400).json({ error: `Product "${product.name}" cannot be delivered (Distance = ${distance.toFixed(1)} km)` });
      }

      if (product.quantity < item.quantity) {
        return res.status(400).json({ error: `Product "${product.name}" is out of stock.` });
      }
    }

    if (paymentMethod === "cod") {
      for (const item of cart.items) {
        const product = item.product;
        await Product.findByIdAndUpdate(product._id, {
          $inc: { quantity: -item.quantity, soldCount: +item.quantity }
        });

        await Order.create({
          product_id: product._id,
          name: product.name,
          user_id: userId,
          quantity: item.quantity,
          total: product.price * item.quantity,
          location: req.user.location,
          deliveryDate,
          deliverySlot,
          lat: parseFloat(latitude),
          lng: parseFloat(longitude),
          status: "confirmed",
          address,
          ph_number: phone
        });
      }

      await Cart.deleteOne({ user: userId });
      return res.json({ success: true, redirect: "/checkout/orders/success" });
    }

    const amount = cart.items.reduce((sum, item) => sum + item.product.price * item.quantity, 0);
    const razorOrder = await razorpay.orders.create({
      amount: amount * 100,
      currency: "INR",
      receipt: `order_rcptid_${Math.random().toString(36).substr(2, 9)}`
    });

    return res.json({
      razorpayOrderId: razorOrder.id,
      amount: razorOrder.amount,
      key: process.env.RAZORPAY_KEY_ID,
      deliveryDate,
      deliverySlot,
      latitude,
      longitude
    });
  } catch (err) {
    console.error("Checkout error:", err);
    res.status(500).json({ error: "Something went wrong during checkout" });
  }
}

async function verifyPayment(req, res) {
  try {
    const {
      razorpay_payment_id,
      razorpay_order_id,
      razorpay_signature,
      deliveryDate,
      deliverySlot,
      latitude,
      longitude,
      address,
      phone
    } = req.body;

    const body = razorpay_order_id + "|" + razorpay_payment_id;
    const expectedSignature = crypto
      .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
      .update(body)
      .digest("hex");

    if (expectedSignature !== razorpay_signature) {
      return res.status(400).json({ success: false, message: "Invalid payment signature" });
    }

    const userId = req.user._id;
    const cart = await Cart.findOne({ user: userId }).populate("items.product");

    for (const item of cart.items) {
      const product = item.product;

      await Product.findByIdAndUpdate(product._id, {
        $inc: { quantity: -item.quantity, soldCount: +item.quantity }
      });

      await Order.create({
        product_id: product._id,
        name: product.name,
        user_id: userId,
        quantity: item.quantity,
        total: product.price * item.quantity,
        location: req.user.location,
        deliveryDate,
        deliverySlot,
        lat: parseFloat(latitude),
        lng: parseFloat(longitude),
        status: "confirmed",
        paid: true,
        razorpay_payment_id,
        address,
        ph_number: phone
      });
    }

    await Cart.deleteOne({ user: userId });
    return res.json({ success: true, redirect: "/checkout/orders/success" });
  } catch (err) {
    console.error("Payment verification failed:", err);
    res.status(500).json({ success: false, message: "Payment verification failed" });
  }
}

function showSuccessPage(req, res) {
  res.render("order-success", { user: req.user });
}

module.exports = {
  showCheckoutPage,
  processCheckout,
  verifyPayment,
  showSuccessPage
};
