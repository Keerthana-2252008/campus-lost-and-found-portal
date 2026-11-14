
const express = require("express");
const mongoose = require("mongoose");

const User = require("../models/user");
const Item = require("../models/item");
const authMiddleware = require("../middleware/authMiddleware");
const adminMiddleware = require("../middleware/adminMiddleware");

const router = express.Router();

// All admin routes require login and admin permission
router.use(authMiddleware);
router.use(adminMiddleware);

// ======================================
// GET: ADMIN DASHBOARD SUMMARY
// ======================================

router.get("/dashboard", async (req, res, next) => {
    try {
        const [
            totalUsers,
            totalItems,
            pendingClaims,
            recoveredItems,
            lostItems,
            foundItems
        ] = await Promise.all([
            User.countDocuments(),
            Item.countDocuments(),
            Item.countDocuments({ claimStatus: "Pending" }),
            Item.countDocuments({ recoveryStatus: "Recovered" }),
            Item.countDocuments({ type: "Lost" }),
            Item.countDocuments({ type: "Found" })
        ]);

        return res.status(200).json({
            success: true,
            dashboard: {
                totalUsers,
                totalItems,
                pendingClaims,
                recoveredItems,
                lostItems,
                foundItems
            }
        });
    } catch (error) {
        next(error);
    }
});

// ======================================
// GET: VIEW ALL REGISTERED STUDENTS
// ======================================

router.get("/users", async (req, res, next) => {
    try {
        const users = await User.find()
            .select("-password")
            .sort({ createdAt: -1 });

        return res.status(200).json({
            success: true,
            count: users.length,
            users
        });
    } catch (error) {
        next(error);
    }
});

// ======================================
// GET: VIEW ALL REPORTED ITEMS
// ======================================

router.get("/items", async (req, res, next) => {
    try {
        const items = await Item.find()
            .populate("reportedBy", "name email")
            .populate("claimedBy", "name email")
            .sort({ createdAt: -1 });

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
// GET: VIEW PENDING CLAIMS
// ======================================

router.get("/claims/pending", async (req, res, next) => {
    try {
        const claims = await Item.find({
            claimStatus: "Pending"
        })
            .populate("reportedBy", "name email")
            .populate("claimedBy", "name email")
            .sort({ createdAt: -1 });

        return res.status(200).json({
            success: true,
            count: claims.length,
            claims
        });
    } catch (error) {
        next(error);
    }
});

// ======================================
// EXPORT ADMIN ROUTER
// ======================================

module.exports = router;
