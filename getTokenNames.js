const { Alchemy, Network, Utils, fromHex } = require("alchemy-sdk");
require('dotenv').config();
const fs = require('fs');

const tokenList = JSON.parse(fs.readFileSync(process.env.ETHEREUM_TOKEN_ADDRESSES));

const alchemyApiKey = process.env.ALCHEMY_API_KEY;
const config = {
  apiKey: alchemyApiKey,
  network: process.env.ETHEREUM_NETWORK,
};

const alchemy = new Alchemy(config);

async function main() {

  let tokensOutput = {
    names: []
  };

  console.log("Starting processing " + tokenList.addresses.length + " token addresses");
  for (tokenAddress of tokenList.addresses) {
    try {
      // Print token metadata of USDC
      let res = await alchemy.core.getTokenMetadata(tokenAddress);
      if (res.name) {
        tokensOutput.names.push(res.name);
      }
    } catch (error) {
      console.log(error.body);
    }
  }
  
  fs.writeFileSync(process.env.ETHEREUM_TOKEN_NAMES, JSON.stringify(tokensOutput));
  console.log("Finished writing " + tokensOutput.names.length + " token names");
}

main().catch(err => console.error(err));