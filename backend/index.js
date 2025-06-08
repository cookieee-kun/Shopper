require("dotenv").config();
const express = require("express");
const app = express();
const mongoose = require("mongoose");
const jwt = require("jsonwebtoken");
const multer = require("multer");
const path = require("path");
const cors = require("cors");

const port = process.env.PORT || 4000;
const secretKey = process.env.JWT_SECRET;

app.use(express.json());

// ✅ Allow only your frontend to access backend
app.use(cors({
	origin: "https://shopper-frontend-nb70.onrender.com",
	credentials: true,
}));

// ✅ Connect to MongoDB
mongoose.connect(process.env.MONGO_URI, {
	useNewUrlParser: true,
	useUnifiedTopology: true,
})
.then(() => console.log("Connected to MongoDB"))
.catch((error) => console.error("MongoDB connection error:", error));

// ✅ Image upload setup (⚠️ Non-persistent on Render)
const storage = multer.diskStorage({
	destination: './upload/images',
	filename: (req, file, cb) => {
		cb(null, `${file.fieldname}_${Date.now()}${path.extname(file.originalname)}`);
	}
});
const upload = multer({ storage: storage });

app.post("/upload", upload.single('product'), (req, res) => {
	res.json({
		success: 1,
		image_url: `/images/${req.file.filename}`
	});
});
app.use('/images', express.static('upload/images'));

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

// ✅ Mongoose models
const Users = mongoose.model("Users", {
	name: String,
	email: { type: String, unique: true },
	password: String,
	cartData: Object,
	date: { type: Date, default: Date.now }
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
app.get("/", (req, res) => res.send("Root"));

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

app.post("/addproduct", async (req, res) => {
	const products = await Product.find({});
	const id = products.length > 0 ? products[products.length - 1].id + 1 : 1;

	const product = new Product({ ...req.body, id });
	await product.save();

	res.json({ success: true, name: req.body.name });
});

// ✅ Fallback route
app.use((req, res) => res.status(404).send("Route not found"));

app.listen(port, () => {
	console.log(`Server is running on port ${port}`);
});
