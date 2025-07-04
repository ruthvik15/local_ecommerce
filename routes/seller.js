const express = require('express');
const router = express.Router();
const upload = require("../utils/s3Uploader");

const {
  getDashboard,
  stopProduct,
  updatePrice,
  updateQuantity,
  renderAddPage,
  uploadProduct
} = require('../controllers/sellerController');

router.get('/dashboard', getDashboard);
router.post('/product/:id/stop', stopProduct);
router.post('/product/:id/price', updatePrice);
router.post('/product/:id/quantity', updateQuantity);
router.get('/add-product', renderAddPage);
router.post('/productadd', upload.single("image"), uploadProduct);

module.exports = router;
