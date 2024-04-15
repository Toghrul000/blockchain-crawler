import json
import matplotlib.pyplot as plt
from eth_abi.exceptions import NonEmptyPaddingBytes


def get_erc20_transfers(receipt):
    transfer_events = receipt.get('logs', [])  # Using .get() to avoid KeyError if 'logs' is missing
    transfers = []
    for log in transfer_events:
        if len(log["topics"]) == 0:
            continue
        if log["topics"][0] != "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef":
            continue
        try:
            token_address = log['address']

            amount = int(log['data'], 16)

            transfer_event = {
                'tokenAddress': token_address,
                'amount': amount
            }
            transfers.append(transfer_event)
        except IndexError:
            continue  # Continue to the next iteration of the loop if an IndexError occurs
        except NonEmptyPaddingBytes:
            continue
        except ValueError:
            continue

    return transfers


def parse_transactions(json_file):
    transactions = []

    with open(json_file, 'r') as f:
        data = json.load(f)

        for tx_hash, tx_info in data.items():
            transaction = {
                "transactionHash": tx_info["transactionHash"],
                "from": tx_info["from"],
                "to": tx_info["to"],
                "logs": tx_info["logs"],
                "blockNumber": tx_info["blockNumber"],
                "gasUsed": tx_info["gasUsed"]["hex"],
                "cumulativeGasUsed": tx_info["cumulativeGasUsed"]["hex"],
                "effectiveGasPrice": tx_info["effectiveGasPrice"]["hex"],
                "status": tx_info["status"],
                "type": tx_info["type"],
                "byzantium": tx_info["byzantium"]
            }
            transactions.append(transaction)

    return transactions


# Function that calculates the average gas set spend accross a set of transactions.
def calculate_average_gas_spent(transactions):
    total_gas_cost = 0

    for transaction in transactions:
        # Convert hex values to integers for calculation
        gas_used = int(transaction["gasUsed"], 16)
        effective_gas_price = int(transaction["effectiveGasPrice"], 16)

        # Calculate gas cost
        gas_cost = gas_used * effective_gas_price
        total_gas_cost += gas_cost

    # Calculate average gas spent
    num_transactions = len(transactions)
    if num_transactions > 0:
        average_gas_spent = total_gas_cost / num_transactions
    else:
        average_gas_spent = 0

    return average_gas_spent


# Function that creates a bar chart
def bar_chart_dict(dict, chart_name):
    # Extract keys and values from the dictionary
    labels = list(dict.keys())
    short_labels = [label[:2] + '..' + label[-2:] for label in labels]
    values = list(dict.values())
    plt.bar(short_labels, values)

    # Add labels and title
    plt.xlabel('Token address')
    plt.ylabel('Number of transactions')
    plt.title(chart_name)

    # Display the plot
    plt.show()


def percentage_analysis(arb_transactions_1, normal_transactions_1, arb_transactions_2, normal_transactions_2,
                        arb_transactions_3, normal_transactions_3, arb_transactions_4, normal_transactions_4):
    arb_transact_percentage = {}

    print("len(arb_transactions_1): " + str(len(arb_transactions_1)))
    print("len(normal_transactions_1): " + str(len(normal_transactions_1)))
    print("percentage of transaction set 1 arbitrage: " + str((len(arb_transactions_1) / len(normal_transactions_1))
                                                              * 100) + "\n")

    arb_transact_percentage["Ethereum"] = (len(arb_transactions_1) + len(normal_transactions_1))

    print("len(arb_transactions_2): " + str(len(arb_transactions_2)))
    print("len(normal_transactions_2): " + str(len(normal_transactions_2)))
    print("percentage of transaction set 2 arbitrage: " + str(
        (len(arb_transactions_2) / len(normal_transactions_2)) * 100))

    arb_transact_percentage["Polygon"] = (len(arb_transactions_2) + len(normal_transactions_2))

    print("len(arb_transactions_3): " + str(len(arb_transactions_3)))
    print("len(normal_transactions_3): " + str(len(normal_transactions_3)))
    print("percentage of transaction set 3 arbitrage: " + str((len(arb_transactions_3) / len(normal_transactions_3))
                                                              * 100) + "\n")

    arb_transact_percentage["Arbitrum"] = (len(arb_transactions_3) + len(normal_transactions_3))

    print("len(arb_transactions_4): " + str(len(arb_transactions_4)))
    print("len(normal_transactions_4): " + str(len(normal_transactions_4)))
    print("percentage of transaction set 4 arbitrage: " + str(
        (len(arb_transactions_4) / len(normal_transactions_4)) * 100))

    arb_transact_percentage["Optimism"] = (len(arb_transactions_2) + len(normal_transactions_2))

    labels = list(arb_transact_percentage.keys())
    values = list(arb_transact_percentage.values())

    # Define colors for each bar
    color = ['lightblue', 'blue', 'purple', 'red', 'black']

    # Create bars
    fig, ax = plt.subplots()
    ax.bar(labels, values,
           color=color)

    # Add labels and title
    plt.xlabel('Blockchain name')
    plt.ylabel('Number of transactions')
    plt.title("Number of transaction of blockchain")

    # Display the plot
    plt.show()


