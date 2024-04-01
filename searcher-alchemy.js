const { Alchemy, Network, Utils, fromHex } = require("alchemy-sdk");
require('dotenv').config();
const fs = require('fs');
const { env } = require("process");
const path = require('path');

// Global variables
let WTH = "";
let startBlock = "";
let endBlock = "";
let transfersCacheFilePath = "";
let receiptsCacheFilePath = "";
let receiptsCacheJSON = {};
let alchemy;

// Helper function to read from cache
function readFromCache() {
  if (fs.existsSync(transfersCacheFilePath)) {
    const cacheData = fs.readFileSync(transfersCacheFilePath);
    return JSON.parse(cacheData);
  }
  return null;
}

// Helper function to write to cache
function writeToCache(data) {
  fs.writeFileSync(transfersCacheFilePath, JSON.stringify(data));
}

// Helper function to read from receipts cache
function readFromReceiptsCache(txHash) {
  if (!fs.existsSync(receiptsCacheFilePath)) {
    return null;
  }

  if (Object.keys(receiptsCacheJSON).length == 0) {
    const cacheData = fs.readFileSync(receiptsCacheFilePath);
    receiptsCacheJSON = JSON.parse(cacheData);
    console.log("reading once, num of receipts is: ", Object.keys(receiptsCacheJSON).length);
  }

  return receiptsCacheJSON[txHash] || null;
}

// Helper function to write to receipts cache given an object of receipts
function writeAllToReceiptsCache(listOfReceipts) {
  if (Object.keys(receiptsCacheJSON).length == 0 && fs.existsSync(receiptsCacheFilePath)) {
    receiptsCacheJSON = JSON.parse(fs.readFileSync(receiptsCacheFilePath));
  }
  for (hash in listOfReceipts) {
    receiptsCacheJSON[hash] = listOfReceipts[hash];
  }

  fs.writeFileSync(receiptsCacheFilePath, JSON.stringify(receiptsCacheJSON));
}

async function getTransactionsInRange() {

  const cachedTransactions = readFromCache();
  if (cachedTransactions && cachedTransactions.startBlock === startBlock && cachedTransactions.endBlock === endBlock) {
    console.log("Reading from transfersCache");
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

    for (tx of response.transfers) {
      if (!transactions.includes(tx.hash)) {
        transactions.push(tx.hash);
      }
    }

  } while (pageKey);

  writeToCache({ startBlock, endBlock, transactions });
  return transactions;
}


// Add V3 swap signature add others (Cow swap)
async function getSwapEvents(receipt) {
  const swapEventSignatures = [
    Utils.id('Swap(address,uint256,uint256,uint256,uint256,address)'),
    Utils.id('Swap(address,address,int256,int256,uint160,uint128,int24)'),
    Utils.id('Trade(address,address,address,uint256,uint256,uint256,bytes)'),
    Utils.id('TransformedERC20(address,address,address,uint256,uint256)'),
    Utils.id('Conversion(address,address,address,uint256,uint256,int256)'),
    Utils.id('Conversion(address,address,address,uint256,uint256,address)'),
    Utils.id('Swap(bytes32,address,address,uint256,uint256)'),
    Utils.id('Swap(address,uint256,uint256,uint256,uint256,address)'),
    Utils.id('Swapped(address,address,address,address,uint256,uint256,uint256,uint256,uint256,address)'),
    Utils.id('LOG_SWAP(address,address,address,uint256,uint256)'),
    Utils.id('Swapped(address,address,address,address,uint256,uint256)'),
  ];

  const swapEvents = receipt.logs.filter((log) => {
    // Match the event signature to the Swap event
    return swapEventSignatures.includes(log.topics[0]);
  });
  return swapEvents;
}


async function getErc20Transfers(receipt) {
  const transferEvents = receipt.logs.filter(log =>
    log.topics[0] === Utils.id('Transfer(address,address,uint256)')
  );
  const transfers = [];

  transferEvents.forEach(log => {
    const tokenAddress = log.address;
    const from = log.topics[1];
    const to = log.topics[2];
    const data = log.data;

    const transferEvent = {
      tokenAddress: tokenAddress,
      from: from,
      to: to,
      amount: data,
    }
    transfers.push(transferEvent);
  });
  return transfers;
}

