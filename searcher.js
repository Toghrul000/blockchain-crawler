const { ethers } = require('ethers');
require('dotenv').config();

// Alchemy API endpoint and API key
const alchemyApiKey = process.env.ALCHEMY_API_KEY;
const alchemyUrl = 'https://eth-mainnet.g.alchemy.com/v2/' + alchemyApiKey;

// Set up ethers.js provider using Alchemy
const provider = new ethers.providers.JsonRpcProvider(alchemyUrl);

const startTime = 1709285081; //Fri Mar 01 2024 10:24:41 GMT+0100 (Central European Standard Time)
const endTime = 1710754802; // Mon Mar 18 2024 10:40:02 GMT+0100 (Central European Standard Time)

// Get block numbers for the specified timeframe
async function getBlockNumbersInRange() {
    const startBlock = await provider.getBlockNumber(startTime);
    const endBlock = await provider.getBlockNumber(endTime);
    return { startBlock, endBlock };
}

// Fetch transactions for each block within the specified timeframe
async function getTransactionsInRange() {
    const { startBlock, endBlock } = await getBlockNumbersInRange();
    const transactions = [];

    for (let i = startBlock; i <= endBlock; i++) {
        const block = await provider.getBlockWithTransactions(i);
        transactions.push(...block.transactions);
    }

    return transactions;
}

const exchanges = []
const mainToken = 0;
const WETH = 0;

async function main() {
    // Example usage
    getTransactionsInRange().then(transactions => {
        console.log("Transactions within the specified timeframe:", transactions);
    }).catch(error => {
        console.error("Error fetching transactions:", error);
    });
}

// Call the main function
main().catch(err => console.error(err));






















