const { Alchemy, Network, Utils, fromHex } = require("alchemy-sdk");
require('dotenv').config();

const fs = require('fs');

const cacheFilePath = './cache/transfersCache1.json';
const receiptsCacheFilePath = './cache/receiptsCache1.json';

let receiptsCacheJSON = {};

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
  if (!fs.existsSync(receiptsCacheFilePath)) {
    return null;
  }

  if (!receiptsCacheJSON) {
    const cacheData = fs.readFileSync(receiptsCacheFilePath);
    receiptsCacheJSON = JSON.parse(cacheData);
  }

  return receiptsCacheJSON[txHash] || null;
}

// Helper function to write to receipts cache given an object of receipts
function writeAllToReceiptsCache(listOfReceipts) {
  if (!receiptsCacheJSON && fs.existsSync(receiptsCacheFilePath)) {
    receiptsCacheJSON = JSON.parse(fs.readFileSync(receiptsCacheFilePath));
  }
  for (hash in listOfReceipts) {
    receiptsCacheJSON[hash] = listOfReceipts[hash];
  }

  fs.writeFileSync(receiptsCacheFilePath, JSON.stringify(receiptsCacheJSON));
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

  const startBlock = "0x1291B24";
  const endBlock = "0x1291C36";

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
  const ExchangeAddresses = []
  for (sw of swapEvents) {
    if (!ExchangeAddresses.includes(sw.address)) {
      ExchangeAddresses.push(sw.address.toLowerCase());
    }
  }

  const firstCheck = await isCycle(receipt, ExchangeAddresses);
  const secondCheck = ExchangeAddresses.length >= 2;

  if (firstCheck && secondCheck) {
    return true;
  } else {
    return false;
  }

}

async function main() {

  let transactionsHash = await getTransactionsInRange();

  let transactionsReceipt = {};
  let transactionsReceiptToSave = {};
  console.time();
  try {
    for (let i = 0; i < transactionsHash.length; i++) {
      let receipt = readFromReceiptsCache(transactionsHash[i]);
      if (!receipt) {
        receipt = await alchemy.core.getTransactionReceipt(transactionsHash[i]);
        transactionsReceiptToSave[transactionsHash[i]] = receipt;
      }
      transactionsReceipt[transactionsHash[i]] = receipt;
    }
  } catch (error) {
    console.log(error);
  } finally {
    console.timeEnd();
    // Writing missing transactions receipt in the cache
    writeAllToReceiptsCache(transactionsReceiptToSave);
  }

  let count = 0;
  for (hash in transactionsReceipt) {
    const swapEvents = await getSwapEvents(transactionsReceipt[hash]);
    //const isFlashloaned = await possibleFlashloan(transactionsReceipt[hash]);
    const isArbitrage = await getArbitrage(transactionsReceipt[hash]);
    if (swapEvents.length >= 2 && isArbitrage) {
      console.log(hash);
      count++;
    }
  }
  console.log(`Number of transactions with >= 2 Swap events: ${count}`);
}

// Call the main function
main().catch(err => console.error(err));
