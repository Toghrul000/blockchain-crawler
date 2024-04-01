const { Alchemy, Network, Utils, fromHex } = require("alchemy-sdk");
require('dotenv').config();

const fs = require('fs');

const cacheFilePath = './cache/transfersCache1.json'; //TEMPLATE CACHE FOLDER
const receiptsCacheFilePath = './cache/receiptsCache1.json';//TEMPLATE CACHE FOLDER

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



// Alchemy API endpoint and API key
const alchemyApiKey = process.env.ALCHEMY_API_KEY;
const config = {
  apiKey: alchemyApiKey,
  network: Network.ETH_MAINNET,
};
const alchemy = new Alchemy(config);

async function getTransactionsInRange() {

  const WTH = "0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2";

  const startBlock = "0x1291C36";//19471414 
  const endBlock = "0x12937B2"; //19478450

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

async function main_read_cache(){

  receiptsCacheJSON = JSON.parse(fs.readFileSync(receiptsCacheFilePath));
  let arbitragesObject = {};
  let non_arbitragesObject = {};

  let count = 0;
  for (const hash in receiptsCacheJSON) {
    const receipt = receiptsCacheJSON[hash]; // receipt
    const isArbitrage = await getArbitrage(receiptsCacheJSON[hash]);
    if (isArbitrage) {
      //console.log(hash);
      //write to arbitrage file
      count++;
      arbitragesObject[hash] = receipt;

    } else {
      //write to non-file
      non_arbitragesObject[hash]=receipt;
    }
  }
  fs.writeFileSync("./cache/receiptsCache_ETHEREUM_ARBITRAGE.json", JSON.stringify(arbitragesObject));
  fs.writeFileSync("./cache/receiptsCache_ETHEREUM_NON_ARBITRAGE.json", JSON.stringify(non_arbitragesObject));


  console.log(`Number of transactions with >= 2 Swap events: ${count}`);

}

main_read_cache().catch(err => console.error(err));