# Data collection

The "searcher-alchemy.js" is the main script for data collection. It uses "alchemy-sdk" to retrieve data and a custom detection algorithm based on the cycle-detection graph problem in order to identify arbitrage transactions on Ethereum and some layer 2 blockchains: Arbitrum, Polygon and Optimism.

## Usage

To run the script use the following command:
```sh
node searcher-alchemy <blockchain_name> <optional = analyze/filter>
```
There are one mandatory and one optional parameter.
- **blockchain_name**: One of the 4 blockchains analyzed (ethereum, arbitrum, polygon, optimism).
- **optional**: Blank for simply collecting data from the API; "analyze" for running the cycle-based analysis on collected data to get the number of arbitrage transactions. "filter" same as "analyze" but also splits the transactions into arbitrage and non arbitrage transactions writing to 2 files for further analysis.

## Usage Examples:
```sh
node searcher-alchemy -ethereum
node searcher-alchemy -arbitrum -analyze
node searcher-alchemy -polygon -filter
```

**Note**: When running the script without any optional parameters for the first time, the following directory structure will be created.

```bash
./cache/
│
├── arbitrum/
│   ├── filtered/...
│   ├── receipts.json
│   └── receiptsNonArbitrage.json
│
├── ethereum/
│   ├── filtered/...
│   ├── receipts.json
│   └── receiptsNonArbitrage.json
│
├── optimism/
│   ├── filtered/...
│   ├── receipts.json
│   └── receiptsNonArbitrage.json
│
└── polygon/
    ├── filtered/...
    ├── receipts.json
    └── receiptsNonArbitrage.json
```