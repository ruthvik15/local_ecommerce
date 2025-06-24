const{Router}=require("express")
const router=Router();
const path = require("path");
const multer = require("multer");
const User =require("../models/user")
const Product = require("../models/product");
const Rider=require("../models/rider")
const Cart =require("../models/cart");
const cityCoords = require("../utils/cityCoordinates");
const getDistanceKm = require("../utils/distance");
const razorpay = require("../utils/razorpay");

const crypto = require("crypto")
const Order = require("../models/order");

router.get("/", async (req, res) => {
  const cart = await Cart.findOne({ user: req.user._id }).populate("items.product");

  if (!cart || cart.items.length === 0) {
    return res.redirect("/cart");
  }

  // 🧠 Get location of the first item
  const firstLocation = cart.items[0].product.location.toLowerCase();

  // ❌ Check if any item has a different location
  const allSameLocation = cart.items.every(
    item => item.product.location.toLowerCase() === firstLocation
  );

  if (!allSameLocation) {
    return res
      .status(400)
      .send("All items in your cart must be from the same city to proceed to checkout.");
  }

  res.render("checkout", {
    user: req.user,
    cart,
    cartLocation: firstLocation // ✅ For map
  });
});


// router.post("/", async (req, res) => {
//   try {
//     const { deliveryDate, deliverySlot, latitude, longitude } = req.body;
//     const userId = req.user._id;

//     const cart = await Cart.findOne({ user: userId }).populate("items.product");
//     if (!cart || cart.items.length === 0) {
//       return res.status(400).send("Cart is empty");
//     }

//     // ✅ Check distance and stock first
//     for (const item of cart.items) {
//       const product = item.product;

//       // 1. Check delivery distance
//       const productCity = product.location.toLowerCase();
//       const productCoords = cityCoords[productCity];
//       const distance = getDistanceKm(
//         parseFloat(latitude),
//         parseFloat(longitude),
//         productCoords.lat,
//         productCoords.lng
//       );

//       console.log(`User to ${productCity} distance: ${distance.toFixed(2)} km`);
//       if (distance > 20) {
//         return res.status(400).send(
//           `Product "${product.name}" cannot be delivered to your location (Distance = ${distance.toFixed(1)} km)`
//         );
//       }

//       // 2. Check stock
//       if (product.quantity < item.quantity) {
//         return res.status(400).send(
//           `Product "${product.name}" is out of stock or quantity exceeds available stock.`
//         );
//       }
//     }

//     // ✅ Create orders and reduce stock
//     for (const item of cart.items) {
//       const product = item.product;

//       // Reduce stock
//       await Product.findByIdAndUpdate(product._id, {
//         $inc: { quantity: -item.quantity ,
//         soldCount: +item.quantity }
//       });
//       console.log(product.soldCount);
//       // Create order
//       await Order.create({
//         product_id: product._id,
//         name:product.name,
//         user_id: userId,
//         quantity: item.quantity,
//         total: product.price * item.quantity,
//         location: req.user.location,
//         deliveryDate,
//         deliverySlot,
//         lat: parseFloat(latitude),
//         lng: parseFloat(longitude),
//         status: "confirmed"
//       });
//     }

//     // Clear cart
//     await Cart.deleteOne({ user: userId });

//     return res.redirect("/checkout/orders/success");
//   } catch (err) {
//     console.error("Checkout error:", err);
//     res.status(500).send("Something went wrong during checkout");
//   }
// });
// router.post("/", async (req, res) => {
//   try {
//     const { deliveryDate, deliverySlot, latitude, longitude, paymentMethod } = req.body;
//     const userId = req.user._id;

//     const cart = await Cart.findOne({ user: userId }).populate("items.product");
//     if (!cart || cart.items.length === 0) {
//       return res.status(400).send("Cart is empty");
//     }

//     if (paymentMethod === "cod") {
//       // Proceed with COD flow
//       for (const item of cart.items) {
//         const product = item.product;

//         const productCity = product.location.toLowerCase();
//         const productCoords = cityCoords[productCity];
//         const distance = getDistanceKm(
//           parseFloat(latitude),
//           parseFloat(longitude),
//           productCoords.lat,
//           productCoords.lng
//         );

//         if (distance > 20) {
//           return res.status(400).send(`Product "${product.name}" cannot be delivered to your location (Distance = ${distance.toFixed(1)} km)`);
//         }

//         if (product.quantity < item.quantity) {
//           return res.status(400).send(`Product "${product.name}" is out of stock.`);
//         }

