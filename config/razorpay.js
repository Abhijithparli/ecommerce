
import Razorpay from "razorpay";
import "dotenv/config";

// Get Razorpay credentials from environment variables
const keyId = process.env.RAZORPAY_KEY_ID;
const keySecret = process.env.RAZORPAY_KEY_SECRET;

// Check whether credentials are available
if (!keyId || !keySecret) {
    throw new Error("Razorpay API credentials are missing in .env");
}

// Create Razorpay instance
const razorpayInstance = new Razorpay({
    key_id: keyId,
    key_secret: keySecret
});

// Export the instance
export default razorpayInstance;
