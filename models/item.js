
const mongoose = require("mongoose");

const itemSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, "Item name is required"],
      trim: true
    },

    type: {
      type: String,
      enum: ["Lost", "Found"],
      required: [true, "Item type is required"]
    },

    category: {
      type: String,
      required: [true, "Category is required"],
      trim: true
    },

    description: {
      type: String,
      required: [true, "Description is required"],
      trim: true
    },

    location: {
      type: String,
      required: [true, "Location is required"],
      trim: true
    },

    date: {
      type: Date,
      required: [true, "Date is required"]
    },

    // Item status
    status: {
      type: String,
      enum: ["Open", "Claimed", "Resolved"],
      default: "Open"
    },

    // Student who reported the item
    reportedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User"
    },

    // Student who submitted the claim
    claimedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null
    },

    // Claim information
    claimDescription: {
      type: String,
      trim: true,
      default: ""
    },

    claimStatus: {
      type: String,
      enum: ["Not Claimed", "Pending", "Approved", "Rejected"],
      default: "Not Claimed"
    },

    // Recovery tracking
    recoveryStatus: {
      type: String,
      enum: ["Not Started", "In Progress", "Recovered"],
      default: "Not Started"
    },

    recoveredAt: {
      type: Date,
      default: null
    }
  },
  { timestamps: true }
);

module.exports = mongoose.model("Item", itemSchema);
