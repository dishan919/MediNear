const express = require("express");
const cors = require("cors");
const dotenv = require("dotenv");

const connectDB = require("./config/db");
const pharmacyRoutes = require("./routes/pharmacyRoutes");

dotenv.config();

connectDB();

const app = express();

// Allow React frontend to connect with backend
app.use(cors());

// Convert JSON request body into JavaScript object
app.use(express.json());

// Basic testing route
app.get("/", (req, res) => {
  res.json({
    success: true,
    message: "MediNear API is running",
  });
});

// Pharmacy API routes
app.use("/api/pharmacies", pharmacyRoutes);

// Handle unknown routes
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: "API route not found",
  });
});

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});