//         await Product.findByIdAndUpdate(product._id, {
//           $inc: { quantity: -item.quantity, soldCount: +item.quantity }
//         });

//         await Order.create({
//           product_id: product._id,
//           name: product.name,
//           user_id: userId,
//           quantity: item.quantity,
//           total: product.price * item.quantity,
//           location: req.user.location,
//           deliveryDate,
//           deliverySlot,
//           lat: parseFloat(latitude),
//           lng: parseFloat(longitude),
//           status: "confirmed"
//         });
//       }

//       await Cart.deleteOne({ user: userId });
//       return res.redirect("/checkout/orders/success");
//     } else {
//       // Payment online → return Razorpay order creation
//       const amount = cart.items.reduce((total, item) => total + item.product.price * item.quantity, 0);
//       const razorOrder = await razorpay.orders.create({
//         amount: amount * 100, // in paise
//         currency: "INR",
//         receipt: `order_rcptid_${Math.random().toString(36).substr(2, 9)}`
//       });

//       return res.render("payment", {
//         user: req.user,
//         razorpayOrderId: razorOrder.id,
//         amount: razorOrder.amount,
//         key: process.env.RAZORPAY_KEY_ID,
//         deliveryDate,
//         deliverySlot,
//         latitude,
//         longitude
//       });
//     }
//   } catch (err) {
//     console.error("Checkout error:", err);
//     res.status(500).send("Something went wrong during checkout");
//   }
// });
// router.post("/verify-payment", async (req, res) => {
//   try {
//     const {
//       razorpay_payment_id,
//       razorpay_order_id,
//       razorpay_signature,
//       deliveryDate,
//       deliverySlot,
//       latitude,
//       longitude
//     } = req.body;

//     const body = razorpay_order_id + "|" + razorpay_payment_id;
//     const expectedSignature = crypto
//       .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
//       .update(body)
//       .digest("hex");

//     if (expectedSignature !== razorpay_signature) {
//       return res.status(400).send("Invalid payment signature");
//     }

//     const userId = req.user._id;
//     const cart = await Cart.findOne({ user: userId }).populate("items.product");

//     for (const item of cart.items) {
//       const product = item.product;

//       await Product.findByIdAndUpdate(product._id, {
//         $inc: { quantity: -item.quantity, soldCount: +item.quantity }
//       });

//       await Order.create({
//         product_id: product._id,
//         name: product.name,
//         user_id: userId,
//         quantity: item.quantity,
//         total: product.price * item.quantity,
//         location: req.user.location,
//         deliveryDate,
//         deliverySlot,
//         lat: parseFloat(latitude),
//         lng: parseFloat(longitude),
//         status: "confirmed"
//       });
//     }

//     await Cart.deleteOne({ user: userId });
//     return res.redirect("/checkout/orders/success");
//   } catch (err) {
//     console.error("Payment verification failed:", err);
//     res.status(500).send("Error verifying payment");
//   }
// });



// router.get("/orders/success", (req, res) => {
//   res.render("order-success", { user: req.user });
// });

// module.exports=router;
router.post("/", async (req, res) => {
  try {
    const { deliveryDate, deliverySlot, latitude, longitude, paymentMethod ,address,phone} = req.body;
    const userId = req.user._id;
    const cart = await Cart.findOne({ user: userId }).populate("items.product");
    if (!cart || cart.items.length === 0) {
      return res.status(400).json({ error: "Cart is empty" });
    }

    // 🔁 Distance + Stock check
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
      // 🧾 Confirm order
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
          address:address,
          ph_number:phone
        });
      }


      

      await Cart.deleteOne({ user: userId });
      return res.json({ success: true, redirect: "/checkout/orders/success" });
    }

    // 🧾 Razorpay Payment Flow
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
});

// ✅ Payment verification
router.post("/verify-payment", async (req, res) => {
  try {
    const {
      razorpay_payment_id,
      razorpay_order_id,
      razorpay_signature,
      deliveryDate,
      deliverySlot,
      latitude,
      longitude,
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
        paid:true,
        razorpay_payment_id,
      });
    }

    await Cart.deleteOne({ user: userId });
    return res.json({ success: true ,redirect: "/checkout/orders/success"});
  } catch (err) {
    console.error("Payment verification failed:", err);
    res.status(500).json({ success: false, message: "Payment verification failed" });
  }
});

router.get("/orders/success", (req, res) => {
  res.render("order-success", { user: req.user });
});

module.exports = router;