const { Alchemy, Network, Utils } = require("alchemy-sdk");
require('dotenv').config();

const fs = require('fs');

const cacheFilePath = './transactionsCache.json';
const receiptsCacheFilePath = './receiptsCache.json';

// Helper function to read from cache
function readFromCache() {
  if (fs.existsSync(cacheFilePath)) {
    const cacheData = fs.readFileSync(cacheFilePath);
    return JSON.parse(cacheData);
  }
  return null;
}

// Helper function to write to cache
function writeToCache(data) {
  fs.writeFileSync(cacheFilePath, JSON.stringify(data));
}

// Helper function to read from receipts cache
function readFromReceiptsCache(txHash) {
  if (fs.existsSync(receiptsCacheFilePath)) {
    const cacheData = fs.readFileSync(receiptsCacheFilePath);
    const receiptsCache = JSON.parse(cacheData);
    return receiptsCache[txHash] || null;
  }
  return null;
}

// Helper function to write to receipts cache
function writeToReceiptsCache(txHash, receiptData) {
  let receiptsCache = {};
  if (fs.existsSync(receiptsCacheFilePath)) {
    receiptsCache = JSON.parse(fs.readFileSync(receiptsCacheFilePath));
  }
  receiptsCache[txHash] = receiptData;
  fs.writeFileSync(receiptsCacheFilePath, JSON.stringify(receiptsCache));
}

const config = {
  apiKey: "alchemy-replit",
  network: Network.ETH_MAINNET,
};
const alchemy = new Alchemy(config);

async function getTransactionsInRange() {

    const WTH = "0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2";
    // const WBTC = "0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599";

    const startBlock = "0x129155C";
    const endBlock = "0x1291560";

    const cachedTransactions = readFromCache();
    if (cachedTransactions && cachedTransactions.startBlock === startBlock && cachedTransactions.endBlock === endBlock) {
        return cachedTransactions.transactions;
    }

    let response = await alchemy.core.getAssetTransfers({
        fromBlock: startBlock,
        toBlock: endBlock,
        excludeZeroValue: true,
        contractAddresses: [WTH],
        category: ["erc20"],
    })

    const transactions = response.transfers;

    writeToCache({ startBlock, endBlock, transactions});
    return transactions;
}

async function getSwapEvents(txHash){
  let receipt = readFromReceiptsCache(txHash);
  if (!receipt) {
    receipt = await alchemy.core.getTransactionReceipt(txHash);
    writeToReceiptsCache(txHash, receipt);
  }
  const swapEvents = receipt.logs.filter((log) => {
    // Match the event signature to the Swap event
    return log.topics[0] === Utils.id('Swap(address,uint256,uint256,uint256,uint256,address)');
  });
  return swapEvents.length; 
}

async function main() {
    // Example usage

    const transfers = await getTransactionsInRange();
    let count = 0;

    for (let i = 0; i < transfers.length; i++) {
        const swapEventCount = await getSwapEvents(transfers[i].hash);
        if (swapEventCount >= 2) {

            count++;
        }
    }
    console.log(`Number of transactions with >= 2 Swap events: ${count}`);
}

// Call the main function
main().catch(err => console.error(err));
