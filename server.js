
const dotenv = require("dotenv");
dotenv.config();

const express = require("express");
const cors = require("cors");
const mongoose = require("mongoose");
const path = require("path");

const Item = require("./models/item");
const User = require("./models/user");

const authRoutes = require("./routes/auth");
const adminRoutes = require("./routes/admin");
const authMiddleware = require("./middleware/authMiddleware");

const app = express();
const PORT = process.env.PORT || 3000;

// ======================================
// MIDDLEWARE
// ======================================

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use((req, res, next) => {
    if (req.path.startsWith("/api")) {
        console.log("API REQUEST:", req.method, req.originalUrl);
    }
    next();
});

app.use(express.static(path.join(__dirname, "public")));

// ======================================
// AUTHENTICATION AND ADMIN ROUTES
// ======================================

app.use("/api/auth", authRoutes);
app.use("/api/admin", adminRoutes);

// ======================================
// HELPER FUNCTION
// ======================================

function escapeRegex(value) {
    return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// ======================================
// HEALTH CHECK
// ======================================

app.get("/api/health", (req, res) => {
    return res.status(200).json({
        success: true,
        message: "Campus Lost and Found Portal API is running!",
        database:
            mongoose.connection.readyState === 1
                ? "Connected"
                : "Disconnected"
    });
});

// ======================================
// WELCOME ROUTE
// ======================================

app.get("/api", (req, res) => {
    return res.status(200).json({
        success: true,
        message: "Welcome to Campus Lost and Found Portal"
    });
});

// ======================================
// GET ALL ITEMS WITH FILTERS
// ======================================

app.get("/api/items", async (req, res, next) => {
    try {
        const { keyword, type, category, location } = req.query;

        const filter = {};

        if (type && ["Lost", "Found"].includes(type)) {
            filter.type = type;
        }

        if (category) {
            filter.category = category;
        }

        if (location) {
            filter.location = {
                $regex: escapeRegex(location),
                $options: "i"
            };
        }

        if (keyword) {
            const safeKeyword = escapeRegex(keyword);

            filter.$or = [
                { name: { $regex: safeKeyword, $options: "i" } },
                { description: { $regex: safeKeyword, $options: "i" } },
                { category: { $regex: safeKeyword, $options: "i" } },
                { location: { $regex: safeKeyword, $options: "i" } }
            ];
        }

        const items = await Item.find(filter).sort({
            createdAt: -1
        });

        return res.status(200).json({
            success: true,
            count: items.length,
            items
        });
    } catch (error) {
        next(error);
    }
});

// ======================================
// REPORT A LOST OR FOUND ITEM
// ======================================

app.post("/api/items", authMiddleware, async (req, res, next) => {
    try {
        const {
            name,
            type,
            category,
            description,
            location,
            date
        } = req.body;

        if (
            !name?.trim() ||
            !type ||
            !category?.trim() ||
            !description?.trim() ||
            !location?.trim() ||
            !date
        ) {
            return res.status(400).json({
                success: false,
                message: "Please fill in all required fields."
            });
        }

        if (!["Lost", "Found"].includes(type)) {
            return res.status(400).json({
                success: false,
                message: "Type must be Lost or Found."
            });
        }

        const itemDate = new Date(date);

        if (Number.isNaN(itemDate.getTime())) {
            return res.status(400).json({
                success: false,
                message: "Please provide a valid date."
            });
        }

        const item = await Item.create({
            name: name.trim(),
            type,
            category: category.trim(),
            description: description.trim(),
            location: location.trim(),
            date: itemDate,
            reportedBy: req.user.userId
        });

        return res.status(201).json({
            success: true,
            message: "Item reported successfully!",
            item
        });
    } catch (error) {
        next(error);
    }
});

// ======================================
// SUBMIT A CLAIM
// ======================================

app.post(
    "/api/items/:id/claim",
    authMiddleware,
    async (req, res, next) => {
        console.log("CLAIM ROUTE HIT:", req.params.id);

        try {
            const { claimDescription } = req.body;

            if (
                typeof claimDescription !== "string" ||
                !claimDescription.trim()
            ) {
                return res.status(400).json({
                    success: false,
                    message: "Please provide claim details."
                });
            }

            if (claimDescription.trim().length > 1000) {
                return res.status(400).json({
                    success: false,
                    message: "Claim details cannot exceed 1000 characters."
                });
            }

            if (!mongoose.isValidObjectId(req.params.id)) {
                return res.status(400).json({
                    success: false,
                    message: "Invalid item ID."
                });
            }

            const item = await Item.findById(req.params.id);

            if (!item) {
                return res.status(404).json({
                    success: false,
                    message: "Item not found."
                });
            }

            if (item.type !== "Found") {
                return res.status(400).json({
                    success: false,
                    message: "You can only claim found items."
                });
            }

            if (
                item.reportedBy &&
                item.reportedBy.toString() === req.user.userId
            ) {
                return res.status(403).json({
                    success: false,
                    message: "You cannot claim your own reported item."
                });
            }

            if (
                item.status !== "Open" ||
                item.claimStatus === "Pending" ||
                item.claimStatus === "Approved"
            ) {
                return res.status(400).json({
                    success: false,
                    message: "This item is not available for claiming."
                });
            }

            item.claimedBy = req.user.userId;
            item.claimDescription = claimDescription.trim();
            item.claimStatus = "Pending";
            item.status = "Claimed";
            item.recoveryStatus = "Not Started";

            await item.save();

            return res.status(200).json({
                success: true,
                message: "Claim submitted successfully!",
                item
            });
        } catch (error) {
            next(error);
        }
    }
);

console.log("Claim route registered: POST /api/items/:id/claim");

// ======================================
// APPROVE OR REJECT A CLAIM
// ======================================

app.patch(
    "/api/items/:id/claim/review",
    authMiddleware,
    async (req, res, next) => {
        console.log("CLAIM REVIEW ROUTE HIT:", req.params.id);

        try {
            const { action } = req.body;

            if (!mongoose.isValidObjectId(req.params.id)) {
                return res.status(400).json({
                    success: false,
                    message: "Invalid item ID."
                });
            }

            if (!["approve", "reject"].includes(action)) {
                return res.status(400).json({
                    success: false,
                    message: "Action must be approve or reject."
                });
            }

            const item = await Item.findById(req.params.id);

            if (!item) {
                return res.status(404).json({
                    success: false,
                    message: "Item not found."
                });
            }

            const isReporter =
                item.reportedBy &&
                item.reportedBy.toString() === req.user.userId;

            const isAdmin = req.user.role === "admin";

            if (!isReporter && !isAdmin) {
                return res.status(403).json({
                    success: false,
                    message: "You are not authorized to review this claim."
                });
            }

            if (item.claimStatus !== "Pending") {
                return res.status(400).json({
                    success: false,
                    message: "There is no pending claim to review."
                });
            }

            if (action === "approve") {
                item.claimStatus = "Approved";
                item.status = "Claimed";
                item.recoveryStatus = "In Progress";
            } else {
                item.claimStatus = "Rejected";
                item.status = "Open";
                item.recoveryStatus = "Not Started";

                item.claimedBy = null;
                item.claimDescription = "";
            }

            await item.save();

            return res.status(200).json({
                success: true,
                message:
                    action === "approve"
                        ? "Claim approved successfully!"
                        : "Claim rejected successfully!",
                item
            });
        } catch (error) {
            next(error);
        }
    }
);

console.log(
    "Claim review route registered: PATCH /api/items/:id/claim/review"
);

// ======================================
// COMPLETE ITEM RECOVERY
// ======================================

app.patch(
    "/api/items/:id/recovery/complete",
    authMiddleware,
    async (req, res, next) => {
        console.log("RECOVERY COMPLETE ROUTE HIT:", req.params.id);

        try {
            if (!mongoose.isValidObjectId(req.params.id)) {
                return res.status(400).json({
                    success: false,
                    message: "Invalid item ID."
                });
            }

            const item = await Item.findById(req.params.id);

            if (!item) {
                return res.status(404).json({
                    success: false,
                    message: "Item not found."
                });
            }

            const isReporter =
                item.reportedBy &&
                item.reportedBy.toString() === req.user.userId;

            const isAdmin = req.user.role === "admin";

            if (!isReporter && !isAdmin) {
                return res.status(403).json({
                    success: false,
                    message: "You are not authorized to complete recovery."
                });
            }

            if (item.claimStatus !== "Approved") {
                return res.status(400).json({
                    success: false,
                    message: "Only approved claims can be marked recovered."
                });
            }

            if (item.recoveryStatus !== "In Progress") {
                return res.status(400).json({
                    success: false,
                    message: "Recovery is not currently in progress."
                });
            }

            item.recoveryStatus = "Recovered";
            item.status = "Resolved";
            item.recoveredAt = new Date();

            await item.save();

            return res.status(200).json({
                success: true,
                message: "Item marked as recovered successfully!",
                item
            });
        } catch (error) {
            next(error);
        }
    }
);

console.log(
    "Recovery route registered: PATCH /api/items/:id/recovery/complete"
);

// ======================================
// PROTECTED AUTHENTICATION TEST
// ======================================

app.get("/api/auth/protected", authMiddleware, (req, res) => {
    return res.status(200).json({
        success: true,
        message: "You accessed a protected route successfully!",
        user: req.user
    });
});

// ======================================
// HANDLE UNKNOWN API ROUTES
// ======================================

app.use("/api", (req, res) => {
    console.log("UNKNOWN API ROUTE:", req.method, req.originalUrl);

    return res.status(404).json({
        success: false,
        message: "API endpoint not found"
    });
});

// ======================================
// ERROR HANDLING
// ======================================

app.use((err, req, res, next) => {
    console.error("Server error:", err);

    if (
        err.name === "ValidationError" ||
        err.name === "CastError"
    ) {
        return res.status(400).json({
            success: false,
            message: err.message
        });
    }

    return res.status(500).json({
        success: false,
        message: "Internal server error"
    });
});

// ======================================
// CONNECT TO MONGODB AND START SERVER
// ======================================

async function startServer() {
    try {
        if (!process.env.MONGODB_URI) {
            throw new Error(
                "MONGODB_URI is missing. Check your .env file."
            );
        }

        if (!process.env.JWT_SECRET) {
            throw new Error(
                "JWT_SECRET is missing. Check your .env file."
            );
        }

        await mongoose.connect(process.env.MONGODB_URI, {
            serverSelectionTimeoutMS: 10000
        });

        console.log("MongoDB connected successfully!");

        app.listen(PORT, () => {
            console.log(`Server running at http://localhost:${PORT}`);
        });
    } catch (error) {
        console.error(
            "Failed to start the application:",
            error.message
        );

        process.exit(1);
    }
}

startServer();
