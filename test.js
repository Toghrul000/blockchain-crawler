const { ethers } = require('ethers');
require('dotenv').config();

// Alchemy API endpoint and API key
const alchemyApiKey = process.env.ALCHEMY_API_KEY;
const alchemyUrl = 'https://eth-mainnet.g.alchemy.com/v2/' + "alchemy-replit"; //+ alchemyApiKey;


// Set up ethers.js provider using Alchemy
const provider = new ethers.providers.JsonRpcProvider(alchemyUrl);

//const transactionHash = '0xb72689042f313adbffbe4d192b0febc4c8a8346b75a549d5b4d4795b37180488';
const transactionHash = '0xa9df2fd3e89ea91323b7a984f0ac93c210e9e9ed19a3bd1e1aea82b33533c3f9';

 
async function getSwapEvents(txHash) {
  const receipt = await provider.getTransactionReceipt(txHash);

  const swapEventSignatures = [
    ethers.utils.id('Swap(address,uint256,uint256,uint256,uint256,address)'),
    ethers.utils.id('Swap(address,address,int256,int256,uint160,uint128,int24)'),
    ethers.utils.id('Trade(address,address,address,uint256,uint256,uint256,bytes)'),
    ethers.utils.id('TransformedERC20(address,address,address,uint256,uint256)'),
    ethers.utils.id('Conversion(address,address,address,uint256,uint256,int256)'),
    ethers.utils.id('Conversion(address,address,address,uint256,uint256,address)'),
    ethers.utils.id('Swap(bytes32,address,address,uint256,uint256)'),
    ethers.utils.id('Swap(address,uint256,uint256,uint256,uint256,address)'),
    ethers.utils.id('Swapped(address,address,address,address,uint256,uint256,uint256,uint256,uint256,address)'),
    ethers.utils.id('LOG_SWAP(address,address,address,uint256,uint256)'),
    ethers.utils.id('Swapped(address,address,address,address,uint256,uint256)'),
  ];

  const swapEvents = receipt.logs.filter((log) => {
    // Match the event signature to the Swap event
    return swapEventSignatures.includes(log.topics[0]);
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
    //console.log(transferEvents);

    // Decode and format the transfer events
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
  } catch (error) {
    console.error('Error:', error);
  }

  
}

function removeLeadingZeros(paddedAddress) {
  // Remove '0x' prefix if present
  if (paddedAddress.startsWith('0x')) {
      paddedAddress = paddedAddress.slice(2);
  }

  // Remove leading zeros
  while (paddedAddress.length > 40 && paddedAddress.startsWith('0')) {
      paddedAddress = paddedAddress.slice(1);
  }

  // Add back '0x' prefix
  return '0x' + paddedAddress;
}

async function isCycle(txHash){
  const swapEvents = await getSwapEvents(txHash);
  const ExchangeAddresses = []
  for (sw of swapEvents) {
    //console.log(sw.address);
    if (!ExchangeAddresses.includes(sw.address)) {
      ExchangeAddresses.push(sw.address.toLowerCase());
    }
  }

  //console.log(ExchangeAddresses)
  const transfers = await getErc20Transfers(txHash);
  const prevs = [];
  for(tx of transfers) {
    for(prev of prevs){
      //console.log(prev);
      if(prev.from === tx.to && tx.tokenAddress === prev.tokenAddress  && tx.amount > prev.amount && !ExchangeAddresses.includes(removeLeadingZeros(prev.from))){
        console.log("current prev: ", prev);
        console.log("current prev: ", parseInt(prev.amount, 16));
        console.log("current tx: ", tx);
        console.log("current tx: ", parseInt(tx.amount, 16));
 
        console.log(tx.amount > prev.amount);
        return true;
      }
      
    }
    prevs.push(tx);
  }

}


async function main(){

  await isCycle(transactionHash);
  // console.log(ethers.utils.id('Swap(address,uint256,uint256,uint256,uint256,address)')) //uniswapv2
  // console.log(ethers.utils.id('Swap(address,address,int256,int256,uint160,uint128,int24)')) //uniswapv3
  // console.log(ethers.utils.id('Trade(address,address,address,uint256,uint256,uint256,bytes)'))//cowswap
  // console.log(ethers.utils.id('TransformedERC20(address,address,address,uint256,uint256)'))//0xExchange
  // console.log(ethers.utils.id('Conversion(address,address,address,uint256,uint256,int256)'))//bancor
  // console.log(ethers.utils.id('Conversion(address,address,address,uint256,uint256,address)'))//bancor
  // console.log(ethers.utils.id('Swap(bytes32,address,address,uint256,uint256)'))//balancer
  // console.log(ethers.utils.id('Swap(address,uint256,uint256,uint256,uint256,address)'))//ubeswap in celo
  // console.log(ethers.utils.id('Swapped(address,address,address,address,uint256,uint256,uint256,uint256,uint256,address)'))//1inch swap
  // console.log(ethers.utils.id('LOG_SWAP(address,address,address,uint256,uint256)'))//balancer mpl usdc swap
  // console.log(ethers.utils.id('Swapped(address,address,address,address,uint256,uint256)'))//Firebird Finance

  // console.log(ethers.utils.id('SwappedV3(bytes16,address,uint256,address,address,address,address,uint256,uint256,uint256)'))//paraswap swappedV3 aggregator
  // console.log(ethers.utils.id('SwappedDirect(bytes16,address,uint256,address,uint8,address,address,address,uint256,uint256,uint256)'))//paraswap swappedDirect aggregator





}
main();
