const { Alchemy, Network, Utils } = require("alchemy-sdk");
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


const config = {
  apiKey: "alchemy-replit",
  network: Network.ETH_MAINNET,
};
const alchemy = new Alchemy(config);

async function getTransactionsInRange() {

    const WTH = "0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2";
    const WBTC = "0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599";

    const startBlock = "0x129155C";
    const endBlock = "0x1291560";

    const cachedTransactions = readFromCache();
    if (cachedTransactions && cachedTransactions.startBlock === startBlock && cachedTransactions.endBlock === endBlock) {
        // /console.log(cachedTransactions);
        
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

//TODO: cache this
async function getSwapEvents(txHash){
    const receipt = await alchemy.core.getTransactionReceipt(txHash);
    const swapEvents = receipt.logs.filter((log) => {
      // Match the event signature to the Swap event
      return log.topics[0] === Utils.id('Swap(address,uint256,uint256,uint256,uint256,address)');
    });
    return swapEvents.length; 
  }

async function main() {
    // Example usage

    const transfers = await getTransactionsInRange();
    //console.log(transfers);
    let count = 0;

    for (let i = 0; i < transfers.length; i++) {
        const swapEventCount = await getSwapEvents(transfers[i].hash);
        if (swapEventCount >= 2) {
            //console.log(transfers[i]);
            //console.log(count);
            count++;
        }
    }
    console.log(`Number of transactions with >= 2 Swap events: ${count}`);
}

// Call the main function
main().catch(err => console.error(err));
