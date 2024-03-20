const { ethers } = require('ethers');
require('dotenv').config();

const fs = require('fs');

const cacheFilePath = './transactionsCache.json';

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

// Alchemy API endpoint and API key
const alchemyApiKey = process.env.ALCHEMY_API_KEY;//alchemy-replit
const alchemyUrl = 'https://eth-mainnet.g.alchemy.com/v2/' + "alchemy-replit"; //+ alchemyApiKey;

// Set up ethers.js provider using Alchemy
const provider = new ethers.providers.JsonRpcProvider(alchemyUrl);

const startTime = 1584620823; //2020
const endTime = 1679228823; // Mon Mar 18 2024 10:40:02 GMT+0100 (Central European Standard Time)

// Get block numbers for the specified timeframe
async function getBlockNumbersInRange() {
  // const startBlock = await provider.getBlockNumber(startTime);
  // const endBlock = await provider.getBlockNumber(endTime);
  // console.log(startBlock);
  // console.log(endBlock);
  const startBlock = 19469660; //19462188;
  const endBlock = 19469664;
  return { startBlock, endBlock };
}

// Fetch transactions for each block within the specified timeframe
async function getTransactionsInRange() {
  const { startBlock, endBlock } = await getBlockNumbersInRange();

  // Check if transactions are already cached
  const cachedTransactions = readFromCache();
  if (cachedTransactions && cachedTransactions.startBlock === startBlock && cachedTransactions.endBlock === endBlock) {
    return cachedTransactions.transactions;
  }

  const transactions = [];
  for (let i = startBlock; i <= endBlock; i++) {
    const block = await provider.getBlockWithTransactions(i);
    transactions.push(...block.transactions);
  }

  // Cache the fetched transactions
  writeToCache({ startBlock, endBlock, transactions });
  return transactions;
}

const exchanges = ["0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D", "0xd9e1cE17f2641f24aE83637ab66a2cca9C378B9F"]
const WETH = "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2";

async function getSwapEvents(txHash) {
  const receipt = await provider.getTransactionReceipt(txHash);
  const swapEvents = receipt.logs.filter((log) => {
    // Match the event signature to the Swap event
    return log.topics[0] === ethers.utils.id('Swap(address,uint256,uint256,uint256,uint256,address)');
  });
  return swapEvents.length;
}

async function main() {
  // Example usage
  getTransactionsInRange().then(async (transactions) => {

    let count = 0;
    for (const tx of transactions) {
      const swapEventCount = await getSwapEvents(tx.hash);
      if (swapEventCount >= 2) {
        console.log(tx);
        count++;
      }
    }
    console.log(`Number of transactions with >= 2 Swap events: ${count}`);
  }).catch(error => {
    console.error("Error fetching transactions:", error);
  });
}

// Call the main function
main().catch(err => console.error(err));
