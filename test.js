const { ethers } = require('ethers');
require('dotenv').config();

// Alchemy API endpoint and API key
const alchemyApiKey = process.env.ALCHEMY_API_KEY;
const alchemyUrl = 'https://eth-mainnet.g.alchemy.com/v2/' + alchemyApiKey;

// Set up ethers.js provider using Alchemy
const provider = new ethers.providers.JsonRpcProvider(alchemyUrl);

const transactionHash = '0xb72689042f313adbffbe4d192b0febc4c8a8346b75a549d5b4d4795b37180488';

// The ERC20 token contract ABI
const erc20Abi = [
    // Only include the Transfer event ABI
    "event Transfer(address indexed from, address indexed to, uint256 amount)"
];

// Function to get and display ERC20 token transfers
async function getErc20Transfers(txHash) {
  try {
    // Get the transaction receipt
    const receipt = await provider.getTransactionReceipt(txHash);
    console.log(receipt.logs);

    // Filter ERC20 Transfer events
    const transferEvents = receipt.logs.filter(log => 
      log.topics[0] === ethers.utils.id('Transfer(address,address,uint256)')
    );

    // Decode and format the transfer events
    transferEvents.forEach(log => {
      const iface = new ethers.utils.Interface(erc20Abi);
      const event = iface.parseLog(log);
      console.log(event);

      console.log(`Token Transfer:
        From: ${event.args.from},
        To: ${event.args.to},
        Amount: ${event.args.amount.toString()}
      `);
    });
  } catch (error) {
    console.error('Error:', error);
  }
}

// Call the function with your transaction hash
//getErc20Transfers(transactionHash);


async function getSwapEvents(txHash){
  const receipt = await provider.getTransactionReceipt(txHash);
  const swapEvents = receipt.logs.filter((log) => {
    // Match the event signature to the Swap event
    return log.topics[0] === ethers.utils.id('Swap(address,uint256,uint256,uint256,uint256,address)');
  });
  return swapEvents.length; 
}

//getSwapEvents(transactionHash);
async function main(){
  console.log(await getSwapEvents("0x214edf46725f415bf699eabe20094f6c13b72263952e3432ad9fa50312320679"));

}
main();
