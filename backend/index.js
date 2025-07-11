require("dotenv").config();
const express = require("express");
const app = express();
const mongoose = require("mongoose");
const jwt = require("jsonwebtoken");
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const cors = require("cors");

const port = process.env.PORT || 4000;
const secretKey = process.env.JWT_SECRET;

// ✅ Middlewares
app.use(express.json());

// ✅ CORS setup
const allowedOrigins = [
  "http://localhost:3000",
  "https://shopper-frontend-nb70.onrender.com",
];
app.use(
  cors({
    origin: function (origin, callback) {
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        callback(new Error("Not allowed by CORS"));
      }
    },
    credentials: true,
  })
);

// ✅ MongoDB connection
mongoose
  .connect(process.env.MONGO_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  })
  .then(() => console.log("✅ Connected to MongoDB"))
  .catch((error) => console.error("MongoDB connection error:", error));

// ✅ Multer setup with folder creation
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const uploadPath = path.join(__dirname, "upload/images");
    fs.mkdirSync(uploadPath, { recursive: true });
    cb(null, uploadPath);
  },
  filename: function (req, file, cb) {
    cb(
      null,
      `${file.fieldname}_${Date.now()}${path.extname(file.originalname)}`
    );
  },
});
const upload = multer({ storage });

// ✅ Serve static image files
app.use("/images", express.static(path.join(__dirname, "upload/images")));

// ✅ JWT middleware
const fetchuser = async (req, res, next) => {
  const token = req.header("auth-token");
  if (!token) return res.status(401).send({ errors: "No token" });

  try {
    const data = jwt.verify(token, secretKey);
    req.user = data.user;
    next();
  } catch (err) {
    res.status(401).send({ errors: "Invalid token" });
  }
};

// ✅ MongoDB models
const Users = mongoose.model("Users", {
  name: String,
  email: { type: String, unique: true },
  password: String,
  cartData: Object,
  date: { type: Date, default: Date.now },
});

const Product = mongoose.model("Product", {
  id: { type: Number, required: true },
  name: { type: String, required: true },
  description: { type: String, required: true },
  image: { type: String, required: true },
  category: { type: String, required: true },
  new_price: Number,
  old_price: Number,
  date: { type: Date, default: Date.now },
  avilable: { type: Boolean, default: true },
});

// ✅ Routes

// Test route
app.get("/", (req, res) => res.send("🟢 Backend Running"));

// ✅ Upload route
app.post("/upload", upload.single("product"), (req, res) => {
  if (!req.file) {
    console.error("❌ File not uploaded");
    return res.status(400).json({ success: false, message: "No file uploaded" });
  }

  const imageUrl = `https://shopper-backend-xxxx.onrender.com/images/${req.file.filename}`;
  console.log("✅ Uploaded:", imageUrl);
  res.json({
    success: 1,
    image_url: imageUrl,
  });
});

// ✅ Auth routes
app.post("/signup", async (req, res) => {
  let success = false;
  const check = await Users.findOne({ email: req.body.email });
  if (check) return res.status(400).json({ success, errors: "Email already used" });

  const cart = {};
  for (let i = 0; i < 300; i++) cart[i] = 0;

  const user = new Users({
    name: req.body.username,
    email: req.body.email,
    password: req.body.password,
    cartData: cart,
  });
  await user.save();

  const data = { user: { id: user.id } };
  const token = jwt.sign(data, secretKey);
  res.json({ success: true, token });
});

app.post("/login", async (req, res) => {
  const user = await Users.findOne({ email: req.body.email });
  if (!user || user.password !== req.body.password) {
    return res.status(400).json({ success: false, errors: "Invalid credentials" });
  }
  const data = { user: { id: user.id } };
  const token = jwt.sign(data, secretKey);
  res.json({ success: true, token });
});

// ✅ Product routes
app.get("/allproducts", async (req, res) => {
  const products = await Product.find({});
  res.send(products);
});

app.get("/newcollections", async (req, res) => {
  const products = await Product.find({});
  res.send(products.slice(-8));
});

app.get("/popularinwomen", async (req, res) => {
  const products = await Product.find({ category: "women" });
  res.send(products.slice(0, 4));
});

app.post("/relatedproducts", async (req, res) => {
  const { category } = req.body;
  const products = await Product.find({ category });
  res.send(products.slice(0, 4));
});

app.post("/addproduct", async (req, res) => {
  const products = await Product.find({});
  const id = products.length > 0 ? products[products.length - 1].id + 1 : 1;

  const product = new Product({ ...req.body, id });
  await product.save();

  res.json({ success: true, name: req.body.name });
});

// ✅ Cart routes
app.post("/addtocart", fetchuser, async (req, res) => {
  const userData = await Users.findById(req.user.id);
  userData.cartData[req.body.itemId] += 1;
  await Users.findByIdAndUpdate(req.user.id, { cartData: userData.cartData });
  res.send("Added");
});

app.post("/removefromcart", fetchuser, async (req, res) => {
  const userData = await Users.findById(req.user.id);
  if (userData.cartData[req.body.itemId] > 0) {
    userData.cartData[req.body.itemId] -= 1;
  }
  await Users.findByIdAndUpdate(req.user.id, { cartData: userData.cartData });
  res.send("Removed");
});

app.post("/getcart", fetchuser, async (req, res) => {
  const userData = await Users.findById(req.user.id);
  res.json(userData.cartData);
});

// 404 fallback
app.use((req, res) => res.status(404).send("❌ Route not found"));

// ✅ Start server
app.listen(port, () => {
  console.log(`🚀 Server running on port ${port}`);
});
