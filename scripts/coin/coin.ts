import { readConfig, parseAccount, getNodeUrl, unitToOctas } from "../common";
import { AptosAccount } from "aptos";
import { CoinClient } from "../client";
import { readContract, writeContract } from "../utils/resource";

let config = readConfig();
let network = process.argv[2];
let nodeUrl = getNodeUrl(network);
let deployer = parseAccount(config, "default");
console.log("nodeUrl", nodeUrl);
console.log("----------------------------");

async function mintTo(coinType: string, user: AptosAccount, amount: number) {
    const client = new CoinClient(nodeUrl, coinType);
    if (!(await client.isRegistered(user.address()))) {
        await client.register(user);
    }
    console.log(`balance: ${await client.getBalance(user.address())}`);
    await client.mint(deployer, user.address(), amount);
    console.log(`balance: ${await client.getBalance(user.address())}`);
}

async function main() {
    await deploy();
    // await verify();
}
async function verify() {
    let harwCoin = "0x815401357d501dc73b084399f692f942eec25a2fc9f2795cb073a3df6330626f::HARW::T";
    let usdcCoin = "0x815401357d501dc73b084399f692f942eec25a2fc9f2795cb073a3df6330626f::USDC::T";

    let user = parseAccount(config, "bob");
    await mintTo(harwCoin, user, unitToOctas(9000000));
    await mintTo(usdcCoin, user, unitToOctas(9000000));
}
async function deploy() {
    let contracts = readContract(network, "coins");
    for (let coin of ["BTC", "BUSD", "CAKE", "ETH", "HARW", "USDC"]) {
        contracts[coin] = `${deployer.address()}::${coin}::T`;
    }
    writeContract(network, "coins", contracts);
}

if (require.main === module) {
    main().catch((e) => console.error(e));
}