# Function that calculates the basic statistics in regard to the transactions from a blockchain
def transaction_count(arb_transactions, normal_transactions, block_chain):
    # Count nr of transactions
    print(f"nr of arbitrage transactions in {block_chain}: {len(arb_transactions)}")
    print(f"nr of normal transactions in {block_chain}: {len(normal_transactions)}")
    print(f"percentage of transactions in {block_chain} that is arbitrage: "
          f"{(len(arb_transactions) / len(normal_transactions)) * 100}")


# Function that counts the number of sender addresses in a blockchain and calculates the most active addresses
def address_analysis(arb_transactions, block_chain):
    unique_addresses = []
    # Count nr of unique from addresses
    for transactions in arb_transactions:
        if transactions["from"] not in unique_addresses:
            unique_addresses.append(transactions["from"])
    print(f"nr of unique from addresses in {block_chain}: {len(unique_addresses)}")

    # Transactions per address
    address_count = {}
    for transactions in arb_transactions:
        if transactions["from"] not in address_count.keys():
            address_count[transactions["from"]] = 1
        else:
            address_count[transactions["from"]] += 1

    # Sort the dictionary by values in descending order
    sorted_data = sorted(address_count.items(), key=lambda x: x[1], reverse=True)
    # Take the top 30 keys
    top_30_keys = dict(sorted_data[:10])
    # print("Top 30 keys 1: ", top_30_keys_1)
    print(f"Top 10 nr of Transactions per address in {block_chain}: {top_30_keys}")
    # Calculate the total count and number of keys
    total_count = sum(top_30_keys.values())
    total_keys = len(top_30_keys)
    # Calculate the average count
    average_count = total_count / total_keys
    print(f"Average nr of Transactions for top 30 of address: {average_count}")


# Function that calculates the number of sender addresses that can be found in two blockchains
def address_intersection(arb_transactions_1, block_chain_1, arb_transactions_2, block_chain_2):
    unique_addresses_1 = []
    # Count nr of unique from addresses
    for transactions in arb_transactions_1:
        if transactions["from"] not in unique_addresses_1:
            unique_addresses_1.append(transactions["from"])

    # Transactions per address
    address_count_1 = {}
    for transactions in arb_transactions_1:
        if transactions["from"] not in address_count_1.keys():
            address_count_1[transactions["from"]] = 1
        else:
            address_count_1[transactions["from"]] += 1

    unique_addresses_2 = []
    # Count nr of unique from addresses
    for transactions in arb_transactions_2:
        if transactions["from"] not in unique_addresses_1:
            unique_addresses_2.append(transactions["from"])

    # Transactions per address
    address_count_2 = {}
    for transactions in arb_transactions_2:
        if transactions["from"] not in address_count_2.keys():
            address_count_2[transactions["from"]] = 1
        else:
            address_count_2[transactions["from"]] += 1

    # Get the keys of each dictionary
    keys1 = set(address_count_1.keys())
    keys2 = set(address_count_2.keys())

    # Find the intersection of keys
    common_keys = keys1.intersection(keys2)

    # Convert the intersection set to a list
    common_keys_list = list(common_keys)

    print(f"Nr of common addresses between {block_chain_1} and {block_chain_2}: {len(common_keys_list)}")


