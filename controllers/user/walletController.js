import * as walletService from "../../services/user/walletService.js";
import User from "../../models/userModel.js";
import { generateUniqueReferralCode } from "../../services/user/authService.js";

/**
 * Controller to handle User Wallet views and actions
 */

export const loadWallet = async (req, res) => {
  try {
    const userId = req.session.user.id;
    let page = parseInt(req.query.page);
    if (isNaN(page) || page < 1) page = 1;
    const limit = 10;

    let userDoc = await User.findById(userId);
    if (userDoc && !userDoc.referralCode) {
      userDoc.referralCode = await generateUniqueReferralCode();
      await userDoc.save();
    }

    const walletData = await walletService.getWalletData(userId, page, limit);

    res.render("user/wallet", {
      user: req.session.user,
      referralCode: userDoc ? userDoc.referralCode : null,
      referralRewardsEarned: userDoc ? userDoc.referralRewardsEarned : 0,
      balance: walletData.balance,
      transactions: walletData.transactions,
      currentPage: walletData.currentPage,
      totalPages: walletData.totalPages,
      totalTransactions: walletData.totalTransactions,
      success: req.session.success || null,
      error: req.session.error || null,
    });

    delete req.session.success;
    delete req.session.error;
  } catch (error) {
    console.error("Load wallet error:", error);
    res.redirect("/profile");
  }
};
