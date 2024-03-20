const { Alchemy, Network, Utils, fromHex } = require("alchemy-sdk");
require('dotenv').config();
//const { ethers } = require('ethers');

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

// Alchemy API endpoint and API key
const alchemyApiKey = process.env.ALCHEMY_API_KEY;
const config = {
  apiKey: alchemyApiKey,
  network: Network.ETH_MAINNET,
};
const alchemy = new Alchemy(config);

async function getTransactionsInRange() {

  const WTH = "0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2";
  // const WBTC = "0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599";

  const startBlock = "0x1291A98";
  const endBlock = "0x1291afc";

  const cachedTransactions = readFromCache();
  if (cachedTransactions && cachedTransactions.startBlock === startBlock && cachedTransactions.endBlock === endBlock) {
    console.log("going in cached on transfers");
    return cachedTransactions.transactions;
  }

  let transactions = [];
  let pageKey;
  let request = {
    fromBlock: startBlock,
    toBlock: endBlock,
    excludeZeroValue: true,
    contractAddresses: [WTH],
    category: ["erc20"],
  };

  do {
    let response = await alchemy.core.getAssetTransfers(request);
    pageKey = response.pageKey;
    if (pageKey) {
      request['pageKey'] = pageKey;
    }

    transactions.push(response.transfers);
  } while (pageKey);

  writeToCache({ startBlock, endBlock, transactions });
  return transactions;
}

async function getSwapEvents(txHash) {
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


async function getErc20Transfers(txHash) {
  let receipt = readFromReceiptsCache(txHash);
  if (!receipt) {
    console.log("no receipts cached");
    receipt = await alchemy.core.getTransactionReceipt(txHash);
    writeToReceiptsCache(txHash, receipt);
  }

  const transferEvents = receipt.logs.filter(log =>
    log.topics[0] === Utils.id('Transfer(address,address,uint256)')
  );
  const transfers = [];

  transferEvents.forEach(log => {
    const tokenAddress = log.address;
    const from = log.topics[1];
    const to = log.topics[2];
    const data = log.data;

    // const numData = ethers.BigNumber.from(data);
    // console.log("Data:", numData);

    const transferEvent = {
      tokenAddress: tokenAddress,
      from: from,
      to: to,
      amount: data,
    }
    transfers.push(transferEvent);
    // console.log(transferEvent);

    // let f = ethers.utils.hexStripZeros(from);
    // f = ethers.utils.hexZeroPad(f, 20);
    // console.log(`Token Transfer:
    //   TokenAddress: ${tokenAddress},
    //   From: ${from},
    //   To: ${to},
    //   Amount: ${ethers.BigNumber.from(data)}
    // `);
  });
  return transfers;
}

async function possibleFlashloan(txHash) {
  const transfers = await getErc20Transfers(txHash);


  const first = transfers[0];
  const from_first = first.from;
  const to_first = first.to;

  const last = transfers[transfers.length - 1];
  const from_last = last.from;
  const to_last = last.to;

  if (first.tokenAddress == last.tokenAddress && from_first == to_last && to_first == from_last) {
    return true;
  } else {
    return false;
  }

}

async function main() {

  let transfers = await getTransactionsInRange();
  let count = 0;
  transfers = transfers.flat();

  for (let i = 0; i < transfers.length; i++) {
    const swapEventCount = await getSwapEvents(transfers[i].hash);
    const isFlashloaned = await possibleFlashloan(transfers[i].hash);
    if (swapEventCount >= 2 && isFlashloaned) {
      console.log(transfers[i].hash);
      count++;
    }
  }
  console.log(`Number of transactions with >= 2 Swap events: ${count}`);


}

// Call the main function
main().catch(err => console.error(err));
