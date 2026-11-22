import Wallet from "../../models/walletModel.js";

/**
 * Service to handle User Wallet operations
 */

export const getOrCreateWallet = async (userId) => {
  let wallet = await Wallet.findOne({ user: userId });
  if (!wallet) {
    wallet = new Wallet({
      user: userId,
      balance: 0,
      transactions: [],
    });
    await wallet.save();
  }
  return wallet;
};

export const getWalletBalance = async (userId) => {
  if (!userId) return 0;
  const wallet = await Wallet.findOne({ user: userId }).select("balance").lean();
  return wallet ? wallet.balance : 0;
};

export const getWalletData = async (userId, page = 1, limit = 10) => {
  const wallet = await getOrCreateWallet(userId);

  // Sort transactions by date descending (newest first)
  const allTransactions = [...(wallet.transactions || [])].sort(
    (a, b) => new Date(b.date) - new Date(a.date)
  );

  const totalTransactions = allTransactions.length;
  const totalPages = Math.ceil(totalTransactions / limit) || 1;
  const skip = (page - 1) * limit;
  const paginatedTransactions = allTransactions.slice(skip, skip + limit);

  return {
    balance: wallet.balance,
    transactions: paginatedTransactions,
    currentPage: page,
    totalPages,
    totalTransactions,
  };
};

export const creditWallet = async (
  userId,
  amount,
  description,
  orderId = null,
  orderCode = null
) => {
  const creditAmount = Number(amount);
  if (isNaN(creditAmount) || creditAmount <= 0) {
    throw new Error("Invalid credit amount.");
  }

  let wallet = await Wallet.findOne({ user: userId });
  if (!wallet) {
    wallet = new Wallet({
      user: userId,
      balance: 0,
      transactions: [],
    });
  }

  wallet.balance += creditAmount;
  wallet.transactions.unshift({
    amount: creditAmount,
    type: "credit",
    description,
    orderId,
    orderCode,
    date: new Date(),
  });

  await wallet.save();
  return wallet;
};

export const debitWallet = async (
  userId,
  amount,
  description,
  orderId = null,
  orderCode = null
) => {
  const debitAmount = Number(amount);
  if (isNaN(debitAmount) || debitAmount <= 0) {
    throw new Error("Invalid debit amount.");
  }

  const wallet = await getOrCreateWallet(userId);

  if (wallet.balance < debitAmount) {
    throw new Error(
      `Insufficient wallet balance. Available: ₹${wallet.balance}, required: ₹${debitAmount}.`
    );
  }

  wallet.balance -= debitAmount;
  wallet.transactions.unshift({
    amount: debitAmount,
    type: "debit",
    description,
    orderId,
    orderCode,
    date: new Date(),
  });

  await wallet.save();
  return wallet;
};