async function possibleFlashloan(receipt) {
  const transfers = await getErc20Transfers(receipt);

  const first = transfers[0];
  const from_first = first.from;
  const to_first = first.to;
  const amount_first = first.data;

  const last = transfers[transfers.length - 1];
  const from_last = last.from;
  const to_last = last.to;
  const amount_last = last.data;

  if (first.tokenAddress == last.tokenAddress && parseInt(amount_last, 16) >= parseInt(amount_first, 16) && from_first == to_last && to_first == from_last) {
    return true;
  } else {
    return false;
  }
}

// This was function was nessesary since some addresses are padded and not in original ethereum style
function removeLeadingZeros(paddedAddress) {
  // Remove '0x' prefix if present
  if (paddedAddress.startsWith('0x')) {
    paddedAddress = paddedAddress.slice(2);
  }

  // Remove leading zeros, and keep untill 40 characters, 40 is default ethereum address
  while (paddedAddress.length > 40 && paddedAddress.startsWith('0')) {
    paddedAddress = paddedAddress.slice(1);
  }

  // Add back '0x' prefix
  return '0x' + paddedAddress;
}

async function isCycle(receipt, ExchangeAddresses) {
  const transfers = await getErc20Transfers(receipt);
  const prevs = [];
  for (tx of transfers) {
    for (prev of prevs) {
      //console.log(prev);
      if (prev.from === tx.to && tx.tokenAddress === prev.tokenAddress && tx.amount > prev.amount && !ExchangeAddresses.includes(removeLeadingZeros(prev.from))) {
        // console.log("current prev: ", prev.amount);
        // console.log("current tx: ", tx.amount);
        return true;
      }
    }
    prevs.push(tx);
  }
}


async function getArbitrage(receipt) {
  const swapEvents = await getSwapEvents(receipt);
  const firstCheck = swapEvents.length >= 2;
  if (firstCheck) {
    const ExchangeAddresses = [];
    for (sw of swapEvents) {
      if (!ExchangeAddresses.includes(sw.address)) {
        ExchangeAddresses.push(sw.address.toLowerCase());
      }
    }
    const secondCheck = ExchangeAddresses.length >= 2;
    if (secondCheck) {
      const thirdCheck = await isCycle(receipt, ExchangeAddresses);
      if (thirdCheck) {
        return true;
      }
    }
  }
  return false;
}

async function sleep() {
  console.log("Sleeping for 1 minute...");
  await new Promise(resolve => setTimeout(resolve, 60000));
  console.log("Woke up after 1 minute!");
}

function createDirectories(dirPath) {
  const directories = dirPath.split('/'); // Split the directory path into an array of directory names
  let currentPath = '';

  directories.forEach((dir) => {
    currentPath = path.join(currentPath, dir); // Append each directory to the current path
    if (!fs.existsSync(currentPath)) {
      fs.mkdirSync(currentPath); // Create the directory if it doesn't exist
    }
  });
}

