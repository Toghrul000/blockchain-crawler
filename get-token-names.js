/**
 * This script retrieves the names of the tokens addresses provided.
 */

const { Alchemy, Network, Utils, fromHex } = require("alchemy-sdk");
require('dotenv').config();
const fs = require('fs');

// Modify path to list of token addresses based on the desired token according to .env file!
const TOKEN_ADDRESS_PATH = process.env.OPTIMISM_TOKEN_ADDRESSES;
// Modify path to new file with token names according to .env file!
const TOKEN_NAMES_PATH = process.env.OPTIMISM_TOKEN_NAMES;

const alchemyApiKey = process.env.ALCHEMY_API_KEY;
const config = {
  apiKey: alchemyApiKey,
  network: process.env.OPTIMISM_NETWORK,
};

const alchemy = new Alchemy(config);

async function main() {
  if (!fs.existsSync(TOKEN_ADDRESS_PATH)) {
    console.log("No addresses found!");
    return;
  }

  const tokenList = JSON.parse(fs.readFileSync(TOKEN_ADDRESS_PATH));

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
  
  fs.writeFileSync(TOKEN_NAMES_PATH, JSON.stringify(tokensOutput));
  console.log("Finished writing " + tokensOutput.names.length + " token names");
}

main().catch(err => console.error(err));