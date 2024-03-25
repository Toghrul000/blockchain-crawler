const { ethers } = require('ethers');
require('dotenv').config();

// Alchemy API endpoint and API key
const alchemyApiKey = process.env.ALCHEMY_API_KEY;
const alchemyUrl = 'https://eth-mainnet.g.alchemy.com/v2/' + "alchemy-replit"; //+ alchemyApiKey;


// Set up ethers.js provider using Alchemy
const provider = new ethers.providers.JsonRpcProvider(alchemyUrl);

//const transactionHash = '0xb72689042f313adbffbe4d192b0febc4c8a8346b75a549d5b4d4795b37180488';
const transactionHash = '0xea5f0c69b5126c83aa2536f33b611c9f9f477850da133bcf433fabed3ec747de';

 
async function getSwapEvents(txHash) {
  const receipt = await provider.getTransactionReceipt(txHash);

  const swapEvents = receipt.logs.filter((log) => {
    // Match the event signature to the Swap event
    return log.topics[0] === ethers.utils.id('Swap(address,uint256,uint256,uint256,uint256,address)');
  });

  return swapEvents;
}

// Function to get and display ERC20 token transfers
async function getErc20Transfers(txHash) {
  try {
    // Get the transaction receipt
    const receipt = await provider.getTransactionReceipt(txHash);


    // Filter ERC20 Transfer events
    const transferEvents = receipt.logs.filter(log =>
      log.topics[0] === ethers.utils.id('Transfer(address,address,uint256)')
    );
    console.log(transferEvents);

    // Decode and format the transfer events
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
      console.log(transferEvent);
    });
  } catch (error) {
    console.error('Error:', error);
  }
}


async function main(){
  console.log("Test");

}
main();