# Function that calculates the distribution of transactions among token addresses in a blockchain
def token_distribution_analysis(arb_transactions, block_chain):
    unique_address_token = {}
    for arb_trans in arb_transactions:
        tokens = get_erc20_transfers(arb_trans)
        for token in tokens:
            if token["tokenAddress"] not in unique_address_token.keys():
                unique_address_token[token["tokenAddress"]] = 1
            else:
                unique_address_token[token["tokenAddress"]] += 1
    unique_address_token_filtered_1 = {key: value for key, value in unique_address_token.items() if value > 10}
    # Sort the dictionary based on values in descending order
    sorted_dict_token_1 = dict(sorted(unique_address_token_filtered_1.items(), key=lambda x: x[1], reverse=True))

    # Select the top 10 items
    top_10_token_1 = dict(list(sorted_dict_token_1.items())[:10])
    print(f"Addresses of top 10 most common tokens in {block_chain}: {top_10_token_1.keys()}")
    print(f"Number of unique token addresses in {block_chain}: {top_10_token_1.keys()}")
    print(f"\n")

    print(len(unique_address_token_filtered_1))
    # print(unique_address_token_filtered)
    bar_chart_dict(top_10_token_1, f"{block_chain} token distribution")


if __name__ == '__main__':
    
    # Please change the input for the function parse_transactions to the path of the respective files on your machine
    arb_transactions_eth = parse_transactions("receiptsCache_ETHEREUM_ARBITRAGE.json")
    normal_transactions_eth = parse_transactions("receiptsCache_ETHEREUM_NON_ARBITRAGE.json")

    arb_transactions_pol = parse_transactions("receiptsCache_POLYGON_ARBITRAGE.json")
    normal_transactions_pol = parse_transactions("receiptsCache_POLYGON_NON_ARBITRAGE.json")

    arb_transactions_ar = parse_transactions("arbitrum_cache/receiptsCache_ARBITRUM_ARBITRAGE.json")
    normal_transactions_ar = parse_transactions("arbitrum_cache/receiptsCache_ARBITRUM_NON_ARBITRAGE.json")

    arb_transactions_opt = parse_transactions("optimism_cache/receiptsArbitrage.json")
    normal_transactions_opt = parse_transactions("optimism_cache/receiptsNonArbitrage.json")

    print("\n--------------------------------Transaction basic numbers-------------------------------------\n")

    transaction_count(arb_transactions_eth, normal_transactions_eth, "Ethereum")
    print("\n")
    transaction_count(arb_transactions_pol, normal_transactions_pol, "Polygon")
    print("\n")
    transaction_count(arb_transactions_ar, normal_transactions_ar, "Arbitrum")
    print("\n")
    transaction_count(arb_transactions_opt, normal_transactions_opt, "Optimism")

    print("\n--------------------------------Transaction addresses-------------------------------------\n")

    address_analysis(arb_transactions_eth, "Ethereum")
    print("\n")
    address_analysis(arb_transactions_pol, "Polygon")
    print("\n")
    address_analysis(arb_transactions_ar, "Arbitrum")
    print("\n")
    address_analysis(arb_transactions_opt, "Optimism")

    print("\n--------------------------------Transaction addresses seen in multipple "
          "blockchains-------------------------------------\n")

    address_intersection(arb_transactions_eth, "Ethereum", arb_transactions_pol, "Polygon")
    address_intersection(arb_transactions_eth, "Ethereum", arb_transactions_ar, "Arbitrum")
    address_intersection(arb_transactions_eth, "Ethereum", arb_transactions_opt, "Optimism")
    print("\n")
    address_intersection(arb_transactions_pol, "Polygon", arb_transactions_ar, "Arbitrum")
    address_intersection(arb_transactions_pol, "Polygon", arb_transactions_opt, "Optimism")
    print("\n")
    address_intersection(arb_transactions_ar, "Arbitrum", arb_transactions_opt, "Optimism")

    print("\n--------------------------------Gas spent-------------------------------------\n")

    # Transaction cost comparison
    print("Average gas spent per transaction in Ethereum: " + str(calculate_average_gas_spent(arb_transactions_eth)))
    print("Average gas spent per transaction in Polygon: " + str(calculate_average_gas_spent(arb_transactions_pol)))
    print("Average gas spent per transaction in Arbitrum: " + str(calculate_average_gas_spent(arb_transactions_ar)))
    print("Average gas spent per transaction in Optimism: " + str(calculate_average_gas_spent(arb_transactions_opt)))

    print("\n--------------------------------Token distribution-------------------------------------\n")

    token_distribution_analysis(arb_transactions_eth, "Ethereum")
    token_distribution_analysis(arb_transactions_pol, "Polygon")
    token_distribution_analysis(arb_transactions_ar, "Arbitrum")
    token_distribution_analysis(arb_transactions_opt, "Optimism")
