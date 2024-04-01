const { Alchemy, Network, Utils, fromHex } = require("alchemy-sdk");
require('dotenv').config();
const fs = require('fs');

const alchemyApiKey = process.env.ALCHEMY_API_KEY;
const config = {
  apiKey: alchemyApiKey,
  network: Network.ETH_MAINNET,
};
const alchemy = new Alchemy(config);

const transactionHashes = [
    "0xa7ad545ebd2fff8c2632a796e2086ec73380a9e0241c1308141b68a695e58786",
    "0x71ac0ae5d68cf7dcd9a788f7e96a32edf8d46e91910887ae88059d944d9373e8",
    // "0x8c3ea281e81c1e449ec3a1d1cce1cc968f667311cb2b4d4ed29bf152905b1c4a",
    // "0x6593c8f5b481068d1421b56d11c870fa05bb20e59efac89903ed45941093dc8c",
    // "0xa999cc21d205807b666bc599015a1eb9b6a30a0d6aaa1b089df65ad8ab7f810f",
    // "0x18491422dd980d099b0773f3fcaf7850f16af9efcf083afd3959823d5030631d",
    // "0xea1c06fe42cb6db794da7b087982f5e0377461eaa1ee4f57e70e70fb9884169e",
    // "0x1d1964e1eef323260e58efd0644bd3e05d459c868c6c195386c7f15e5580089a",
    // "0x1c850c58637373fba67070a1c68a4d0b12ce06534a41814ab69be5ef6e39fd4f",
    // "0x2f7ebdc62d92b7339d469c20e9d0a4f7b113af076949445a4a33419c72b24fe3",
    // "0xc811c88bda4870c65b8bd45a3d260a769ea0437b68a48f5668f99ecc33204e35",
    // "0x1bc334ca572c8f9ae92551baa330f954adb814903d183edec11515d0c4742158",
    // "0x14e366a2570779971329dcce011a69d94f8ba0a3e97f6878d8bba693e766e9fe",
    // "0xbecd91fed6f09b6178fe8a734869a25a4452678d4ead4b335dfcadc1a92b8a86",
    // "0x8f68d43522be83fb68e7941b91413f67242bbf8d3778e21739e0264655008520",
    // "0x98cf50316f48d74e4e0a6071fa7d170b4a350cf99d0b6041ca43a2aa5dc8dd8b",
    // "0x71bcb97ab529699ea80ae24556d6c0a24748526eafc78383a5447bc827128619",
    // "0x19fb782b72471a2508d977201e5ff9123db9c45d5b20d43d3ae7b9a238440108",
    // "0xa8f759dd87ced31ef12f0eddb7df2b9acc03393ff6b36f8f693d33edf5a9b502",
    // "0xe1d1e8bbaed40fcbbdd57409579502e2ce4c95513c40128d309c10b96876d792",
    // "0xfc4a31ee1a98efb458731caec78a10908682f277c976d55aea2c5557a9e05061"
];


async function fetchReceipts() {
    let transactionsReceiptToSave = {};
    try {
        const promises = transactionHashes.map(async (hash) => {
         
            const receipt = await alchemy.core.getTransactionReceipt(hash);
            console.log(receipt)
            transactionsReceiptToSave[hash] = receipt;
            //return receipt;
            

        });

        const results = await Promise.allSettled(promises);
        results.forEach(result => {
          if (result.status !== 'fulfilled') {
            errnum++;
            let requestBody = JSON.parse(result.reason.requestBody);
            let hashError = requestBody.params[0];
            console.log(`Error ${hashError}. code: ${result.reason.code}, reason: ${result.reason.reason}`);
  
          }
        })
        
    } catch (error) {
        console.error("An error occurred during the process:", error.message);
    } finally {
        console.log("Receipts array");

        // Writing length of receipts array to a text file
        fs.writeFileSync("./cache2/file.json", JSON.stringify(transactionsReceiptToSave));
    }
}

fetchReceipts();

// const receiptsCacheFilePath = './cache/formatted_receipts.json';
// let receiptsCacheJSON = {};

// // Helper function to read from receipts cache
// function readFromReceiptsCache(txHash) {
//   if (!fs.existsSync(receiptsCacheFilePath)) {
//     return null;
//   }

//   if (Object.keys(receiptsCacheJSON).length == 0) {
//     const cacheData = fs.readFileSync(receiptsCacheFilePath);
//     receiptsCacheJSON = JSON.parse(cacheData);
//     console.log(Object.keys(receiptsCacheJSON).length);
//   }

//   return receiptsCacheJSON[txHash] || null;
// }

// // Example usage
// const exampleTxHash = "0xec384dae524bc54989754f05e1a4ee068cd61081806eb43f4386627fbf439d0d";
// const receipt = readFromReceiptsCache(exampleTxHash);
// console.log("Receipt for transaction", exampleTxHash + ":", receipt);