function init() {
  const args = process.argv.slice(2); // Remove the first two elements (node executable and script name)
  // Alchemy API endpoint and API key
  const alchemyApiKey = process.env.ALCHEMY_API_KEY;
  const config = {
    apiKey: alchemyApiKey,
    network: "",
  };
  // Process arguments based on their positions
  if (args.length != 1) {
    console.log("No blockchain was selected. Select one of the following blockchains:");
    console.log("-ethereum");
    console.log("-arbitrum");
    console.log("-polygon");
    console.log("-optimism");
    return;
  } else {
    const firstArgument = args[0];
    if (firstArgument === '-ethereum') {
      config.network = process.env.ETHEREUM_NETWORK;
      WTH = process.env.ETHEREUM_WTH_ADDRESS;
      startBlock = process.env.ETHEREUM_START_BLOCK;
      endBlock = process.env.ETHEREUM_END_BLOCK;
      transfersCacheFilePath = process.env.ETHEREUM_TRANSFERS;
      receiptsCacheFilePath = process.env.ETHEREUM_RECEIPTS;
      createDirectories(process.env.ETHEREUM_DIRS);
    } else if (firstArgument === '-arbitrum') {
      config.network = process.env.ARBITRUM_NETWORK;
      WTH = process.env.ARBITRUM_WTH_ADDRESS;
      startBlock = process.env.ARBITRUM_START_BLOCK;
      endBlock = process.env.ARBITRUM_END_BLOCK;
      transfersCacheFilePath = process.env.ARBITRUM_TRANSFERS;
      receiptsCacheFilePath = process.env.ARBITRUM_RECEIPTS;
      createDirectories(process.env.ARBITRUM_DIRS);
    } else if (firstArgument === '-polygon') {
      config.network = process.env.POLYGON_NETWORK;
      WTH = process.env.POLYGON_WTH_ADDRESS;
      startBlock = process.env.POLYGON_START_BLOCK;
      endBlock = process.env.POLYGON_END_BLOCK;
      transfersCacheFilePath = process.env.POLYGON_TRANSFERS;
      receiptsCacheFilePath = process.env.POLYGON_RECEIPTS;
      createDirectories(process.env.POLYGON_DIRS);
    } else if (firstArgument === '-optimism') {
      config.network = process.env.OPTIMISM_NETWORK;
      WTH = process.env.OPTIMISM_WTH_ADDRESS;
      startBlock = process.env.OPTIMISM_START_BLOCK;
      endBlock = process.env.OPTIMISM_END_BLOCK;
      transfersCacheFilePath = process.env.OPTIMISM_TRANSFERS;
      receiptsCacheFilePath = process.env.OPTIMISM_RECEIPTS;
      createDirectories(process.env.OPTIMISM_DIRS);
    } else {
      console.log("Blockchain not found!");
      return;
    }
  }

  alchemy = new Alchemy(config);
  main().catch(err => console.error(err));
  //main_read_cache().catch(err => console.error(err));
}

async function main() {

  const transactionsHash = await getTransactionsInRange();
  console.log("Finished getting asset transfers!");

  const batchSize = 1000;
  const numChunks = Math.ceil(transactionsHash.length / batchSize);
  console.log("Number of Chunks: ", numChunks);

  for (let i = 0; i < numChunks; i++) {
    let errnum = 0;
    let netreq = 0;

    const startIdx = i * batchSize;
    const endIdx = Math.min((i + 1) * batchSize, transactionsHash.length);
    const chunk = transactionsHash.slice(startIdx, endIdx);
    const transactionsReceiptToSave = {};
    console.time(`Processing chunk ${i + 1}`);
    try {
      // Create an array of promises for fetching transaction receipts
      const promises = chunk.map(async (hash) => {
        let receipt = readFromReceiptsCache(hash);
        if (!receipt) {
          netreq++;
          receipt = await alchemy.core.getTransactionReceipt(hash);
          transactionsReceiptToSave[hash] = receipt;
        }
      });
      // Wait for all promises to resolve
      const results = await Promise.allSettled(promises);
      results.forEach(result => {
        if (result.status !== 'fulfilled') {
          errnum++;
          let requestBody = JSON.parse(result.reason.requestBody);
          let hashError = requestBody.params[0];
          //console.log(`Error ${hashError}. code: ${result.reason.code}, reason: ${result.reason.reason}`);

        }
      });

    } catch (error) {
      console.log(`Error while collecting data in chunk ${i + 1}: ${error}`);
    } finally {
      console.timeEnd(`Processing chunk ${i + 1}`);
      // Writing missing transactions receipt in the cache
      writeAllToReceiptsCache(transactionsReceiptToSave);
    }
    console.log("Net requests: ", netreq);

    if (errnum > 0) {
      console.log("Num errors: ", errnum);
      const errorPercentageChunk = errnum / chunk.length * 100;
      console.log("Errors still happen: " + errorPercentageChunk + "%");
      //await sleep();
    }
  }

  let count = 0;
  for (const hash in receiptsCacheJSON) {
    const isArbitrage = await getArbitrage(receiptsCacheJSON[hash]);
    if (isArbitrage) {
      //console.log(hash);
      count++;
    }
  }
  console.log(`Number of transactions with >= 2 Swap events: ${count}`);
}


async function main_read_cache() {
  receiptsCacheJSON = JSON.parse(fs.readFileSync(receiptsCacheFilePath));
  let count = 0;
  for (const hash in receiptsCacheJSON) {
    const isArbitrage = await getArbitrage(receiptsCacheJSON[hash]);
    if (isArbitrage) {
      //console.log(hash);
      count++;
    }
  }
  console.log(`Number of transactions with >= 2 Swap events: ${count}`);
}

// Call the main function
init();